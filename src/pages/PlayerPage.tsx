import { useEffect, useState, useRef } from 'react';
import { useSocket } from '../hooks/useSocket';
import { usePlayerInfo } from '../hooks/usePlayerInfo';
import { useGameContext } from '../context/GameContext';
import { useGameError } from '../hooks/useGameError';
import { useWakeLock } from '../hooks/useWakeLock';
import { useTimer } from '../hooks/useTimer';
import { ExitButton } from '../components/common/ExitButton';
import { PlayerHeader } from '../components/player/PlayerHeader';
import { WaitingStatus } from '../components/player/WaitingStatus';
import { AnswerSubmissionForm } from '../components/player/AnswerSubmissionForm';
import { SubmittedStatus } from '../components/player/SubmittedStatus';
import { ScoringStatus } from '../components/player/ScoringStatus';
import { transformBinaryOptions } from '../utils/playerUtils';
import { GameTitle } from '../components/common/GameTitle';
import { TeamScoreboard } from '../components/host/TeamScoreboard';

type PlayerSection = 'waiting' | 'answering' | 'submitted' | 'scoring';

export function PlayerPage() {
  const { isConnected, emit, on } = useSocket();
  const { playerInfo } = usePlayerInfo();
  const { gameState, dispatch, myPlayer, myTeam, myPartner } = useGameContext();
  const { requestWakeLock, isSupported: wakeLockSupported } = useWakeLock();

  const [section, setSection] = useState<PlayerSection>('waiting');
  const [answer, setAnswer] = useState('');
  const [submittedAnswer, setSubmittedAnswer] = useState('');
  const [isCelebrating, setIsCelebrating] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Refs to access latest state in socket handlers without causing re-subscriptions
  const gameStateRef = useRef(gameState);
  const playerInfoRef = useRef(playerInfo);
  const myPlayerRef = useRef(myPlayer);
  const hasSubmittedRef = useRef(hasSubmitted);

  const { error, showError } = useGameError();
  const { responseTime, startTimer, stopTimer, getFinalTime } = useTimer();
  const [variant, setVariant] = useState<string>('open_ended');
  const [options, setOptions] = useState<string[] | null>(null);
  const [selectedOption, setSelectedOption] = useState<string>('');
  // Dual answer mode state (when answerForBoth is true)
  const [dualAnswers, setDualAnswers] = useState<{ self: string; partner: string }>({ self: '', partner: '' });
  // Points feedback: null = not scored yet, number = points awarded this round
  const [myTeamPointsThisRound, setMyTeamPointsThisRound] = useState<number | null>(null);

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

  // Keep refs in sync with state for socket handlers
  useEffect(() => {
    gameStateRef.current = gameState;
    playerInfoRef.current = playerInfo;
    myPlayerRef.current = myPlayer;
    hasSubmittedRef.current = hasSubmitted;
  }, [gameState, playerInfo, myPlayer, hasSubmitted]);

  // Initialize from GameContext when PlayerPage mounts (handles reconnection)
  useEffect(() => {
    if (!gameState || !playerInfo) return;

    dispatch({ type: 'SET_GAME_STATE', payload: gameState });

    // Check game status - now currentRound is null when status is 'playing'
    if (gameState.status === 'playing') {
      if (!gameState.currentRound) {
        // Host is setting up the next round
        setSection('waiting');
      } else {
        // Round is active - check if player has submitted in current phase
        const roundVariant = gameState.currentRound.variant;
        setVariant(roundVariant);

        // For binary: replace placeholders with actual team member names
        setOptions(transformBinaryOptions(
          gameState.currentRound.options,
          roundVariant,
          gameState.players,
          myTeam
        ));

        const previousAnswer = gameState.currentRound.answers?.[playerInfo.name];
        const hasSubmittedInCurrentPhase = gameState.currentRound.submittedInCurrentPhase.includes(playerInfo.name);

        if (hasSubmittedInCurrentPhase) {
          // Player has submitted in the current phase
          setAnswer(previousAnswer?.text ?? '');
          setSubmittedAnswer(previousAnswer?.text ?? '');
          setHasSubmitted(true);
          setSection('submitted');
        } else {
          // Player hasn't submitted in current phase (may have old answer from reopened round)
          setAnswer(previousAnswer?.text ?? ''); // Pre-fill with previous answer if exists
          setHasSubmitted(false);
          setSection('answering');
          // Start timer from server timestamp to maintain accurate timing across reconnection
          startTimer(gameState.currentRound.createdAt);
        }
      }
      return;
    }

    // If we're in scoring status, show scoring screen
    if (gameState.status === 'scoring' && gameState.currentRound) {
      const roundVariant = gameState.currentRound.variant;
      setVariant(roundVariant);

      // For binary: replace placeholders with actual team member names
      setOptions(transformBinaryOptions(
        gameState.currentRound.options,
        roundVariant,
        gameState.players,
        myTeam
      ));

      const previousAnswer = gameState.currentRound.answers?.[playerInfo.name];
      if (previousAnswer) {
        setSubmittedAnswer(previousAnswer.text);
      }
      setSection('scoring');
      return;
    }

    // Default to waiting
    setSection('waiting');
  }, [startTimer]); // Only run on mount (startTimer is stable)

  // Socket event handlers - use refs to access latest state without causing re-subscriptions
  useEffect(() => {
    const unsubscribers = [
      on('joinSuccess', ({ gameState: state }) => {
        dispatch({ type: 'SET_GAME_STATE', payload: state });
      }),

      on('roundStarted', ({ gameState: state, variant: v, options: opts, questionCreatedAt }) => {
        if (state) {
          dispatch({ type: 'SET_GAME_STATE', payload: state });
        }

        setVariant(v);

        // For binary: replace placeholders with actual team member names
        const pInfo = playerInfoRef.current;
        const gState = state ?? gameStateRef.current;
        if (v === 'binary' && opts && pInfo && gState) {
          const players = gState.players;
          const teams = gState.teams;
          const currentPlayer = players.find(p => p.name === pInfo.name);
          const currentTeam = currentPlayer
            ? teams.find(t => t.player1Id === currentPlayer.socketId || t.player2Id === currentPlayer.socketId)
            : null;

          setOptions(transformBinaryOptions(opts, v, players, currentTeam ?? null));
        } else {
          setOptions(opts);
        }

        setAnswer('');
        setSelectedOption('');
        setDualAnswers({ self: '', partner: '' });
        setHasSubmitted(false);
        setMyTeamPointsThisRound(null);
        setSection('answering');
        startTimer(questionCreatedAt);
      }),

      on('answerSubmitted', ({ playerName, answer: ans, gameState: state }) => {
        if (state) {
          dispatch({ type: 'SET_GAME_STATE', payload: state });
        }
        if (playerName === playerInfoRef.current?.name) {
          setHasSubmitted(true);
          setSubmittedAnswer(ans);
          setSection('submitted');
        }
      }),

      on('allAnswersIn', () => {
        setMyTeamPointsThisRound(null);
        setSection('scoring');
      }),

      on('scoreUpdated', ({ teamId, newScore, pointsAwarded }) => {
        dispatch({ type: 'UPDATE_TEAM_SCORE', payload: { teamId, newScore } });

        // Check if this is my team
        if (myPlayerRef.current?.teamId === teamId) {
          setMyTeamPointsThisRound(pointsAwarded);
          if (pointsAwarded > 0) {
            setIsCelebrating(true);
            setTimeout(() => setIsCelebrating(false), 500);
          }
        }
      }),

      on('readyForNextRound', (state) => {
        dispatch({ type: 'SET_GAME_STATE', payload: state });
        setSection('waiting');
      }),

      on('returnedToAnswering', (state) => {
        dispatch({ type: 'SET_GAME_STATE', payload: state });

        const pInfo = playerInfoRef.current;
        if (state.currentRound?.answers && pInfo) {
          const previousAnswer = state.currentRound.answers[pInfo.name];
          if (previousAnswer) {
            setAnswer(previousAnswer.text);
          } else {
            setAnswer('');
          }
        } else {
          setAnswer('');
        }
        setHasSubmitted(false);
        setSection('answering');
        startTimer(state.currentRound?.createdAt);
      }),

      on('error', ({ message }) => {
        showError(message);
        if (hasSubmittedRef.current) {
          setHasSubmitted(false);
          setSection('answering');
        }
      }),

      on('playerDisconnected', ({ socketId }) => {
        const gState = gameStateRef.current;
        if (!gState) return;
        const updatedPlayers = gState.players.map((p) =>
          p.socketId === socketId ? { ...p, connected: false } : p
        );
        dispatch({ type: 'UPDATE_PLAYERS', payload: updatedPlayers });
      }),

      on('playerReconnected', ({ gameState: state }) => {
        if (state) {
          dispatch({ type: 'SET_GAME_STATE', payload: state });
        }
      }),
    ];

    return () => unsubscribers.forEach((unsub) => unsub());
  }, [on, dispatch, showError, startTimer]);

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

          {section === 'waiting' && (
            <WaitingStatus hostName={gameState?.host.name ?? 'host'} />
          )}

          {section === 'answering' && (
            <AnswerSubmissionForm
              roundNumber={gameState?.currentRound?.roundNumber || 0}
              question={gameState?.currentRound?.question || ''}
              responseTime={responseTime}
              variant={variant}
              options={options}
              answer={answer}
              selectedOption={selectedOption}
              onAnswerChange={setAnswer}
              onOptionChange={setSelectedOption}
              onSubmit={handleSubmit}
              answerForBoth={gameState?.currentRound?.answerForBoth ?? false}
              player={{ name: myPlayer?.name ?? '', avatar: myPlayer?.avatar ?? null }}
              partner={{ name: myPartner?.name ?? '', avatar: myPartner?.avatar ?? null }}
              dualAnswers={dualAnswers}
              onDualAnswerChange={(key, value) => setDualAnswers(prev => ({ ...prev, [key]: value }))}
            />
          )}

          {section === 'submitted' && (
            <SubmittedStatus
              submittedAnswer={submittedAnswer}
              partner={myPartner ? { name: myPartner.name, avatar: myPartner.avatar } : null}
              partnerSubmitted={gameState?.currentRound?.answers?.[myPartner?.name ?? ''] !== undefined}
              totalAnswersCount={Object.keys(gameState?.currentRound?.answers ?? {}).length}
              totalPlayersCount={gameState?.players.filter(p => p.name !== gameState?.host?.name).length ?? 0}
            />
          )}

          {section === 'scoring' && <ScoringStatus pointsAwarded={myTeamPointsThisRound} />}

          <TeamScoreboard teams={gameState?.teams || []} players={gameState?.players || []} />

          {error && <div className="notification is-danger is-light mt-4">{error}</div>}
        </div>
      </section>
    </>
  );
}
