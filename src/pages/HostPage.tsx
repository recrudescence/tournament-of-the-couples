import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSocket } from '../hooks/useSocket';
import { usePlayerInfo } from '../hooks/usePlayerInfo';
import { useGameContext } from '../context/GameContext';
import { DebugSidebar } from '../components/common/DebugSidebar';
import {RoundPhase, type GameState, type Team, type Player, Answer} from '../types/game';
import '../styles/host.css';

type HostPhase = 'roundSetup' | 'answering' | 'scoring';

interface LocalGameState {
  roundNumber: number;
  currentQuestion: string;
  teams: Team[];
  players: Player[];
  answers: Record<string, Answer>;
  submittedInCurrentPhase: string[];
  currentTeamIndex: number;
  revealedAnswers: Set<string>;
  roundPhase: RoundPhase;
}

export function HostPage() {
  const { isConnected, emit, on } = useSocket();
  const { playerInfo } = usePlayerInfo();
  const { gameState, dispatch } = useGameContext();

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

  const [localState, setLocalState] = useState<LocalGameState>({
    roundNumber: 0,
    currentQuestion: '',
    teams: [],
    players: [],
    answers: {},
    submittedInCurrentPhase: [],
    currentTeamIndex: 0,
    revealedAnswers: new Set(),
    roundPhase: RoundPhase.INITIAL,
  });

  const updateFromGameState = useCallback((state: GameState) => {
    dispatch({ type: 'SET_GAME_STATE', payload: state });

    setLocalState((prev) => ({
      ...prev,
      players: state.players,
      teams: state.teams,
    }));

    if (state.currentRound) {
      setLocalState((prev) => ({
        ...prev,
        roundNumber: state.currentRound!.roundNumber,
        currentQuestion: state.currentRound!.question,
        answers: state.currentRound!.answers || {},
      }));

      if (state.status === 'scoring' || state.currentRound.status === 'complete') {
        setLocalState((prev) => ({ ...prev, roundPhase: RoundPhase.COMPLETED }));
        setGameStatus('Scoring');
        setPhase('scoring');
      } else if (state.currentRound.status === 'answering') {
        setLocalState((prev) => ({ ...prev, roundPhase: RoundPhase.IN_PROGRESS }));
        setPhase('answering');
      }
    } else if (state.status === 'playing') {
      setLocalState((prev) => ({ ...prev, roundPhase: RoundPhase.INITIAL }));
      setGameStatus('Playing');
      setPhase('roundSetup');
    }
  }, [dispatch]);

  // Initialize local state from GameContext when HostPage mounts
  useEffect(() => {
    if (gameState) {
      updateFromGameState(gameState);
    }
  }, []); // Only run on mount

  // Sync local players to GameContext so DebugSidebar reflects disconnections
  useEffect(() => {
    dispatch({ type: 'UPDATE_PLAYERS', payload: localState.players });
  }, [localState.players, dispatch]);

  // Socket event handlers
  useEffect(() => {
    const unsubscribers = [
      on('joinSuccess', ({ gameState: state }) => {
        updateFromGameState(state);
      }),

      // Note: gameStarted is handled by LobbyPage which updates GameContext
      // HostPage reads from GameContext on mount via the initialization effect above

      on('roundStarted', ({ roundNumber, question, variant, options, gameState }) => {
        // variant and options are extracted to ensure we're handling the full event signature
        void variant; // Suppress unused warnings
        void options;
        setLocalState((prev) => ({
          ...prev,
          roundNumber,
          currentQuestion: question,
          answers: {},
          submittedInCurrentPhase: [],
          revealedAnswers: new Set(),
          roundPhase: RoundPhase.IN_PROGRESS,
          players: gameState?.players || prev.players,
          teams: gameState?.teams || prev.teams,
        }));
        setGameStatus('Answering');
        setShowAllAnswersNotification(false);
        setShowStartScoringBtn(false);
        setShowReopenBtn(false);
        setPhase('answering');
      }),

      on('answerSubmitted', ({ playerName, answer, responseTime, submittedInCurrentPhase }) => {
        setLocalState((prev) => ({
          ...prev,
          answers: { ...prev.answers, [playerName]: { text: answer, responseTime } },
          submittedInCurrentPhase,
        }));
      }),

      on('allAnswersIn', () => {
        setLocalState((prev) => ({ ...prev, roundPhase: RoundPhase.COMPLETED }));
        setShowAllAnswersNotification(true);
        setShowStartScoringBtn(true);
        setShowReopenBtn(true);
        setGameStatus('All Answers In');
      }),

      on('answerRevealed', ({ playerName, responseTime }) => {
        setLocalState((prev) => ({
          ...prev,
          revealedAnswers: new Set([...prev.revealedAnswers, playerName]),
        }));

        // Reveal response time with a delay (500ms) for emphasis
        setTimeout(() => {
          setRevealedResponseTimes((prev) => ({
            ...prev,
            [playerName]: responseTime
          }));
        }, 500);
      }),

      on('scoreUpdated', ({ teamId, newScore }) => {
        setLocalState((prev) => ({
          ...prev,
          teams: prev.teams.map((t) =>
            t.teamId === teamId ? { ...t, score: newScore } : t
          ),
        }));
      }),

      on('readyForNextRound', ({ nextRoundNumber }) => {
        setLocalState((prev) => ({
          ...prev,
          roundNumber: nextRoundNumber,
          roundPhase: RoundPhase.INITIAL,
        }));
        setQuestionInput('');
        setGameStatus('Setting Up');
        setShowFinishBtn(false);
        setTeamPointsAwarded({});
        setRevealedResponseTimes({});
        setPhase('roundSetup');
      }),

      on('returnedToAnswering', ({ currentRound }) => {
        setLocalState((prev) => ({
          ...prev,
          roundPhase: RoundPhase.IN_PROGRESS,
          answers: currentRound?.answers || prev.answers,
          submittedInCurrentPhase: [],
        }));
        setShowStartScoringBtn(false);
        setShowReopenBtn(false);
        setShowAllAnswersNotification(false);
        setGameStatus('Answering - Reopened');
        setPhase('answering');
      }),

      on('lobbyUpdate', (data) => {
        const state = (data as { gameState?: GameState }).gameState || data;
        setLocalState((prev) => ({
          ...prev,
          players: state.players || prev.players,
          teams: state.teams || prev.teams,
        }));
      }),

      on('playerDisconnected', ({ socketId }) => {
        setLocalState((prev) => ({
          ...prev,
          players: prev.players.map((p) =>
            p.socketId === socketId ? { ...p, connected: false } : p
          ),
        }));
      }),

      on('error', ({ message }) => {
        alert('Error: ' + message);
      }),
    ];

    return () => unsubscribers.forEach((unsub) => unsub());
  }, [on, dispatch, updateFromGameState]);

  const handleStartRound = (e: React.FormEvent) => {
    e.preventDefault();

    if (!questionInput.trim()) {
      alert('Please enter a question');
      return;
    }

    let options: string[] | undefined = undefined;

    if (selectedVariant === 'multiple_choice') {
      const filledOptions = mcOptions.filter(opt => opt.trim() !== '');
      if (filledOptions.length < 2 || filledOptions.length > 4) {
        alert('Please provide 2-4 options');
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
    setLocalState((prev) => ({ ...prev, currentTeamIndex: 0, revealedAnswers: new Set() }));
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
    if (nextIndex < localState.teams.length) {
      setLocalState((prev) => ({ ...prev, currentTeamIndex: nextIndex }));
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
    const team = localState.teams.find(t => t.teamId === teamId);
    if (team) {
      const player1 = getPlayerBySocketId(team.player1Id);
      const player2 = getPlayerBySocketId(team.player2Id);

      setLocalState((prev) => {
        const newRevealedAnswers = new Set(prev.revealedAnswers);
        if (player1) newRevealedAnswers.delete(player1.name);
        if (player2) newRevealedAnswers.delete(player2.name);

        return {
          ...prev,
          currentTeamIndex: teamIndex,
          revealedAnswers: newRevealedAnswers,
        };
      });

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
    (socketId: string) => localState.players.find((p) => p.socketId === socketId),
    [localState.players]
  );

  const submittedCount = useMemo(() => {
    if (localState.roundPhase === RoundPhase.COMPLETED) {
      return Object.keys(localState.answers).length;
    }
    return localState.submittedInCurrentPhase.length;
  }, [localState.roundPhase, localState.answers, localState.submittedInCurrentPhase]);

  const sortedTeams = useMemo(() => {
    return [...localState.teams].sort((a, b) => b.score - a.score);
  }, [localState.teams]);

  // Sort teams by total response time for scoring phase
  const teamsSortedByResponseTime = useMemo(() => {
    return localState.teams.map((team, originalIndex) => {
      const player1 = getPlayerBySocketId(team.player1Id);
      const player2 = getPlayerBySocketId(team.player2Id);

      const player1Answer = player1 ? localState.answers[player1.name] : null;
      const player2Answer = player2 ? localState.answers[player2.name] : null;

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
  }, [localState.teams, localState.answers, getPlayerBySocketId]);

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
          <p>Round: <strong>{localState.roundNumber || '-'}</strong></p>
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
            <p>{localState.currentQuestion}</p>
          </div>

          <h3>Answer Status</h3>
          <div className="answer-status">
            <ul className="player-status-list">
              {localState.players.map((player) => {
                const hasSubmitted =
                  localState.roundPhase === RoundPhase.COMPLETED
                    ? player.name in localState.answers
                    : localState.submittedInCurrentPhase.includes(player.name);

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
                {submittedCount} / {localState.players.length} answers submitted
              </p>
          )}
          {showAllAnswersNotification && (
            <div className="notification">
              ✅ All answers are in! Ready to score.
            </div>
          )}

          <div className="answering-actions">
            {showReopenBtn && (
                <button className="btn btn-warning" onClick={handleReopenAnswering}>
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
              const isExpanded = originalIndex === localState.currentTeamIndex && !isScored;

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
                            {!localState.revealedAnswers.has(player.name) ? (
                              <button
                                className="btn btn-secondary"
                                onClick={() => handleRevealAnswer(player.name)}
                              >
                                Reveal Answer
                              </button>
                            ) : (
                              <div className="answer-display">
                                {localState.answers[player.name]?.text || 'No answer'} (
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

        {/* End Game Button */}
        <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #e5e7eb' }}>
          <button
            className="btn btn-secondary"
            onClick={handleEndGame}
            style={{
              width: '100%',
              color: 'white'
            }}
          >
            🏁 End Game
          </button>
        </div>
      </div>
      </div>
    </>
  );
}
