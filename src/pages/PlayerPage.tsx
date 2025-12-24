import { useEffect, useState, useRef } from 'react';
import { useSocket } from '../hooks/useSocket';
import { usePlayerInfo } from '../hooks/usePlayerInfo';
import { useGameContext } from '../context/GameContext';
import { useGameError } from '../hooks/useGameError';
import { useWakeLock } from '../hooks/useWakeLock';
import { ExitButton } from '../components/common/ExitButton';

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
  const [responseTime, setResponseTime] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [variant, setVariant] = useState<string>('open_ended');
  const [options, setOptions] = useState<string[] | null>(null);
  const [selectedOption, setSelectedOption] = useState<string>('');

  const scoreRef = useRef<HTMLElement>(null);
  const timerStartRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);

  // Debug section changes
  useEffect(() => {
    console.log('[PlayerPage] Section changed to:', section);
  }, [section]);

  // Debug team/partner updates
  useEffect(() => {
    console.log('[PlayerPage] myTeam updated:', myTeam);
    console.log('[PlayerPage] myPartner updated:', myPartner);
  }, [myTeam, myPartner]);

  // Request wake lock to prevent screen sleep during gameplay
  useEffect(() => {
    if (gameState?.status === 'playing' && wakeLockSupported) {
      console.log('[PlayerPage] Game is playing, requesting wake lock');
      requestWakeLock();
    }
  }, [gameState?.status, wakeLockSupported, requestWakeLock]);

  // Initialize from GameContext when PlayerPage mounts (handles reconnection)
  useEffect(() => {
    if (!gameState || !playerInfo) return;

    console.log('[PlayerPage] Initializing from gameState', { status: gameState.status, currentRound: gameState.currentRound });
    dispatch({ type: 'SET_GAME_STATE', payload: gameState });

    // Check game status - now currentRound is null when status is 'playing'
    if (gameState.status === 'playing') {
      if (!gameState.currentRound) {
        // Host is setting up the next round
        console.log('[PlayerPage] Setting section to waiting (host setting up)');
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
          setResponseTime(previousAnswer.responseTime);
          setHasSubmitted(true);
          console.log('[PlayerPage] Setting section to submitted');
          setSection('submitted');
          setTimerRunning(false);
        } else {
          // Player hasn't submitted yet
          setAnswer('');
          setHasSubmitted(false);
          console.log('[PlayerPage] Setting section to answering');
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
        setResponseTime(previousAnswer.responseTime);
      }
      console.log('[PlayerPage] Setting section to scoring');
      setSection('scoring');
      setTimerRunning(false);
      return;
    }

    // Default to waiting
    console.log('[PlayerPage] Setting section to waiting (default)');
    setSection('waiting');
  }, []); // Only run on mount

  // Timer effect
  useEffect(() => {
    if (timerRunning) {
      if (!timerStartRef.current) {
        timerStartRef.current = Date.now();
      }

      timerIntervalRef.current = window.setInterval(() => {
        const elapsed = Date.now() - (timerStartRef.current || Date.now());
        setResponseTime(elapsed);
      }, 10); // Update every 10ms for smooth display

      return () => {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
        }
      };
    } else {
      // Timer stopped - clear interval and ref
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
  }, [timerRunning]);

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
        if (v === 'binary' && opts && myPlayer && myTeam) {
          const player1 = gameState?.players.find(p => p.socketId === myTeam.player1Id);
          const player2 = gameState?.players.find(p => p.socketId === myTeam.player2Id);
          setOptions([player1?.name || 'Player 1', player2?.name || 'Player 2']);
        } else {
          setOptions(opts);
        }

        setAnswer('');
        setSelectedOption('');
        setHasSubmitted(false);
        setSection('answering');
        // Start timer
        setResponseTime(0);
        timerStartRef.current = null;
        setTimerRunning(true);
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
        console.log('[PlayerPage] readyForNextRound event received', {
          status: state.status,
          currentRound: state.currentRound,
          teams: state.teams,
          players: state.players
        });
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
        // Reset and restart timer
        setResponseTime(0);
        timerStartRef.current = null;
        setTimerRunning(true);
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

    // Freeze timer
    setTimerRunning(false);

    // Calculate final response time
    const finalResponseTime = timerStartRef.current
      ? Date.now() - timerStartRef.current
      : responseTime;

    setResponseTime(finalResponseTime);

    // Submit answer with response time
    emit('submitAnswer', {
      answer: finalAnswer.trim(),
      responseTime: finalResponseTime
    });
  };

  if (!playerInfo || !isConnected) {
    return (
      <section className="section">
        <div className="container" style={{ maxWidth: '800px' }}>
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
          <div className="box">
            <div className="columns is-mobile is-multiline has-text-centered">
              <div className="column is-half-mobile is-one-quarter-tablet">
                <p className="heading">Host</p>
                <p className="title is-6">{gameState?.host.name ?? '-'}</p>
              </div>
              <div className="column is-half-mobile is-one-quarter-tablet">
                <p className="heading">You</p>
                <p className="title is-6 has-text-primary">{playerInfo.name}</p>
              </div>
              <div className="column is-half-mobile is-one-quarter-tablet">
                <p className="heading">Partner</p>
                <p className="title is-6">{myPartner?.name ?? '-'}</p>
              </div>
              <div className="column is-half-mobile is-one-quarter-tablet">
                <p className="heading">Team Score</p>
                <p className={`title is-6 ${isCelebrating ? 'has-text-success' : ''}`} ref={scoreRef}>
                  {myTeam?.score || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

      {section === 'waiting' && (
        <div className="box has-text-centered">
          <h2 className="subtitle is-4 mb-4">🎄 Your host is setting up the next round!</h2>
          <p className="has-text-grey mb-4">Get ready...</p>
          <p className="has-text-grey is-size-7">Waiting for {gameState?.host.name} to start the round...</p>
        </div>
      )}

      {section === 'answering' && (
        <div className="box">
          <div className="is-flex is-justify-content-space-between is-align-items-center mb-4">
            <h2 className="subtitle is-4 mb-0">Round {gameState?.currentRound?.roundNumber || '-'}</h2>
            <div className="tag is-info is-large">
              {(responseTime / 1000).toFixed(2)}s
            </div>
          </div>

          <div className="notification is-primary is-light mb-4">
            <p className="is-size-5 has-text-weight-semibold">{gameState?.currentRound?.question}</p>
          </div>

          <form onSubmit={handleSubmit}>
            {variant === 'open_ended' ? (
              <div className="field">
                <label className="label" htmlFor="answerInput">Your Answer:</label>
                <div className="control">
                  <textarea
                    id="answerInput"
                    className="textarea"
                    rows={3}
                    placeholder="Type your answer here..."
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    required
                  />
                </div>
              </div>
            ) : (
              <div className="field">
                <div className="control">
                  {options?.map((option, index) => (
                    <label
                      key={index}
                      className={`button is-fullwidth mb-2 ${selectedOption === option ? 'is-primary' : 'is-light'}`}
                      style={{ display: 'block', cursor: 'pointer' }}
                    >
                      <input
                        type="radio"
                        id={`option-${index}`}
                        name="answer-option"
                        value={option}
                        checked={selectedOption === option}
                        onChange={(e) => setSelectedOption(e.target.value)}
                        required
                        style={{ marginRight: '8px' }}
                      />
                      {option}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <button type="submit" className="button is-primary is-fullwidth is-large">
              Submit Answer
            </button>
          </form>
        </div>
      )}

      {section === 'submitted' && (
        <div className="box">
          <h2 className="subtitle is-4 has-text-success mb-4">✓ Answer Submitted!</h2>
          <div className="notification is-success is-light mb-4">
            <p className="has-text-weight-semibold mb-2">You said:</p>
            <p className="is-size-5">{submittedAnswer}</p>
          </div>
          {myPartner && (
            <div className="notification is-info is-light mb-4">
              <p>
                <strong>{myPartner.name}:</strong>{' '}
                <i>{gameState?.currentRound?.answers?.[myPartner.name] ? '✓ Submitted' : 'is thinking...'}</i>
              </p>
            </div>
          )}
          {gameState?.currentRound?.answers && Object.keys(gameState.currentRound.answers).length < 4 && (
            <p className="has-text-centered has-text-grey">Waiting for other players to finish...</p>
          )}
        </div>
      )}

      {section === 'scoring' && (
        <div className="box has-text-centered">
          <h2 className="subtitle is-4 mb-3">All answers are in!</h2>
          <p className="has-text-grey">The host is reviewing answers and awarding points...</p>
        </div>
      )}

      {error && <div className="notification is-danger is-light mt-4">{error}</div>}
      </div>
    </section>
    </>
  );
}
