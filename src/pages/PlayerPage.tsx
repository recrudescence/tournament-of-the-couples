import { useEffect, useState } from 'react';
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
import { findPlayerBySocketId } from '../utils/playerUtils';

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
  const { error, showError } = useGameError();
  const { responseTime, startTimer, stopTimer, getFinalTime } = useTimer();
  const [variant, setVariant] = useState<string>('open_ended');
  const [options, setOptions] = useState<string[] | null>(null);
  const [selectedOption, setSelectedOption] = useState<string>('');

  // Request wake lock to prevent screen sleep during gameplay
  useEffect(() => {
    if (gameState?.status === 'playing' && wakeLockSupported) {
      requestWakeLock();
    }
  }, [gameState?.status, wakeLockSupported, requestWakeLock]);

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
        // Round is active - check if player has submitted
        setVariant(gameState.currentRound.variant);
        setOptions(gameState.currentRound.options);
        const previousAnswer = gameState.currentRound.answers?.[playerInfo.name];

        if (previousAnswer) {
          // Player has already submitted
          setAnswer(previousAnswer.text);
          setSubmittedAnswer(previousAnswer.text);
          setHasSubmitted(true);
          setSection('submitted');
        } else {
          // Player hasn't submitted yet
          setAnswer('');
          setHasSubmitted(false);
          setSection('answering');
        }
      }
      return;
    }

    // If we're in scoring status, show scoring screen
    if (gameState.status === 'scoring' && gameState.currentRound) {
      setVariant(gameState.currentRound.variant);
      setOptions(gameState.currentRound.options);
      const previousAnswer = gameState.currentRound.answers?.[playerInfo.name];
      if (previousAnswer) {
        setSubmittedAnswer(previousAnswer.text);
      }
      setSection('scoring');
      return;
    }

    // Default to waiting
    setSection('waiting');
  }, []); // Only run on mount

  // Socket event handlers
  useEffect(() => {
    const unsubscribers = [
      on('joinSuccess', ({ gameState: state }) => {
        dispatch({ type: 'SET_GAME_STATE', payload: state });
      }),

      on('roundStarted', ({ gameState: state, variant: v, options: opts }) => {
        if (state) {
          dispatch({ type: 'SET_GAME_STATE', payload: state });
        }

        setVariant(v);

        // For binary: replace placeholders with actual team member names
        if (v === 'binary' && opts && myPlayer && myTeam && gameState?.players) {
          const player1 = findPlayerBySocketId(gameState.players, myTeam.player1Id);
          const player2 = findPlayerBySocketId(gameState.players, myTeam.player2Id);
          setOptions([player1?.name ?? 'Player 1', player2?.name ?? 'Player 2']);
        } else {
          setOptions(opts);
        }

        setAnswer('');
        setSelectedOption('');
        setHasSubmitted(false);
        setSection('answering');
        startTimer();
      }),

      on('answerSubmitted', ({ playerName, answer: ans, gameState: state }) => {
        if (state) {
          dispatch({ type: 'SET_GAME_STATE', payload: state });
        }
        if (playerName === playerInfo?.name) {
          setHasSubmitted(true);
          setSubmittedAnswer(ans);
          setSection('submitted');
        }
      }),

      on('allAnswersIn', () => {
        setSection('scoring');
      }),

      on('scoreUpdated', ({ teamId, newScore }) => {
        dispatch({ type: 'UPDATE_TEAM_SCORE', payload: { teamId, newScore } });

        // Check if this is my team
        if (myPlayer?.teamId === teamId) {
          setIsCelebrating(true);
          setTimeout(() => setIsCelebrating(false), 500);
        }
      }),

      on('readyForNextRound', (state) => {
        dispatch({ type: 'SET_GAME_STATE', payload: state });
        setSection('waiting');
      }),

      on('returnedToAnswering', (state) => {
        dispatch({ type: 'SET_GAME_STATE', payload: state });

        if (state.currentRound?.answers && playerInfo) {
          const previousAnswer = state.currentRound.answers[playerInfo.name];
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
        startTimer();
      }),

      on('error', ({ message }) => {
        showError(message);
        if (hasSubmitted) {
          setHasSubmitted(false);
          setSection('answering');
        }
      }),
    ];

    return () => unsubscribers.forEach((unsub) => unsub());
  }, [on, playerInfo, myPlayer, myTeam, gameState, hasSubmitted, dispatch, showError]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (hasSubmitted) {
      showError('You have already submitted an answer for this round!');
      return;
    }

    const finalAnswer = variant === 'open_ended' ? answer : selectedOption;

    if (!finalAnswer.trim()) {
      showError('Please provide an answer');
      return;
    }

    stopTimer();
    const finalResponseTime = getFinalTime();

    emit('submitAnswer', {
      answer: finalAnswer.trim(),
      responseTime: finalResponseTime
    });
  };

  if (!playerInfo || !isConnected) {
    return (
      <section className="section">
        <div className="container container-md">
          <h1 className="title has-text-centered">💝 Tournament of the Couples 💝</h1>
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
      <div className="container" style={{ maxWidth: '800px' }}>
        <div className="block">
          <h1 className="title has-text-centered">💝 Tournament of the Couples 💝</h1>
          <PlayerHeader
            hostName={gameState?.host.name ?? '-'}
            playerName={playerInfo.name}
            partnerName={myPartner?.name ?? '-'}
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
        />
      )}

      {section === 'submitted' && (
        <SubmittedStatus
          submittedAnswer={submittedAnswer}
          partnerName={myPartner?.name ?? null}
          partnerSubmitted={gameState?.currentRound?.answers?.[myPartner?.name ?? ''] !== undefined}
          totalAnswersCount={Object.keys(gameState?.currentRound?.answers ?? {}).length}
        />
      )}

      {section === 'scoring' && <ScoringStatus />}

      {error && <div className="notification is-danger is-light mt-4">{error}</div>}
      </div>
    </section>
    </>
  );
}
