import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useSocket} from '../hooks/useSocket';
import {usePlayerInfo} from '../hooks/usePlayerInfo';
import {useGameContext} from '../context/GameContext';
import {useGameError} from '../hooks/useGameError';
import {useWakeLock} from '../hooks/useWakeLock';
import {useTimer} from '../hooks/useTimer';
import {useCountdown} from '../hooks/useCountdown';
import {ExitButton} from '../components/common/ExitButton';
import {PlayerHeader} from '../components/player/PlayerHeader';
import {WaitingStatus} from '../components/player/WaitingStatus';
import {AnswerSubmissionForm} from '../components/player/AnswerSubmissionForm';
import {SubmittedStatus} from '../components/player/SubmittedStatus';
import {ScoringStatus} from '../components/player/ScoringStatus';
import {ResponsePool} from '../components/player/ResponsePool';
import {transformBinaryOptions} from '../utils/playerUtils';
import {GameTitle} from '../components/common/GameTitle';
import {TeamScoreboard} from '../components/host/TeamScoreboard';
import {GameState, RoundVariant, PoolAnswer} from '../types/game';

type PlayerPhase = 'waiting' | 'answering' | 'submitted' | 'waitingForRelease' | 'selecting' | 'picked' | 'scoring' | 'ended';

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

    // Pool selection specific phases
    if (gameState.currentRound.variant === RoundVariant.POOL_SELECTION) {
      const hasPicked = playerName
        ? (gameState.currentRound.picksSubmitted || []).includes(playerName)
        : false;

      // Use server status for reliable phase detection (survives reconnection)
      if (gameState.currentRound.status === 'selecting') {
        return hasPicked ? 'picked' : 'selecting';
      }

      // All answers in but host hasn't released pool yet
      if (allAnswersIn) {
        return 'waitingForRelease';
      }

      // Still waiting for other players to answer
      return 'submitted';
    }

    return allAnswersIn ? 'scoring' : 'submitted';
  }

  return 'waiting';
}

export function PlayerPage() {
  const navigate = useNavigate();
  const { isConnected, isReconnecting, reconnectCount, emit, on } = useSocket();
  const { playerInfo, clearPlayerInfo } = usePlayerInfo();
  const { gameState, dispatch, myPlayer, myTeam, myPartner } = useGameContext();
  const { requestWakeLock, isSupported: wakeLockSupported } = useWakeLock();

  // Form input state (pre-submission, genuinely local)
  const [answer, setAnswer] = useState('');
  const [selectedOption, setSelectedOption] = useState('');
  const [dualAnswers, setDualAnswers] = useState<{ self: string; partner: string }>({ self: '', partner: '' });

  // Ref to access current answer in countdown expiry callback
  const answerRef = useRef(answer);
  useEffect(() => { answerRef.current = answer; }, [answer]);

  // UI feedback state (ephemeral, genuinely local)
  const [myTeamPointsThisRound, setMyTeamPointsThisRound] = useState<number | null>(null);

  // Track revealed answers (reset each round)
  const [revealedAnswers, setRevealedAnswers] = useState<Record<string, { text: string; responseTime: number }>>({});

  // Track response times for ordering (player's own + partner's from answerSubmitted event)
  const [responseTimes, setResponseTimes] = useState<Record<string, number>>({});

  // Pool selection state (local state as fallback, prefer gameState.currentRound.answerPool)
  const [localAnswerPool, setLocalAnswerPool] = useState<PoolAnswer[]>([]);

  // Reveal sync state (for imported question mode)
  const [revealInfo, setRevealInfo] = useState<{
    chapterTitle?: string;
    stage: string;
    variant?: string;
  } | null>(null);

  const { error, showError } = useGameError();
  const { responseTime, startTimer, stopTimer, getFinalTime } = useTimer();

  // Ref to track if auto-submit has been triggered (prevents duplicate submissions)
  const autoSubmittedRef = useRef(false);

  // Auto-submit handler for countdown expiry (pool selection)
  const handleCountdownExpire = useCallback(() => {
    if (autoSubmittedRef.current) return;
    autoSubmittedRef.current = true;
    const currentAnswer = answerRef.current.trim();
    emit('submitAnswer', { answer: currentAnswer, responseTime: 60000 });
  }, [emit]);

  // Countdown for pool selection rounds
  const {
    remaining: countdownRemaining,
    isExpired: countdownExpired,
    start: startCountdown,
    stop: stopCountdown,
    reset: resetCountdown
  } = useCountdown({ onExpire: handleCountdownExpire });

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

  // Pool selection: prefer server-stored pool (survives refresh) over local state
  const answerPool = currentRound?.answerPool ?? localAnswerPool;


  // Sync sessionStorage playerInfo to GameContext on mount (handles page refresh)
  useEffect(() => {
    if (playerInfo) {
      dispatch({ type: 'SET_PLAYER_INFO', payload: playerInfo });
    }
  }, [playerInfo, dispatch]);

  // Track if we've joined this session (to avoid duplicate joins)
  const hasJoinedRef = useRef(false);

  // Join game on initial mount (handles page refresh only)
  // Skip if gameState already exists (came from LobbyPage transition, not a refresh)
  useEffect(() => {
    if (!hasJoinedRef.current && isConnected && playerInfo?.roomCode && !gameState) {
      hasJoinedRef.current = true;
      console.log('Joining game on mount (page refresh)...');
      emit('joinGame', {
        roomCode: playerInfo.roomCode,
        name: playerInfo.name,
        isHost: playerInfo.isHost,
        isReconnect: true,
      });
    }
  }, [isConnected, playerInfo, gameState, emit]);

  // Re-join game on socket reconnection (handles network drops)
  useEffect(() => {
    if (reconnectCount > 0 && playerInfo?.roomCode) {
      console.log('Socket reconnected, re-joining game...');
      emit('joinGame', {
        roomCode: playerInfo.roomCode,
        name: playerInfo.name,
        isHost: playerInfo.isHost,
        isReconnect: true,
      });
    }
  }, [reconnectCount, playerInfo, emit]);

  // Initialize reveal info from gameState on mount (handles race when gameStarted
  // includes cursor data but cursorAdvanced event was not emitted separately)
  useEffect(() => {
    if (gameState?.importedQuestions && gameState.questionCursor && !gameState.currentRound) {
      const cursor = gameState.questionCursor;
      const chapter = gameState.importedQuestions.chapters[cursor.chapterIndex];
      if (chapter) {
        setRevealInfo({ chapterTitle: chapter.title, stage: 'chapter_title' });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // Request wake lock to prevent screen sleep during gameplay
  useEffect(() => {
    if (gameState?.status === 'playing' && wakeLockSupported) {
      requestWakeLock();
    }
  }, [gameState?.status, wakeLockSupported, requestWakeLock]);

  // Start timer when entering answering phase (on mount or when round changes)
  // Pool selection uses countdown, other variants use count-up timer
  useEffect(() => {
    if (phase === 'answering' && currentRound?.createdAt) {
      autoSubmittedRef.current = false; // Reset auto-submit flag for new round
      if (currentRound.variant === RoundVariant.POOL_SELECTION) {
        startCountdown(currentRound.createdAt);
      } else {
        startTimer(currentRound.createdAt);
      }
    }
  }, [phase, currentRound?.createdAt, currentRound?.variant, startTimer, startCountdown]);


  // Pre-fill answer from previous submission when returning to answering phase
  // Only runs when phase changes to 'answering' (not when other players submit)
  useEffect(() => {
    if (phase === 'answering' && playerInfo?.name && currentRound?.answers) {
      const previousAnswer = currentRound.answers[playerInfo.name];
      if (previousAnswer) {
        setAnswer(previousAnswer.text);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, playerInfo?.name, currentRound?.roundNumber]);

  // Track last known round number to detect missed rounds on reconnect
  const lastKnownRoundRef = useRef<number | null>(null);

  // Socket event handlers - simplified to just update gameState
  useEffect(() => {
    // Helper to reset all round-related local state
    const resetRoundState = () => {
      setAnswer('');
      setSelectedOption('');
      setDualAnswers({ self: '', partner: '' });
      setMyTeamPointsThisRound(null);
      setRevealedAnswers({});
      setResponseTimes({});
      setLocalAnswerPool([]);
      setRevealInfo(null);
      resetCountdown();
    };

    const unsubscribers = [
      on('joinSuccess', ({ gameState: state }) => {
        dispatch({ type: 'SET_GAME_STATE', payload: state });

        // If reconnecting to an active round we haven't seen before, reset form state
        // (handles case where player missed roundStarted event while disconnected)
        const currentRoundNum = state.currentRound?.roundNumber ?? null;
        if (currentRoundNum !== null && currentRoundNum !== lastKnownRoundRef.current) {
          lastKnownRoundRef.current = currentRoundNum;
          resetRoundState();
          // Start timer from the round's creation time
          if (state.currentRound?.createdAt) {
            if (state.currentRound.variant === RoundVariant.POOL_SELECTION) {
              startCountdown(state.currentRound.createdAt);
            } else {
              startTimer(state.currentRound.createdAt);
            }
          }
        }
      }),

      on('roundStarted', ({ gameState: state, questionCreatedAt }) => {
        if (state) {
          dispatch({ type: 'SET_GAME_STATE', payload: state });
          lastKnownRoundRef.current = state.currentRound?.roundNumber ?? null;
        }
        resetRoundState();
        startTimer(questionCreatedAt);
      }),

      // Imported question mode: cursor advanced (chapter/question reveal starting)
      on('cursorAdvanced', ({ chapter, gameState: state }) => {
        if (state) {
          dispatch({ type: 'SET_GAME_STATE', payload: state });
        }
        setRevealInfo({ chapterTitle: chapter.title, stage: 'chapter_title' });
      }),

      // Imported question mode: reveal stage updates
      on('revealUpdate', ({ stage, chapterTitle, variant }) => {
        if (stage === 'answering') {
          setRevealInfo(null); // Round is about to start
        } else if (stage === 'question_text') {
          // Skip question_text stage - players see question for first time when answering opens
          return;
        } else {
          setRevealInfo(prev => ({
            ...prev,
            stage,
            ...(chapterTitle && { chapterTitle }),
            ...(variant && { variant })
          }));
        }
      }),

      on('answerSubmitted', ({ playerName, responseTime, gameState: state }) => {
        if (state) {
          dispatch({ type: 'SET_GAME_STATE', payload: state });
        }
        // Track response time for ordering
        setResponseTimes(prev => ({ ...prev, [playerName]: responseTime }));
      }),

      on('allAnswersIn', () => {
        setMyTeamPointsThisRound(null);
      }),

      // Pool selection events
      on('poolReady', ({ answers, gameState: state }) => {
        setLocalAnswerPool(answers);
        if (state) {
          dispatch({ type: 'SET_GAME_STATE', payload: state });
        }
      }),

      on('pickSubmitted', ({ gameState: state }) => {
        if (state) {
          dispatch({ type: 'SET_GAME_STATE', payload: state });
        }
      }),

      on('allPicksIn', () => {
        // Phase will transition to scoring via gameState update
      }),

      on('scoringStarted', (state) => {
        dispatch({ type: 'SET_GAME_STATE', payload: state });
        setMyTeamPointsThisRound(null);
      }),

      on('answerRevealed', ({ playerName, responderName, answer, responseTime }) => {
        // Use responderName for dual mode (composite key), fall back to playerName for single mode
        const key = responderName ?? playerName;
        setRevealedAnswers(prev => ({
          ...prev,
          [key]: { text: answer, responseTime }
        }));
      }),

      on('scoreUpdated', ({ teamId, newScore, pointsAwarded }) => {
        dispatch({ type: 'UPDATE_TEAM_SCORE', payload: { teamId, newScore } });

        // Check if this is my team (use myPlayer from closure - ok since we just need teamId match)
        if (myPlayer?.teamId === teamId) {
          // Negative pointsAwarded means host is re-scoring - reset to waiting state
          if (pointsAwarded < 0) {
            setMyTeamPointsThisRound(null);
          } else {
            // Accumulate points (pool mode may award multiple times per round)
            setMyTeamPointsThisRound(prev => (prev ?? 0) + pointsAwarded);
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

      on('playerKicked', () => {
        clearPlayerInfo();
        navigate('/', { state: { kicked: true } });
      }),

      on('gameReset', (state) => {
        dispatch({ type: 'SET_GAME_STATE', payload: state });
        navigate('/game?room=' + state.roomCode);
      }),

      // Host controls: Question management events
      on('questionReset', ({ gameState: state }) => {
        if (state) {
          dispatch({ type: 'SET_GAME_STATE', payload: state });
        }
        resetRoundState();
      }),

      on('questionRestarted', ({ cursorData, gameState: state }) => {
        if (state) {
          dispatch({ type: 'SET_GAME_STATE', payload: state });
        }
        resetRoundState();
        if (cursorData) {
          setRevealInfo({
            chapterTitle: cursorData.chapter.title,
            stage: cursorData.isNewChapter ? 'chapter_title' : 'variant_context'
          });
        }
      }),

      on('cursorChanged', ({ cursorData, gameState: state }) => {
        if (state) {
          dispatch({ type: 'SET_GAME_STATE', payload: state });
        }
        resetRoundState();
        if (cursorData) {
          setRevealInfo({
            chapterTitle: cursorData.chapter.title,
            stage: cursorData.isNewChapter ? 'chapter_title' : 'variant_context'
          });
        }
      }),
    ];

    return () => unsubscribers.forEach((unsub) => unsub());
  }, [on, dispatch, showError, startTimer, startCountdown, resetCountdown, myPlayer?.teamId, clearPlayerInfo, navigate]);

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
      const usesTextInput = variant === 'open_ended' || variant === RoundVariant.POOL_SELECTION;
      finalAnswer = usesTextInput ? answer : selectedOption;
      if (!finalAnswer.trim()) {
        showError('Please provide an answer');
        return;
      }
      finalAnswer = finalAnswer.trim();
    }

    // Pool selection uses countdown; others use count-up timer
    if (variant === RoundVariant.POOL_SELECTION) {
      stopCountdown();
      // Response time is how much of the 60s was used (60000 - remaining)
      const finalResponseTime = 60000 - countdownRemaining;
      emit('submitAnswer', {
        answer: finalAnswer,
        responseTime: finalResponseTime
      });
    } else {
      stopTimer();
      const finalResponseTime = getFinalTime();
      emit('submitAnswer', {
        answer: finalAnswer,
        responseTime: finalResponseTime
      });
    }
  };

  const handlePick = (pickedAnswer: string) => {
    emit('submitPick', { pickedAnswer });
  };

  if (!playerInfo || !isConnected) {
    return (
      <section className="section">
        <div className="container container-md">
          <GameTitle compact />
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
            <GameTitle host={{ name: gameState?.host.name ?? '-', avatar: gameState?.host.avatar ?? null }} compact />
            <PlayerHeader
              shouldHighlightYou={false}
              player={{ name: playerInfo.name, avatar: myPlayer?.avatar ?? null }}
              partner={{ name: myPartner?.name ?? '-', avatar: myPartner?.avatar ?? null }}
            />
          </div>

          {isReconnecting && (
            <div className="notification is-warning has-text-centered mb-4">
              Connection lost - reconnecting...
            </div>
          )}
          {phase === 'waiting' && gameState?.host && (
            <WaitingStatus
              host={gameState.host}
              isInitialRound={gameState.lastRoundNumber === 0}
              revealInfo={revealInfo}
            />
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
              countdown={variant === RoundVariant.POOL_SELECTION ? countdownRemaining : undefined}
              isExpired={variant === RoundVariant.POOL_SELECTION ? countdownExpired : undefined}
            />
          )}

          {/* Pool selection: waiting for others to submit before pool is ready */}
          {phase === 'submitted' && currentRound?.variant === RoundVariant.POOL_SELECTION && (
            <div className="box has-text-centered">
              <h3 className="title is-5 mb-3">Answer Submitted!</h3>
              <p className="subtitle is-6 has-text-grey mb-4">
                Waiting for other players to submit their answers...
              </p>
              <progress className="progress is-info" max="100" />
            </div>
          )}

          {/* Pool selection: all answers in, waiting for host to release */}
          {phase === 'waitingForRelease' && (
            <div className="box has-text-centered">
              <h3 className="title is-5 mb-3">All Answers In!</h3>
              <p className="subtitle is-6 has-text-grey mb-4">
                Waiting for host to reveal the answer pool...
              </p>
              <progress className="progress is-success" max="100" />
            </div>
          )}

          {(phase === 'selecting' || phase === 'picked') && answerPool.length > 0 && (
            <ResponsePool
              answers={answerPool}
              myPlayerName={playerInfo?.name ?? ''}
              partnerName={myPartner?.name ?? ''}
              partnerAvatar={myPartner?.avatar ?? null}
              hasPicked={phase === 'picked'}
              onPick={handlePick}
            />
          )}

          {(phase === 'submitted' || phase === 'scoring') && currentRound?.variant !== RoundVariant.POOL_SELECTION && (
            <SubmittedStatus
              questionText={currentRound?.question ?? ''}
              submittedAnswer={submittedAnswer}
              host={{ name: gameState?.host.name ?? '', avatar: gameState?.host.avatar ?? null }}
              player={{ name: playerInfo.name, avatar: myPlayer?.avatar ?? null }}
              playerResponseTime={responseTimes[playerInfo.name] ?? null}
              partner={myPartner ? { name: myPartner.name, avatar: myPartner.avatar } : null}
              partnerSubmitted={currentRound?.answers?.[myPartner?.name ?? ''] !== undefined}
              partnerAnswer={revealedAnswers[myPartner?.name ?? '']?.text ?? null}
              partnerResponseTime={responseTimes[myPartner?.name ?? ''] ?? null}
              totalAnswersCount={Object.keys(currentRound?.answers ?? {}).length}
              totalPlayersCount={gameState?.players.filter(p => p.name !== gameState?.host?.name).length ?? 0}
            />
          )}

          {(phase === 'scoring') && <ScoringStatus pointsAwarded={myTeamPointsThisRound} />}

          <TeamScoreboard
            teams={gameState?.teams || []}
            players={gameState?.players || []}
            responseTimes={gameState?.teamTotalResponseTimes}
          />

          {error && <div className="notification is-danger is-light mt-4">{error}</div>}
        </div>
      </section>
    </>
  );
}
