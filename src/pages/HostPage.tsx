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
      <section className="section">
        <div className="container" style={{ maxWidth: '900px' }}>
          <h1 className="title has-text-centered">Tournament of Couples</h1>
          <p className="has-text-centered">Loading...</p>
        </div>
      </section>
    );
  }

  return (
    <>
      <DebugSidebar />
      <section className="section">
        <div className="container" style={{ maxWidth: '900px' }}>
          <div className="block">
            <h1 className="title has-text-centered">Tournament of Couples</h1>
            <div className="box">
              <div className="columns is-mobile has-text-centered">
                <div className="column">
                  <p className="heading">Host</p>
                  <p className="title is-6 has-text-primary">{playerInfo.name}</p>
                </div>
                <div className="column">
                  <p className="heading">Round</p>
                  <p className="title is-6">{gameState?.currentRound?.roundNumber || '-'}</p>
                </div>
                <div className="column">
                  <p className="heading">Status</p>
                  <p className="title is-6">{gameStatus}</p>
                </div>
              </div>
            </div>
          </div>

        {/* Round Setup Phase */}
        {phase === 'roundSetup' && (
          <div className="box">
            <h2 className="subtitle is-4 mb-4">Start New Round</h2>

            {/* Variant Tabs */}
            <div className="tabs is-centered is-boxed mb-4">
              <ul>
                <li className={selectedVariant === 'open_ended' ? 'is-active' : ''}>
                  <a onClick={() => setSelectedVariant('open_ended')}>
                    Open Ended
                  </a>
                </li>
                <li className={selectedVariant === 'multiple_choice' ? 'is-active' : ''}>
                  <a onClick={() => setSelectedVariant('multiple_choice')}>
                    Multiple Choice
                  </a>
                </li>
                <li className={selectedVariant === 'binary' ? 'is-active' : ''}>
                  <a onClick={() => setSelectedVariant('binary')}>
                    Binary
                  </a>
                </li>
              </ul>
            </div>

            <form onSubmit={handleStartRound}>
              {/* Open Ended Form */}
              {selectedVariant === 'open_ended' && (
                <div className="field">
                  <label className="label" htmlFor="questionInput">Enter Question:</label>
                  <div className="control">
                    <textarea
                      id="questionInput"
                      className="textarea"
                      rows={6}
                      placeholder="What's your partner's favorite movie?"
                      value={questionInput}
                      onChange={(e) => setQuestionInput(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              {/* Multiple Choice Form */}
              {selectedVariant === 'multiple_choice' && (
                <>
                  <div className="field">
                    <label className="label" htmlFor="mcQuestionInput">Enter Question:</label>
                    <div className="control">
                      <textarea
                        id="mcQuestionInput"
                        className="textarea"
                        rows={4}
                        placeholder="What's your partner's favorite color?"
                        value={questionInput}
                        onChange={(e) => setQuestionInput(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <label className="label">Options (2-4 choices):</label>
                  <div className="mb-3">
                    {mcOptions.map((option, index) => (
                      <div key={index} className="field has-addons mb-2">
                        <div className="control is-expanded">
                          <input
                            type="text"
                            className="input"
                            placeholder={`Option ${index + 1}`}
                            value={option}
                            onChange={(e) => {
                              const newOptions = [...mcOptions];
                              newOptions[index] = e.target.value;
                              setMcOptions(newOptions);
                            }}
                            required
                          />
                        </div>
                        {mcOptions.length > 2 && (
                          <div className="control">
                            <button
                              type="button"
                              className="button is-danger"
                              onClick={() => {
                                const newOptions = mcOptions.filter((_, i) => i !== index);
                                setMcOptions(newOptions);
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {mcOptions.length < 4 && (
                    <button
                      type="button"
                      className="button is-light mb-3"
                      onClick={() => setMcOptions([...mcOptions, ''])}
                    >
                      + Add Option
                    </button>
                  )}
                </>
              )}

              {/* Binary Form */}
              {selectedVariant === 'binary' && (
                <>
                  <div className="field">
                    <label className="label" htmlFor="binaryQuestionInput">Enter Question:</label>
                    <div className="control">
                      <textarea
                        id="binaryQuestionInput"
                        className="textarea"
                        rows={4}
                        placeholder="Who is more likely to...?"
                        value={questionInput}
                        onChange={(e) => setQuestionInput(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <label className="label">Options (auto-filled with team member names):</label>
                  <div className="tags mb-3">
                    <span className="tag is-info is-medium">Player 1</span>
                    <span className="tag is-info is-medium">Player 2</span>
                  </div>
                  <p className="help mb-3">
                    Note: Player names will be filled in dynamically for each team
                  </p>
                </>
              )}

              <button type="submit" className="button is-primary is-fullwidth is-large">
                Start Round
              </button>
            </form>
          </div>
        )}

        {/* Answering Phase */}
        {phase === 'answering' && (
          <div className="box">
            <h2 className="subtitle is-4 mb-3">Current Question</h2>
            <div className="notification is-primary is-light mb-4">
              <p className="is-size-5 has-text-weight-semibold">{gameState?.currentRound?.question}</p>
            </div>

            <h3 className="subtitle is-5 mb-3">Answer Status</h3>
            <div className="box has-background-white-ter mb-4">
              <div className="content">
                <ul>
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
                            ? 'has-text-grey'
                            : hasSubmitted
                            ? 'has-text-success'
                            : 'has-text-warning-dark'
                        }
                      >
                        <strong>{player.name}</strong>{' '}
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
            </div>

            {!showAllAnswersNotification && (
              <p className="has-text-centered has-text-grey mb-4">
                {submittedCount} / {gameState?.players.length || 0} answers submitted
              </p>
            )}
            {showAllAnswersNotification && (
              <div className="notification is-success is-light mb-4">
                ✅ All answers are in! Ready to score.
              </div>
            )}

            <div className="field is-grouped is-grouped-centered">
              {showReopenBtn && (
                <div className="control">
                  <button className="button is-info" onClick={handleReopenAnswering}>
                    Re-open Answering
                  </button>
                </div>
              )}
              {showStartScoringBtn && (
                <div className="control">
                  <button className="button is-primary is-large" onClick={handleStartScoring}>
                    Begin Scoring
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Scoring Phase */}
        {phase === 'scoring' && (
          <div className="box">
            <button className="button is-info is-small mb-3" onClick={handleBackToAnswering}>
              ← Back to Answering
            </button>
            <h2 className="subtitle is-4 mb-4">Review Team Answers</h2>

            <div className="mb-4">
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
                    className={`box mb-3 ${isExpanded ? 'has-background-link-light' : ''}`}
                  >
                    <div className="is-flex is-justify-content-space-between is-align-items-center mb-2">
                      <div className="has-text-weight-bold is-size-5">
                        {player1?.name || '?'} & {player2?.name || '?'}
                      </div>
                      <div className="is-flex is-align-items-center">
                        {isScored && (
                          <span
                            className={`tag is-medium mr-2 ${
                              (teamPointsAwarded[team.teamId] ?? 0) > 0
                                ? 'is-success'
                                : 'is-light'
                            }`}
                          >
                            {(teamPointsAwarded[team.teamId] ?? 0) > 0
                              ? `+${teamPointsAwarded[team.teamId]} point! 🎉`
                              : '0 points 😔'}
                          </span>
                        )}
                        {!isExpanded && isScored && (
                          <button
                            className="button is-info is-small"
                            onClick={() => handleReopenTeamScoring(team.teamId, originalIndex)}
                          >
                            ↪️
                          </button>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="content">
                        {players.map(({ player }) =>
                          player ? (
                            <div key={player.socketId} className="box has-background-white-ter mb-3">
                              <h4 className="subtitle is-6">{player.name} said...</h4>
                              {!revealedAnswers.has(player.name) ? (
                                <button
                                  className="button is-link"
                                  onClick={() => handleRevealAnswer(player.name)}
                                >
                                  Reveal Answer
                                </button>
                              ) : (
                                <div className="notification is-light">
                                  <strong>{gameState?.currentRound?.answers[player.name]?.text || 'No answer'}</strong>
                                  {revealedResponseTimes[player.name] !== undefined && (
                                    <span className="has-text-grey ml-2">
                                      (took {(revealedResponseTimes[player.name]! / 1000).toFixed(2)}s)
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : null
                        )}

                        <div className="field is-grouped is-grouped-centered mt-4">
                          <div className="control">
                            <button
                              className="button is-success is-large"
                              onClick={() => handleAwardPoint(team.teamId, originalIndex)}
                            >
                              Award Point ⭐
                            </button>
                          </div>
                          <div className="control">
                            <button
                              className="button is-light is-large"
                              onClick={() => handleSkipPoint(team.teamId, originalIndex)}
                            >
                              No Point
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {showFinishBtn && (
              <div className="has-text-centered mt-4">
                <button className="button is-primary is-large" onClick={handleFinishRound}>
                  Finish Round
                </button>
              </div>
            )}
          </div>
        )}

        {/* Scoreboard (Always Visible) */}
        <div className="box">
          <h3 className="subtitle is-5 mb-3">📊 Scoreboard</h3>
          {sortedTeams.length === 0 ? (
            <p className="has-text-centered has-text-grey">No teams yet</p>
          ) : (
            <div>
              {sortedTeams.map((team) => {
                const player1 = getPlayerBySocketId(team.player1Id);
                const player2 = getPlayerBySocketId(team.player2Id);

                return (
                  <div key={team.teamId} className="box has-background-white-ter mb-2 is-flex is-justify-content-space-between is-align-items-center">
                    <span className="has-text-weight-semibold">
                      {player1?.name || '?'} & {player2?.name || '?'}
                    </span>
                    <span className="tag is-info is-medium">{team.score} pts</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* End Game Button */}
        <div className="box has-background-light">
          <button
            className="button is-info is-fullwidth"
            onClick={handleEndGame}
          >
            🏁 End Game
          </button>
        </div>

        {error && <div className="notification is-danger is-light mt-4">{error}</div>}
      </div>
      </section>
    </>
  );
}
