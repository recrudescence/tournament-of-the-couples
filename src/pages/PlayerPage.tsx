import {useEffect, useMemo, useState} from 'react';
import {useSocket} from '../hooks/useSocket';
import {usePlayerInfo} from '../hooks/usePlayerInfo';
import {useGameContext} from '../context/GameContext';
import {useGameError} from '../hooks/useGameError';
import {useWakeLock} from '../hooks/useWakeLock';
import {useTimer} from '../hooks/useTimer';
import {ExitButton} from '../components/common/ExitButton';
import {PlayerHeader} from '../components/player/PlayerHeader';
import {WaitingStatus} from '../components/player/WaitingStatus';
import {AnswerSubmissionForm} from '../components/player/AnswerSubmissionForm';
import {SubmittedStatus} from '../components/player/SubmittedStatus';
import {ScoringStatus} from '../components/player/ScoringStatus';
import {transformBinaryOptions} from '../utils/playerUtils';
import {GameTitle} from '../components/common/GameTitle';
import {TeamScoreboard} from '../components/host/TeamScoreboard';
import type {GameState} from '../types/game';

type PlayerPhase = 'waiting' | 'answering' | 'submitted' | 'scoring' | 'ended';

function derivePlayerPhase(gameState: GameState | null, playerName: string | undefined): PlayerPhase {
  if (!gameState) return 'waiting';
  if (gameState.status === 'ended') return 'ended';
  if (gameState.status === 'scoring') return 'scoring';

  if (gameState.status === 'playing') {
    if (!gameState.currentRound) return 'waiting';

    const hasSubmitted = playerName
      ? gameState.currentRound.submittedInCurrentPhase.includes(playerName)
      : false;

    if (!hasSubmitted) return 'answering';

    // Check if all non-host players have submitted
    const nonHostPlayers = gameState.players.filter(p => p.name !== gameState.host.name);
    const allAnswersIn = gameState.currentRound.submittedInCurrentPhase.length >= nonHostPlayers.length;

    return allAnswersIn ? 'scoring' : 'submitted';
  }

  return 'waiting';
}

export function PlayerPage() {
  const { isConnected, emit, on } = useSocket();
  const { playerInfo } = usePlayerInfo();
  const { gameState, dispatch, myPlayer, myTeam, myPartner } = useGameContext();
  const { requestWakeLock, isSupported: wakeLockSupported } = useWakeLock();

  // Form input state (pre-submission, genuinely local)
  const [answer, setAnswer] = useState('');
  const [selectedOption, setSelectedOption] = useState('');
  const [dualAnswers, setDualAnswers] = useState<{ self: string; partner: string }>({ self: '', partner: '' });

  // UI feedback state (ephemeral, genuinely local)
  const [isCelebrating, setIsCelebrating] = useState(false);
  const [myTeamPointsThisRound, setMyTeamPointsThisRound] = useState<number | null>(null);

  const { error, showError } = useGameError();
  const { responseTime, startTimer, stopTimer, getFinalTime } = useTimer();

  // Derive phase and round info from gameState (single source of truth)
  const phase = derivePlayerPhase(gameState, playerInfo?.name);
  const currentRound = gameState?.currentRound;
  const variant = currentRound?.variant ?? 'open_ended';
  const hasSubmitted = playerInfo?.name
    ? currentRound?.submittedInCurrentPhase.includes(playerInfo.name) ?? false
    : false;
  const submittedAnswer = playerInfo?.name
    ? currentRound?.answers?.[playerInfo.name]?.text ?? ''
    : '';

  // Transform binary options with team member names
  const options = useMemo(() => {
    if (!currentRound?.options) return null;
    return transformBinaryOptions(currentRound.options, variant, gameState?.players ?? [], myTeam);
  }, [currentRound?.options, variant, gameState?.players, myTeam]);

  // Sync sessionStorage playerInfo to GameContext on mount (handles page refresh)
  useEffect(() => {
    if (playerInfo) {
      dispatch({ type: 'SET_PLAYER_INFO', payload: playerInfo });
    }
  }, [playerInfo, dispatch]);

  // Request wake lock to prevent screen sleep during gameplay
  useEffect(() => {
    if (gameState?.status === 'playing' && wakeLockSupported) {
      requestWakeLock();
    }
  }, [gameState?.status, wakeLockSupported, requestWakeLock]);

  // Start timer when entering answering phase (on mount or when round changes)
  useEffect(() => {
    if (phase === 'answering' && currentRound?.createdAt) {
      startTimer(currentRound.createdAt);
    }
  }, [phase, currentRound?.createdAt, startTimer]);

  // Pre-fill answer from previous submission when returning to answering phase
  useEffect(() => {
    if (phase === 'answering' && playerInfo?.name && currentRound?.answers) {
      const previousAnswer = currentRound.answers[playerInfo.name];
      if (previousAnswer) {
        setAnswer(previousAnswer.text);
      }
    }
  }, [phase, playerInfo?.name, currentRound?.answers]);

  // Socket event handlers - simplified to just update gameState
  useEffect(() => {
    const unsubscribers = [
      on('joinSuccess', ({ gameState: state }) => {
        dispatch({ type: 'SET_GAME_STATE', payload: state });
      }),

      on('roundStarted', ({ gameState: state, questionCreatedAt }) => {
        if (state) {
          dispatch({ type: 'SET_GAME_STATE', payload: state });
        }
        // Reset form inputs for new round
        setAnswer('');
        setSelectedOption('');
        setDualAnswers({ self: '', partner: '' });
        setMyTeamPointsThisRound(null);
        startTimer(questionCreatedAt);
      }),

      on('answerSubmitted', ({ gameState: state }) => {
        if (state) {
          dispatch({ type: 'SET_GAME_STATE', payload: state });
        }
      }),

      on('allAnswersIn', () => {
        setMyTeamPointsThisRound(null);
      }),

      on('scoreUpdated', ({ teamId, newScore, pointsAwarded }) => {
        dispatch({ type: 'UPDATE_TEAM_SCORE', payload: { teamId, newScore } });

        // Check if this is my team (use myPlayer from closure - ok since we just need teamId match)
        if (myPlayer?.teamId === teamId) {
          setMyTeamPointsThisRound(pointsAwarded);
          if (pointsAwarded > 0) {
            setIsCelebrating(true);
            setTimeout(() => setIsCelebrating(false), 500);
          }
        }
      }),

      on('readyForNextRound', (state) => {
        dispatch({ type: 'SET_GAME_STATE', payload: state });
      }),

      on('returnedToAnswering', (state) => {
        dispatch({ type: 'SET_GAME_STATE', payload: state });
        // Pre-fill will happen via the effect above
        startTimer(state.currentRound?.createdAt);
      }),

      on('error', ({ message }) => {
        showError(message);
      }),

      on('playerDisconnected', ({ socketId }) => {
        dispatch({ type: 'SET_PLAYER_CONNECTED', payload: { socketId, connected: false } });
      }),

      on('playerReconnected', ({ gameState: state }) => {
        if (state) {
          dispatch({ type: 'SET_GAME_STATE', payload: state });
        }
      }),
    ];

    return () => unsubscribers.forEach((unsub) => unsub());
  }, [on, dispatch, showError, startTimer, myPlayer?.teamId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (hasSubmitted) {
      showError('You have already submitted an answer for this round!');
      return;
    }

    const answerForBoth = gameState?.currentRound?.answerForBoth ?? false;
    let finalAnswer: string;

    if (answerForBoth) {
      // Dual mode: validate both answers
      if (!dualAnswers.self.trim() || !dualAnswers.partner.trim()) {
        showError('Please provide answers for both players');
        return;
      }
      // Serialize as JSON with player names as keys
      const playerName = myPlayer?.name ?? '';
      const partnerName = myPartner?.name ?? '';
      finalAnswer = JSON.stringify({
        [playerName]: dualAnswers.self.trim(),
        [partnerName]: dualAnswers.partner.trim()
      });
    } else {
      // Single mode
      finalAnswer = variant === 'open_ended' ? answer : selectedOption;
      if (!finalAnswer.trim()) {
        showError('Please provide an answer');
        return;
      }
      finalAnswer = finalAnswer.trim();
    }

    stopTimer();
    const finalResponseTime = getFinalTime();

    emit('submitAnswer', {
      answer: finalAnswer,
      responseTime: finalResponseTime
    });
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

  // Use computed values from context

  return (
    <>
      <ExitButton />

      <section className="section">
        <div className="container container-md">
          <div className="block">
            <GameTitle />
            <PlayerHeader
              host={{ name: gameState?.host.name ?? '-', avatar: gameState?.host.avatar ?? null }}
              player={{ name: playerInfo.name, avatar: myPlayer?.avatar ?? null }}
              partner={{ name: myPartner?.name ?? '-', avatar: myPartner?.avatar ?? null }}
              teamScore={myTeam?.score || 0}
              isCelebrating={isCelebrating}
            />
          </div>

          {(phase === 'scoring' || phase === 'waiting') && <ScoringStatus pointsAwarded={myTeamPointsThisRound} />}

          {phase === 'waiting' && gameState?.host && (
            <WaitingStatus host={gameState.host} />
          )}

          {phase === 'answering' && (
            <AnswerSubmissionForm
              roundNumber={currentRound?.roundNumber ?? 0}
              question={currentRound?.question ?? ''}
              responseTime={responseTime}
              variant={variant}
              options={options}
              answer={answer}
              selectedOption={selectedOption}
              onAnswerChange={setAnswer}
              onOptionChange={setSelectedOption}
              onSubmit={handleSubmit}
              answerForBoth={currentRound?.answerForBoth ?? false}
              player={{ name: myPlayer?.name ?? '', avatar: myPlayer?.avatar ?? null }}
              partner={{ name: myPartner?.name ?? '', avatar: myPartner?.avatar ?? null }}
              dualAnswers={dualAnswers}
              onDualAnswerChange={(key, value) => setDualAnswers(prev => ({ ...prev, [key]: value }))}
            />
          )}

          {(phase === 'submitted' || phase === 'scoring') && (
            <SubmittedStatus
              submittedAnswer={submittedAnswer}
              partner={myPartner ? { name: myPartner.name, avatar: myPartner.avatar } : null}
              partnerSubmitted={currentRound?.answers?.[myPartner?.name ?? ''] !== undefined}
              totalAnswersCount={Object.keys(currentRound?.answers ?? {}).length}
              totalPlayersCount={gameState?.players.filter(p => p.name !== gameState?.host?.name).length ?? 0}
            />
          )}

          <TeamScoreboard teams={gameState?.teams || []} players={gameState?.players || []} />

          {error && <div className="notification is-danger is-light mt-4">{error}</div>}
        </div>
      </section>
    </>
  );
}
