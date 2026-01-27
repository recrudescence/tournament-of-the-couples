import { useEffect, useState, useMemo, useRef } from 'react';
import { useSocket } from '../hooks/useSocket';
import { usePlayerInfo } from '../hooks/usePlayerInfo';
import { useGameContext } from '../context/GameContext';
import { useGameError } from '../hooks/useGameError';
import { DebugSidebar } from '../components/common/DebugSidebar';
import { ExitButton } from '../components/common/ExitButton';
import { QuestionForm } from '../components/host/QuestionForm';
import { AnsweringPhase } from '../components/host/AnsweringPhase';
import { ScoringInterface } from '../components/host/ScoringInterface';
import { TeamScoreboard } from '../components/host/TeamScoreboard';
import { RoundControls } from '../components/host/RoundControls';
import { type GameState } from '../types/game';
import { findPlayerBySocketId } from '../utils/playerUtils';
import { GameTitle } from '../components/common/GameTitle';
import { PlayerAvatar } from '../components/common/PlayerAvatar';

type HostPhase = 'roundSetup' | 'answering' | 'scoring';

export function HostPage() {
  const { isConnected, emit, on } = useSocket();
  const { playerInfo } = usePlayerInfo();
  const { gameState, dispatch } = useGameContext();
  const { error, showError } = useGameError();

  // Ref to access latest gameState in socket handlers without causing re-subscriptions
  const gameStateRef = useRef(gameState);
  // Ref to track pending timeouts for cleanup
  const pendingTimeoutsRef = useRef<Set<NodeJS.Timeout>>(new Set());

  const [phase, setPhase] = useState<HostPhase>('roundSetup');
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

  // Keep ref in sync with gameState
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

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

        // Reveal response time with a delay for emphasis
        const timeoutId = setTimeout(() => {
          setRevealedResponseTimes((prev) => ({
            ...prev,
            [playerName]: responseTime
          }));
          pendingTimeoutsRef.current.delete(timeoutId);
        }, 0);
        pendingTimeoutsRef.current.add(timeoutId);
      }),

      on('scoreUpdated', ({ teamId, newScore }) => {
        dispatch({ type: 'UPDATE_TEAM_SCORE', payload: { teamId, newScore } });
      }),

      on('readyForNextRound', (state) => {
        dispatch({ type: 'SET_GAME_STATE', payload: state });
        setGameStatus('Setting Up');
        setShowFinishBtn(false);
        setTeamPointsAwarded({});
        setRevealedResponseTimes({});
        setPhase('roundSetup');
      }),

      on('returnedToAnswering', (state) => {
        dispatch({ type: 'SET_GAME_STATE', payload: state });
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
        const currentState = gameStateRef.current;
        if (!currentState) return;
        const updatedPlayers = currentState.players.map((p) =>
          p.socketId === socketId ? { ...p, connected: false } : p
        );
        dispatch({ type: 'UPDATE_PLAYERS', payload: updatedPlayers });
      }),

      on('error', ({ message }) => {
        showError(message);
      }),
    ];

    return () => {
      unsubscribers.forEach((unsub) => unsub());
      // Clear all pending timeouts
      pendingTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
      pendingTimeoutsRef.current.clear();
    };
  }, [on, dispatch, showError]);

  const handleStartRound = (question: string, variant: 'open_ended' | 'multiple_choice' | 'binary', options?: string[], answerForBoth?: boolean) => {
    emit('startRound', {
      question,
      variant,
      options,
      answerForBoth
    });
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

  const handleAwardPoints = (teamId: string, teamIndex: number, points: number) => {
    if (points > 0) {
      emit('awardPoint', { teamId, points });
    } else {
      emit('skipPoint', { teamId });
    }
    setTeamPointsAwarded((prev) => ({ ...prev, [teamId]: points }));
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
    // If team was awarded points, remove them
    const pointsAwarded = teamPointsAwarded[teamId] ?? 0;
    if (pointsAwarded > 0) {
      emit('removePoint', { teamId, points: pointsAwarded });
    }

    // Remove from local tracking
    setTeamPointsAwarded((prev) => {
      const updated = { ...prev };
      delete updated[teamId];
      return updated;
    });

    // Clear revealed answers and response times for this team's players
    const team = gameState?.teams.find(t => t.teamId === teamId);
    if (team && gameState?.players) {
      const player1 = findPlayerBySocketId(gameState.players, team.player1Id);
      const player2 = findPlayerBySocketId(gameState.players, team.player2Id);

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
  const submittedCount = useMemo(() => {
    if (!gameState?.currentRound) return 0;

    if (gameState.currentRound.status === 'complete') {
      return Object.keys(gameState.currentRound.answers).length;
    }
    return gameState.currentRound.submittedInCurrentPhase.length;
  }, [gameState?.currentRound]);

  if (!playerInfo || !isConnected) {
    return (
      <section className="section">
        <div className="container container-md">
          <GameTitle />
          <p className="has-text-centered">Loading...</p>
        </div>
      </section>
    );
  }

  return (
    <>
      <DebugSidebar />
      <ExitButton />
      <section className="section">
        <div className="container container-md">
          <div className="block">
            <GameTitle />
            <div className="box">
              <div className="columns is-mobile has-text-centered">
                <div className="column">
                  <p className="heading">Host</p>
                  <div className="is-flex is-justify-content-center is-align-items-center" style={{ gap: '0.25rem' }}>
                    {gameState?.host.avatar && <PlayerAvatar avatar={gameState.host.avatar} size="small" />}
                    <span className="title is-6 has-text-primary mb-0">{playerInfo.name}</span>
                  </div>
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
          <QuestionForm onSubmit={handleStartRound} onError={showError} />
        )}

        {/* Answering Phase */}
        {phase === 'answering' && gameState?.currentRound && (
          <AnsweringPhase
            question={gameState.currentRound.question}
            players={gameState.players}
            currentRound={gameState.currentRound}
            submittedCount={submittedCount}
            showAllAnswersNotification={showAllAnswersNotification}
            showReopenBtn={showReopenBtn}
            showStartScoringBtn={showStartScoringBtn}
            onReopenAnswering={handleReopenAnswering}
            onStartScoring={handleStartScoring}
          />
        )}

        {/* Scoring Phase */}
        {phase === 'scoring' && gameState?.currentRound && (
          <ScoringInterface
            teams={gameState.teams}
            players={gameState.players}
            currentRound={gameState.currentRound}
            currentTeamIndex={currentTeamIndex}
            teamPointsAwarded={teamPointsAwarded}
            revealedAnswers={revealedAnswers}
            revealedResponseTimes={revealedResponseTimes}
            showFinishBtn={showFinishBtn}
            onBackToAnswering={handleBackToAnswering}
            onRevealAnswer={handleRevealAnswer}
            onAwardPoints={handleAwardPoints}
            onReopenTeamScoring={handleReopenTeamScoring}
            onFinishRound={handleFinishRound}
          />
        )}

        {/* Scoreboard (Always Visible) */}
        <TeamScoreboard teams={gameState?.teams || []} players={gameState?.players || []} />

        <RoundControls onEndGame={handleEndGame} />

        {error && <div className="notification is-danger is-light mt-4">{error}</div>}
      </div>
      </section>
    </>
  );
}
