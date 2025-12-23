import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSocket } from '../hooks/useSocket';
import { usePlayerInfo } from '../hooks/usePlayerInfo';
import { useGameContext } from '../context/GameContext';
import { useGameError } from '../hooks/useGameError';
import { DebugSidebar } from '../components/common/DebugSidebar';
import { type GameState } from '../types/game';
import '../styles/host.css';

type HostPhase = 'roundSetup' | 'answering' | 'scoring';

export function HostPage() {
  const { isConnected, emit, on } = useSocket();
  const { playerInfo } = usePlayerInfo();
  const { gameState, dispatch } = useGameContext();
  const { error, showError } = useGameError();

  const [phase, setPhase] = useState<HostPhase>('roundSetup');
  const [questionInput, setQuestionInput] = useState('');
  const [selectedVariant, setSelectedVariant] = useState<'open_ended' | 'multiple_choice' | 'binary'>('open_ended');
  const [mcOptions, setMcOptions] = useState<string[]>(['', '']);
  const [gameStatus, setGameStatus] = useState('Setting Up');
  const [showAllAnswersNotification, setShowAllAnswersNotification] = useState(false);
  const [showStartScoringBtn, setShowStartScoringBtn] = useState(false);
  const [showReopenBtn, setShowReopenBtn] = useState(false);
  const [showFinishBtn, setShowFinishBtn] = useState(false);
  const [teamPointsAwarded, setTeamPointsAwarded] = useState<Record<string, number>>({});
  const [revealedResponseTimes, setRevealedResponseTimes] = useState<Record<string, number>>({});

  // UI-only state
  const [currentTeamIndex, setCurrentTeamIndex] = useState(0);
  const [revealedAnswers, setRevealedAnswers] = useState<Set<string>>(new Set());

  // Initialize phase from gameState on mount
  useEffect(() => {
    if (gameState?.currentRound) {
      if (gameState.status === 'scoring' || gameState.currentRound.status === 'complete') {
        setGameStatus('Scoring');
        setPhase('scoring');
      } else if (gameState.currentRound.status === 'answering') {
        setPhase('answering');
      }
    } else if (gameState?.status === 'playing') {
      setGameStatus('Playing');
      setPhase('roundSetup');
    }
  }, []); // Only run on mount

  // Socket event handlers
  useEffect(() => {
    const unsubscribers = [
      on('joinSuccess', ({ gameState: state }) => {
        dispatch({ type: 'SET_GAME_STATE', payload: state });
      }),

      on('roundStarted', ({ gameState: state }) => {
        if (state) {
          dispatch({ type: 'SET_GAME_STATE', payload: state });
        }
        setRevealedAnswers(new Set());
        setGameStatus('Answering');
        setShowAllAnswersNotification(false);
        setShowStartScoringBtn(false);
        setShowReopenBtn(false);
        setPhase('answering');
      }),

      on('answerSubmitted', ({ gameState: state }) => {
        if (state) {
          dispatch({ type: 'SET_GAME_STATE', payload: state });
        }
      }),

      on('allAnswersIn', () => {
        setShowAllAnswersNotification(true);
        setShowStartScoringBtn(true);
        setShowReopenBtn(true);
        setGameStatus('All Answers In');
      }),

      on('answerRevealed', ({ playerName, responseTime }) => {
        setRevealedAnswers((prev) => new Set([...prev, playerName]));

        // Reveal response time with a delay (500ms) for emphasis
        setTimeout(() => {
          setRevealedResponseTimes((prev) => ({
            ...prev,
            [playerName]: responseTime
          }));
        }, 500);
      }),

      on('scoreUpdated', ({ teamId, newScore }) => {
        dispatch({ type: 'UPDATE_TEAM_SCORE', payload: { teamId, newScore } });
      }),

      on('readyForNextRound', () => {
        setQuestionInput('');
        setGameStatus('Setting Up');
        setShowFinishBtn(false);
        setTeamPointsAwarded({});
        setRevealedResponseTimes({});
        setPhase('roundSetup');
      }),

      on('returnedToAnswering', ({ gameState: state }) => {
        if (state) {
          dispatch({ type: 'SET_GAME_STATE', payload: state });
        }
        setShowStartScoringBtn(false);
        setShowReopenBtn(false);
        setShowAllAnswersNotification(false);
        setGameStatus('Answering - Reopened');
        setPhase('answering');
      }),

      on('lobbyUpdate', (data) => {
        const state = (data as { gameState?: GameState }).gameState || data;
        dispatch({ type: 'SET_GAME_STATE', payload: state });
      }),

      on('playerDisconnected', ({ socketId }) => {
        if (!gameState) return;
        const updatedPlayers = gameState.players.map((p) =>
          p.socketId === socketId ? { ...p, connected: false } : p
        );
        dispatch({ type: 'UPDATE_PLAYERS', payload: updatedPlayers });
      }),

      on('error', ({ message }) => {
        showError(message);
      }),
    ];

    return () => unsubscribers.forEach((unsub) => unsub());
  }, [on, dispatch, showError, gameState]);

  const handleStartRound = (e: React.FormEvent) => {
    e.preventDefault();

    if (!questionInput.trim()) {
      showError('Please enter a question');
      return;
    }

    let options: string[] | undefined = undefined;

    if (selectedVariant === 'multiple_choice') {
      const filledOptions = mcOptions.filter(opt => opt.trim() !== '');
      if (filledOptions.length < 2 || filledOptions.length > 4) {
        showError('Please provide 2-4 options');
        return;
      }
      options = filledOptions.map(opt => opt.trim());
    } else if (selectedVariant === 'binary') {
      options = ['Player 1', 'Player 2'];
    }

    emit('startRound', {
      question: questionInput.trim(),
      variant: selectedVariant,
      options
    });

    setQuestionInput('');
    setMcOptions(['', '']);
  };

  const handleStartScoring = () => {
    setCurrentTeamIndex(0);
    setRevealedAnswers(new Set());
    setGameStatus('Scoring');
    setTeamPointsAwarded({});
    setRevealedResponseTimes({});
    setShowFinishBtn(false);
    setPhase('scoring');
  };

  const handleBackToAnswering = () => {
    // Just navigate back to answering view (UI only)
    setGameStatus('All Answers In');
    setShowAllAnswersNotification(true);
    setShowStartScoringBtn(true);
    setShowReopenBtn(true);
    setPhase('answering');
  };

  const handleReopenAnswering = () => {
    emit('backToAnswering');
    setShowReopenBtn(false);
  };

  const handleRevealAnswer = (playerName: string) => {
    emit('revealAnswer', { playerName });
  };

  const handleAwardPoint = (teamId: string, teamIndex: number) => {
    emit('awardPoint', { teamId });
    setTeamPointsAwarded((prev) => ({ ...prev, [teamId]: 1 }));
    moveToNextTeam(teamIndex);
  };

  const handleSkipPoint = (teamId: string, teamIndex: number) => {
    setTeamPointsAwarded((prev) => ({ ...prev, [teamId]: 0 }));
    moveToNextTeam(teamIndex);
  };

  const moveToNextTeam = (currentIndex: number) => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < (gameState?.teams.length || 0)) {
      setCurrentTeamIndex(nextIndex);
    } else {
      setShowFinishBtn(true);
    }
  };

  const handleFinishRound = () => {
    emit('nextRound');
  };

  const handleReopenTeamScoring = (teamId: string, teamIndex: number) => {
    // If team was awarded a point, remove it
    if (teamPointsAwarded[teamId] === 1) {
      emit('removePoint', { teamId });
    }

    // Remove from local tracking
    setTeamPointsAwarded((prev) => {
      const updated = { ...prev };
      delete updated[teamId];
      return updated;
    });

    // Clear revealed answers and response times for this team's players
    const team = gameState?.teams.find(t => t.teamId === teamId);
    if (team) {
      const player1 = getPlayerBySocketId(team.player1Id);
      const player2 = getPlayerBySocketId(team.player2Id);

      const newRevealedAnswers = new Set(revealedAnswers);
      if (player1) newRevealedAnswers.delete(player1.name);
      if (player2) newRevealedAnswers.delete(player2.name);
      setRevealedAnswers(newRevealedAnswers);
      setCurrentTeamIndex(teamIndex);

      // Clear response times for these players
      setRevealedResponseTimes((prev) => {
        const updated = { ...prev };
        if (player1) delete updated[player1.name];
        if (player2) delete updated[player2.name];
        return updated;
      });
    }

    setShowFinishBtn(false);
  };

  const handleEndGame = () => {
    if (window.confirm('Are you sure you want to end the game? This will show the final scores and cannot be undone.')) {
      emit('endGame');
    }
  };

  // Computed values
  const getPlayerBySocketId = useCallback(
    (socketId: string) => gameState?.players.find((p) => p.socketId === socketId),
    [gameState?.players]
  );

  const submittedCount = useMemo(() => {
    if (!gameState?.currentRound) return 0;

    if (gameState.currentRound.status === 'complete') {
      return Object.keys(gameState.currentRound.answers).length;
    }
    return gameState.currentRound.submittedInCurrentPhase.length;
  }, [gameState?.currentRound]);

  const sortedTeams = useMemo(() => {
    if (!gameState?.teams) return [];
    return [...gameState.teams].sort((a, b) => b.score - a.score);
  }, [gameState?.teams]);

  // Sort teams by total response time for scoring phase
  const teamsSortedByResponseTime = useMemo(() => {
    if (!gameState?.teams || !gameState?.currentRound) return [];

    return gameState.teams.map((team, originalIndex) => {
      const player1 = getPlayerBySocketId(team.player1Id);
      const player2 = getPlayerBySocketId(team.player2Id);

      const player1Answer = player1 ? gameState.currentRound!.answers[player1.name] : null;
      const player2Answer = player2 ? gameState.currentRound!.answers[player2.name] : null;

      const player1Time = player1Answer?.responseTime ?? Infinity;
      const player2Time = player2Answer?.responseTime ?? Infinity;
      const totalResponseTime = player1Time + player2Time;

      return {
        team,
        originalIndex,
        totalResponseTime,
        player1Time,
        player2Time
      };
    }).sort((a, b) => a.totalResponseTime - b.totalResponseTime);
  }, [gameState?.teams, gameState?.currentRound, getPlayerBySocketId]);

  if (!playerInfo || !isConnected) {
    return (
      <div className="container">
        <h1>Tournament of Couples</h1>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <>
      <DebugSidebar />
      <div className="container">
        <header>
          <h1>Tournament of Couples</h1>
          <div className="header-info">
            <p>Host: <strong>{playerInfo.name}</strong></p>
            <p>Round: <strong>{gameState?.currentRound?.roundNumber || '-'}</strong></p>
            <p>Status: <strong>{gameStatus}</strong></p>
          </div>
        </header>

        {/* Round Setup Phase */}
        {phase === 'roundSetup' && (
          <div className="phase-section">
            <h2>Start New Round</h2>

            {/* Variant Tabs */}
            <div className="variant-tabs">
              <button
                type="button"
                className={`variant-tab ${selectedVariant === 'open_ended' ? 'active' : ''}`}
                onClick={() => setSelectedVariant('open_ended')}
              >
                Open Ended
              </button>
              <button
                type="button"
                className={`variant-tab ${selectedVariant === 'multiple_choice' ? 'active' : ''}`}
                onClick={() => setSelectedVariant('multiple_choice')}
              >
                Multiple Choice
              </button>
              <button
                type="button"
                className={`variant-tab ${selectedVariant === 'binary' ? 'active' : ''}`}
                onClick={() => setSelectedVariant('binary')}
              >
                Binary
              </button>
            </div>

            <form onSubmit={handleStartRound}>
              {/* Open Ended Form */}
              <div className={`variant-tab-content ${selectedVariant === 'open_ended' ? 'active' : ''}`}>
                <div className="form-group">
                  <label htmlFor="questionInput">Enter Question:</label>
                  <textarea
                    id="questionInput"
                    rows={6}
                    placeholder="What's your partner's favorite movie?"
                    value={questionInput}
                    onChange={(e) => setQuestionInput(e.target.value)}
                    required={selectedVariant === 'open_ended'}
                  />
                </div>
              </div>

              {/* Multiple Choice Form */}
              <div className={`variant-tab-content ${selectedVariant === 'multiple_choice' ? 'active' : ''}`}>
                <div className="form-group">
                  <label htmlFor="mcQuestionInput">Enter Question:</label>
                  <textarea
                    id="mcQuestionInput"
                    rows={4}
                    placeholder="What's your partner's favorite color?"
                    value={questionInput}
                    onChange={(e) => setQuestionInput(e.target.value)}
                    required={selectedVariant === 'multiple_choice'}
                  />
                </div>

                <label>Options (2-4 choices):</label>
                <div className="mc-options-container">
                  {mcOptions.map((option, index) => (
                    <div key={index} className="mc-option-row">
                      <input
                        type="text"
                        className="mc-option-input"
                        placeholder={`Option ${index + 1}`}
                        value={option}
                        onChange={(e) => {
                          const newOptions = [...mcOptions];
                          newOptions[index] = e.target.value;
                          setMcOptions(newOptions);
                        }}
                        required={selectedVariant === 'multiple_choice'}
                      />
                      {mcOptions.length > 2 && (
                        <button
                          type="button"
                          className="btn-remove-option"
                          onClick={() => {
                            const newOptions = mcOptions.filter((_, i) => i !== index);
                            setMcOptions(newOptions);
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {mcOptions.length < 4 && (
                  <button
                    type="button"
                    className="btn-add-option"
                    onClick={() => setMcOptions([...mcOptions, ''])}
                  >
                    + Add Option
                  </button>
                )}
              </div>

              {/* Binary Form */}
              <div className={`variant-tab-content ${selectedVariant === 'binary' ? 'active' : ''}`}>
                <div className="form-group">
                  <label htmlFor="binaryQuestionInput">Enter Question:</label>
                  <textarea
                    id="binaryQuestionInput"
                    rows={4}
                    placeholder="Who is more likely to...?"
                    value={questionInput}
                    onChange={(e) => setQuestionInput(e.target.value)}
                    required={selectedVariant === 'binary'}
                  />
                </div>

                <label>Options (auto-filled with team member names):</label>
                <div className="binary-options">
                  <div className="binary-option-display">Player 1</div>
                  <div className="binary-option-display">Player 2</div>
                </div>
                <p style={{ fontSize: '0.9em', color: '#666', marginBottom: '16px' }}>
                  Note: Player names will be filled in dynamically for each team
                </p>
              </div>

              <button type="submit" className="btn btn-primary">
                Start Round
              </button>
            </form>
          </div>
        )}

        {/* Answering Phase */}
        {phase === 'answering' && (
          <div className="phase-section">
            <h2>Current Question</h2>
            <div className="question-display">
              <p>{gameState?.currentRound?.question}</p>
            </div>

            <h3>Answer Status</h3>
            <div className="answer-status">
              <ul className="player-status-list">
                {gameState?.players.map((player) => {
                  const hasSubmitted = gameState.currentRound
                    ? gameState.currentRound.status === 'complete'
                      ? player.name in gameState.currentRound.answers
                      : gameState.currentRound.submittedInCurrentPhase.includes(player.name)
                    : false;

                  return (
                    <li
                      key={player.socketId}
                      className={
                        !player.connected
                          ? 'disconnected'
                          : hasSubmitted
                          ? 'answered'
                          : 'waiting'
                      }
                    >
                      {player.name}{' '}
                      {!player.connected
                        ? '🔌 (Disconnected)'
                        : hasSubmitted
                        ? '✅'
                        : '⏳'}
                    </li>
                  );
                })}
              </ul>
            </div>

            {!showAllAnswersNotification && (
                <p className="status-summary">
                  {submittedCount} / {gameState?.players.length || 0} answers submitted
                </p>
            )}
            {showAllAnswersNotification && (
              <div className="notification">
                ✅ All answers are in! Ready to score.
              </div>
            )}

            <div className="answering-actions">
              {showReopenBtn && (
                  <button className="btn btn-info" onClick={handleReopenAnswering}>
                    Re-open Answering
                  </button>
              )}
              {showStartScoringBtn && (
                <button className="btn btn-primary" onClick={handleStartScoring}>
                  Begin Scoring
                </button>
              )}
            </div>
          </div>
        )}

        {/* Scoring Phase */}
        {phase === 'scoring' && (
          <div className="phase-section">
            <button className="btn btn-info btn-sm" onClick={handleBackToAnswering}>
              ← Back to Answering
            </button>
            <div className="phase-header">
              <h2>Review Team Answers</h2>
            </div>

            <div className="team-cards-container">
              {teamsSortedByResponseTime.map(({ team, originalIndex, player1Time, player2Time }) => {
                const player1 = getPlayerBySocketId(team.player1Id);
                const player2 = getPlayerBySocketId(team.player2Id);
                const isScored = team.teamId in teamPointsAwarded;
                const isExpanded = originalIndex === currentTeamIndex && !isScored;

                // Sort players by response time (ascending)
                const players = [
                  { player: player1, time: player1Time },
                  { player: player2, time: player2Time }
                ].sort((a, b) => a.time - b.time);

                return (
                  <div
                    key={team.teamId}
                    className={`team-card ${isExpanded ? 'expanded' : 'collapsed'}`}
                  >
                    <div className="team-card-header">
                      <div className="team-card-title">
                        {player1?.name || '?'} & {player2?.name || '?'}
                      </div>
                      <div className="team-card-header-right">
                        <div
                          className={`team-card-score ${
                            isScored
                              ? (teamPointsAwarded[team.teamId] ?? 0) > 0
                                ? 'points-awarded'
                                : 'points-none'
                              : ''
                          }`}
                        >
                          {isScored &&
                            ((teamPointsAwarded[team.teamId] ?? 0) > 0
                              ? `+${teamPointsAwarded[team.teamId]} point! 🎉`
                              : '0 points 😔')}
                        </div>
                        {!isExpanded && isScored && (
                          <button
                            className="btn btn-info btn-sm"
                            onClick={() => handleReopenTeamScoring(team.teamId, originalIndex)}
                          >
                            ↪️
                          </button>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="team-card-content">
                        {players.map(({ player }) =>
                          player ? (
                            <div key={player.socketId} className="player-answer">
                              <h4>{player.name} said...</h4>
                              {!revealedAnswers.has(player.name) ? (
                                <button
                                  className="btn btn-secondary"
                                  onClick={() => handleRevealAnswer(player.name)}
                                >
                                  Reveal Answer
                                </button>
                              ) : (
                                <div className="answer-display">
                                  {gameState?.currentRound?.answers[player.name]?.text || 'No answer'} (
                                  {revealedResponseTimes[player.name] !== undefined && (
                                    <i>
                                      took {(revealedResponseTimes[player.name]! / 1000).toFixed(2)}s
                                    </i>
                                  )}
                                  )
                                </div>
                              )}
                            </div>
                          ) : null
                        )}

                        <div className="scoring-actions">
                          <button
                            className="btn btn-success"
                            onClick={() => handleAwardPoint(team.teamId, originalIndex)}
                          >
                            Award Point ⭐
                          </button>
                          <button
                            className="btn btn-neutral"
                            onClick={() => handleSkipPoint(team.teamId, originalIndex)}
                          >
                            No Point
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {showFinishBtn && (
              <div className="navigation-actions">
                <button className="btn btn-primary" onClick={handleFinishRound}>
                  Finish Round
                </button>
              </div>
            )}
          </div>
        )}

        {/* Scoreboard (Always Visible) */}
        <div className="scoreboard">
          <h3>📊 Scoreboard</h3>
          <div className="scoreboard-list">
            {sortedTeams.length === 0 ? (
              <p>No teams yet</p>
            ) : (
              sortedTeams.map((team) => {
                const player1 = getPlayerBySocketId(team.player1Id);
                const player2 = getPlayerBySocketId(team.player2Id);

                return (
                  <div key={team.teamId} className="team-score-item">
                    <span className="team-names">
                      {player1?.name || '?'} & {player2?.name || '?'}
                    </span>
                    <span className="score">{team.score} pts</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* End Game Button */}
        <div className="end-game-section">
          <button
              className="btn btn-info btn-sm"
              onClick={handleEndGame}
              style={{
                width: '100%',
              }}
          >
            🏁 End Game
          </button>
        </div>

        {error && <div className="error">{error}</div>}
      </div>
    </>
  );
}
