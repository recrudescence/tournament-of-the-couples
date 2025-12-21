import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSocket } from '../hooks/useSocket';
import { usePlayerInfo } from '../hooks/usePlayerInfo';
import { useGameContext } from '../context/GameContext';
import { DebugSidebar } from '../components/common/DebugSidebar';
import { RoundPhase, type GameState, type Team, type Player } from '../types/game';
import '../styles/host.css';

type HostPhase = 'roundSetup' | 'answering' | 'scoring';

interface LocalGameState {
  roundNumber: number;
  currentQuestion: string;
  teams: Team[];
  players: Player[];
  answers: Record<string, string>;
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
  const [roomCode, setRoomCode] = useState('');
  const [gameStatus, setGameStatus] = useState('Setting Up');
  const [showAllAnswersNotification, setShowAllAnswersNotification] = useState(false);
  const [showStartScoringBtn, setShowStartScoringBtn] = useState(false);
  const [showReopenBtn, setShowReopenBtn] = useState(false);
  const [showFinishBtn, setShowFinishBtn] = useState(false);
  const [teamPointsAwarded, setTeamPointsAwarded] = useState<Record<string, number>>({});

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
    setRoomCode(state.roomCode);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // Sync local players to GameContext so DebugSidebar reflects disconnections
  useEffect(() => {
    dispatch({ type: 'UPDATE_PLAYERS', payload: localState.players });
  }, [localState.players, dispatch]);

  // Socket event handlers
  useEffect(() => {
    const unsubscribers = [
      on('joinSuccess', ({ gameState: state, roomCode: rc }) => {
        setRoomCode(rc);
        updateFromGameState(state);
      }),

      // Note: gameStarted is handled by LobbyPage which updates GameContext
      // HostPage reads from GameContext on mount via the initialization effect above

      on('roundStarted', ({ roundNumber, question, gameState }) => {
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

      on('answerSubmitted', ({ playerName, answer, submittedInCurrentPhase }) => {
        setLocalState((prev) => ({
          ...prev,
          answers: { ...prev.answers, [playerName]: answer },
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

      on('answerRevealed', ({ playerName }) => {
        setLocalState((prev) => ({
          ...prev,
          revealedAnswers: new Set([...prev.revealedAnswers, playerName]),
        }));
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
    const question = questionInput.trim();
    if (question) {
      emit('startRound', { question });
    }
  };

  const handleStartScoring = () => {
    setLocalState((prev) => ({ ...prev, currentTeamIndex: 0, revealedAnswers: new Set() }));
    setGameStatus('Scoring');
    setTeamPointsAwarded({});
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

    // Clear revealed answers for this team's players
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
    }

    setShowFinishBtn(false);
  };

  const handleEndGame = () => {
    if (window.confirm('Are you sure you want to end the game? This will show the final scores and cannot be undone.')) {
      emit('endGame');
    }
  };

  // Computed values
  const submittedCount = useMemo(() => {
    if (localState.roundPhase === RoundPhase.COMPLETED) {
      return Object.keys(localState.answers).length;
    }
    return localState.submittedInCurrentPhase.length;
  }, [localState.roundPhase, localState.answers, localState.submittedInCurrentPhase]);

  const sortedTeams = useMemo(() => {
    return [...localState.teams].sort((a, b) => b.score - a.score);
  }, [localState.teams]);

  const getPlayerBySocketId = useCallback(
    (socketId: string) => localState.players.find((p) => p.socketId === socketId),
    [localState.players]
  );

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
          <p>Room: <strong>{roomCode.toUpperCase() || playerInfo.roomCode.toUpperCase()}</strong></p>
          <p>Host: <strong>{playerInfo.name}</strong></p>
          <p>Round: <strong>{localState.roundNumber || '-'}</strong></p>
          <p>Status: <strong>{gameStatus}</strong></p>
        </div>
      </header>

      {/* Round Setup Phase */}
      {phase === 'roundSetup' && (
        <div className="phase-section">
          <h2>Start New Round</h2>
          <form onSubmit={handleStartRound}>
            <div className="form-group">
              <label htmlFor="questionInput">Enter Question:</label>
              <textarea
                id="questionInput"
                rows={6}
                placeholder="What's your partner's favorite movie?"
                value={questionInput}
                onChange={(e) => setQuestionInput(e.target.value)}
                required
              />
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
            {localState.teams.map((team, index) => {
              const player1 = getPlayerBySocketId(team.player1Id);
              const player2 = getPlayerBySocketId(team.player2Id);
              const isScored = team.teamId in teamPointsAwarded;
              const isExpanded = index === localState.currentTeamIndex && !isScored;

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
                          onClick={() => handleReopenTeamScoring(team.teamId, index)}
                        >
                          ↪️
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="team-card-content">
                      {[player1, player2].map((player) =>
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
                                {localState.answers[player.name] || 'No answer'}
                              </div>
                            )}
                          </div>
                        ) : null
                      )}

                      <div className="scoring-actions">
                        <button
                          className="btn btn-success"
                          onClick={() => handleAwardPoint(team.teamId, index)}
                        >
                          Award Point ⭐
                        </button>
                        <button
                          className="btn btn-neutral"
                          onClick={() => handleSkipPoint(team.teamId, index)}
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
