import {useEffect, useMemo, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useSocket} from '../hooks/useSocket';
import {usePlayerInfo} from '../hooks/usePlayerInfo';
import {useGameContext} from '../context/GameContext';
import {useGameError} from '../hooks/useGameError';
import {ExitButton} from '../components/common/ExitButton';
import {QuestionForm} from '../components/host/QuestionForm';
import {AnsweringPhase} from '../components/host/AnsweringPhase';
import {ScoringInterface} from '../components/host/ScoringInterface';
import {TeamScoreboard} from '../components/host/TeamScoreboard';
import {RoundControls} from '../components/host/RoundControls';
import {type GameState} from '../types/game';
import {findPlayerBySocketId} from '../utils/playerUtils';
import {GameTitle} from '../components/common/GameTitle';
import {HostHeader} from "../components/host/HostHeader.tsx";

type HostPhase = 'roundSetup' | 'answering' | 'scoring';

export function HostPage() {
  const navigate = useNavigate();
  const { isConnected, emit, on } = useSocket();
  const { playerInfo } = usePlayerInfo();
  const { gameState, dispatch } = useGameContext();
  const { error, showError } = useGameError();

  const [phase, setPhase] = useState<HostPhase>('roundSetup');
  const [roundNumber, setRoundNumber] = useState(1);
  const [showFinishBtn, setShowFinishBtn] = useState(false);
  const [teamPointsAwarded, setTeamPointsAwarded] = useState<Record<string, number>>({});
  const [revealedResponseTimes, setRevealedResponseTimes] = useState<Record<string, number>>({});

  // UI-only state
  const [currentTeamIndex, setCurrentTeamIndex] = useState(0);
  const [revealedAnswers, setRevealedAnswers] = useState<Set<string>>(new Set());

  // Derived values
  const playerCount = gameState?.players.length ?? 0;
  const submittedCount = gameState?.currentRound?.submittedInCurrentPhase.length ?? 0;
  const allAnswersIn = phase === 'answering' && playerCount > 0 && submittedCount >= playerCount;

  const gameStatus = useMemo(() => {
    if (phase === 'roundSetup') return 'Setting Up';
    if (phase === 'scoring') return 'Scoring';
    if (allAnswersIn) return 'All Answers In';
    return 'Answering';
  }, [phase, allAnswersIn]);

  // Initialize phase from gameState on mount
  useEffect(() => {
    if (gameState?.currentRound) {
      setRoundNumber(gameState.currentRound.roundNumber);
      if (gameState.status === 'scoring' || gameState.currentRound.status === 'complete') {
        setPhase('scoring');
      } else if (gameState.currentRound.status === 'answering') {
        setPhase('answering');
      }
    } else if (gameState?.status === 'playing') {
      // Use lastRoundNumber for reconnection when between rounds
      if (gameState.lastRoundNumber) {
        setRoundNumber(gameState.lastRoundNumber);
      }
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
          if (state.currentRound?.roundNumber) {
            setRoundNumber(state.currentRound.roundNumber);
          }
        }
        setRevealedAnswers(new Set());
        setPhase('answering');
      }),

      on('answerSubmitted', ({ gameState: state }) => {
        if (state) {
          dispatch({ type: 'SET_GAME_STATE', payload: state });
        }
      }),

      // allAnswersIn is now derived from gameState, no handler needed

      on('scoringStarted', (state) => {
        dispatch({ type: 'SET_GAME_STATE', payload: state });
      }),

      on('answerRevealed', ({ playerName, responseTime }) => {
        setRevealedAnswers((prev) => new Set([...prev, playerName]));
        setRevealedResponseTimes((prev) => ({
          ...prev,
          [playerName]: responseTime
        }));
      }),

      on('scoreUpdated', ({ teamId, newScore }) => {
        dispatch({ type: 'UPDATE_TEAM_SCORE', payload: { teamId, newScore } });
      }),

      on('readyForNextRound', (state) => {
        dispatch({ type: 'SET_GAME_STATE', payload: state });
        setRoundNumber(prev => prev + 1);
        setShowFinishBtn(false);
        setTeamPointsAwarded({});
        setRevealedResponseTimes({});
        setPhase('roundSetup');
      }),

      on('returnedToAnswering', (state) => {
        dispatch({ type: 'SET_GAME_STATE', payload: state });
        setPhase('answering');
      }),

      on('lobbyUpdate', (data) => {
        const state = (data as { gameState?: GameState }).gameState || data;
        dispatch({ type: 'SET_GAME_STATE', payload: state });
      }),

      on('gameReset', (state) => {
        dispatch({ type: 'SET_GAME_STATE', payload: state });
        navigate('/game?room=' + state.roomCode);
      }),

      on('playerDisconnected', ({ socketId }) => {
        dispatch({ type: 'SET_PLAYER_CONNECTED', payload: { socketId, connected: false } });
      }),

      on('error', ({ message }) => {
        showError(message);
      }),
    ];

    return () => unsubscribers.forEach((unsub) => unsub());
  }, [on, dispatch, showError, navigate]);

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
    setTeamPointsAwarded({});
    setRevealedResponseTimes({});
    setShowFinishBtn(false);
    setPhase('scoring');
    // Notify server/players that scoring has begun
    emit('startScoring');
  };

  const handleBackToAnswering = () => {
    // Just navigate back to answering view (UI only)
    // allAnswersIn will still be true since answers haven't been cleared
    setPhase('answering');
  };

  const handleReopenAnswering = () => {
    // Server clears submittedInCurrentPhase, which makes allAnswersIn false
    emit('backToAnswering');
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
      const isDualMode = gameState?.currentRound?.answerForBoth;

      const newRevealedAnswers = new Set(revealedAnswers);
      if (player1 && player2 && isDualMode) {
        // Dual mode: clear all 4 composite keys
        newRevealedAnswers.delete(`${player1.name}:${player1.name}`);
        newRevealedAnswers.delete(`${player1.name}:${player2.name}`);
        newRevealedAnswers.delete(`${player2.name}:${player1.name}`);
        newRevealedAnswers.delete(`${player2.name}:${player2.name}`);
      } else {
        // Single mode: clear by player name
        if (player1) newRevealedAnswers.delete(player1.name);
        if (player2) newRevealedAnswers.delete(player2.name);
      }
      setRevealedAnswers(newRevealedAnswers);
      setCurrentTeamIndex(teamIndex);

      // Clear response times for these players (keyed by composite or simple name)
      setRevealedResponseTimes((prev) => {
        const updated = { ...prev };
        if (player1 && player2 && isDualMode) {
          delete updated[`${player1.name}:${player1.name}`];
          delete updated[`${player1.name}:${player2.name}`];
          delete updated[`${player2.name}:${player1.name}`];
          delete updated[`${player2.name}:${player2.name}`];
        } else {
          if (player1) delete updated[player1.name];
          if (player2) delete updated[player2.name];
        }
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

  const handleResetGame = () => {
    if (window.confirm('Are you sure you want to reset the game? This will return everyone to the lobby with scores reset to 0.')) {
      emit('resetGame');
    }
  };

  const handleKickPlayer = (socketId: string) => {
    emit('kickPlayer', { targetSocketId: socketId });
  };

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
      <ExitButton />
      <section className="section">
        <div className="container container-host">
          <GameTitle />

          <div className="columns is-desktop">
            {/* Main content (DOM first for mobile) */}
            <div className="column">
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
                  allAnswersIn={allAnswersIn}
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

              <RoundControls
                players={gameState?.players || []}
                phase={phase}
                allAnswersIn={allAnswersIn}
                onKickPlayer={handleKickPlayer}
                onReopenAnswering={handleReopenAnswering}
                onStartScoring={handleStartScoring}
                onResetGame={handleResetGame}
              />

              {error && <div className="notification is-danger is-light mt-4">{error}</div>}
            </div>

            {/* Sidebar: Scoreboard (DOM second, visually left on desktop via order) */}
            <div className="column is-4-desktop host-sidebar">
              <HostHeader
                hostName={gameState?.host.name ?? '-'}
                hostAvatar={gameState?.host.avatar}
                roundNumber={roundNumber}
                gameStatus={gameStatus}
              />
              <div className="host-sidebar-sticky">
                <TeamScoreboard
                  teams={gameState?.teams || []}
                  players={gameState?.players || []}
                  responseTimes={gameState?.teamTotalResponseTimes}
                  onEndGame={handleEndGame}
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
