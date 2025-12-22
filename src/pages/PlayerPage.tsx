import { useEffect, useState, useCallback, useRef } from 'react';
import { useSocket } from '../hooks/useSocket';
import { usePlayerInfo } from '../hooks/usePlayerInfo';
import { useGameContext } from '../context/GameContext';
import type { GameState } from '../types/game';
import '../styles/player.css';

type PlayerSection = 'waiting' | 'answering' | 'submitted' | 'scoring';

export function PlayerPage() {
  const { isConnected, emit, on } = useSocket();
  const { playerInfo } = usePlayerInfo();
  const { gameState, dispatch } = useGameContext();

  const [section, setSection] = useState<PlayerSection>('waiting');
  const [answer, setAnswer] = useState('');
  const [submittedAnswer, setSubmittedAnswer] = useState('');
  const [roundNumber, setRoundNumber] = useState(0);
  const [question, setQuestion] = useState('');
  const [teamScore, setTeamScore] = useState(0);
  const [isCelebrating, setIsCelebrating] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responseTime, setResponseTime] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [variant, setVariant] = useState<string>('open_ended');
  const [options, setOptions] = useState<string[] | null>(null);
  const [selectedOption, setSelectedOption] = useState<string>('');

  const scoreRef = useRef<HTMLElement>(null);
  const timerStartRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);

  const updateFromGameState = useCallback(
    (state: GameState, socketId?: string) => {
      dispatch({ type: 'SET_GAME_STATE', payload: state });

      // Find my player and team
      // If no socketId provided, try to find player by name (for initialization from GameContext)
      const me = socketId
        ? state.players.find((p) => p.socketId === socketId)
        : state.players.find((p) => p.name === playerInfo?.name);

      if (!me || !playerInfo) return;

      // Update team score
      if (me.teamId) {
        const myTeam = state.teams.find((t) => t.teamId === me.teamId);
        if (myTeam) {
          setTeamScore(myTeam.score);
        }
      }

      // Restore round state if there's an active round
      if (state.currentRound) {
        setRoundNumber(state.currentRound.roundNumber);
        setQuestion(state.currentRound.question);

        const previousAnswer = state.currentRound.answers?.[playerInfo.name];

        if (state.status === 'scoring' || state.currentRound.status === 'complete') {
          if (previousAnswer) {
            setSubmittedAnswer(previousAnswer.text);
            setResponseTime(previousAnswer.responseTime);
          }
          setSection('scoring');
          setTimerRunning(false);
        } else if (state.currentRound.status === 'answering') {
          if (previousAnswer) {
            // Player has already submitted - restore submitted state
            setAnswer(previousAnswer.text);
            setSubmittedAnswer(previousAnswer.text);
            setResponseTime(previousAnswer.responseTime);
            setHasSubmitted(true);
            setSection('submitted');
            setTimerRunning(false);
          } else {
            // Player hasn't submitted yet
            setAnswer('');
            setHasSubmitted(false);
            setSection('answering');
          }
        } else {
          setSection('waiting');
        }
      } else {
        setSection('waiting');
      }
    },
    [dispatch, playerInfo]
  );

  // Initialize from GameContext when PlayerPage mounts (handles reconnection)
  useEffect(() => {
    if (gameState) {
      updateFromGameState(gameState);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      on('joinSuccess', ({ gameState: state, socketId }) => {
        updateFromGameState(state, socketId);
      }),

      on('roundStarted', ({ roundNumber: rn, question: q, variant: v, options: opts }) => {
        setRoundNumber(rn);
        setQuestion(q);
        setVariant(v);

        // For binary: replace placeholders with actual team member names
        if (v === 'binary' && opts && playerInfo?.name) {
          const player = gameState?.players.find(p => p.name === playerInfo.name);
          const team = gameState?.teams.find(t => t.teamId === player?.teamId);

          if (team) {
            const player1 = gameState?.players.find(p => p.socketId === team.player1Id);
            const player2 = gameState?.players.find(p => p.socketId === team.player2Id);
            setOptions([player1?.name || 'Player 1', player2?.name || 'Player 2']);
          } else {
            setOptions(opts);
          }
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

      on('answerSubmitted', ({ playerName, answer: ans }) => {
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
        // Check if this is my team
        const me = gameState?.players.find((p) => p.name === playerInfo?.name);
        if (me?.teamId === teamId) {
          setTeamScore(newScore);
          setIsCelebrating(true);
          setTimeout(() => setIsCelebrating(false), 500);
        }
      }),

      on('readyForNextRound', () => {
        setSection('waiting');
      }),

      on('returnedToAnswering', ({ currentRound }) => {
        if (currentRound?.answers && playerInfo) {
          const previousAnswer = currentRound.answers[playerInfo.name];
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
        setError(message);
        setTimeout(() => setError(null), 5000);
        if (hasSubmitted) {
          setHasSubmitted(false);
          setSection('answering');
        }
      }),
    ];

    return () => unsubscribers.forEach((unsub) => unsub());
  }, [on, playerInfo, gameState, hasSubmitted, updateFromGameState]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (hasSubmitted) {
      setError('You have already submitted an answer for this round!');
      return;
    }

    const finalAnswer = variant === 'open_ended' ? answer : selectedOption;

    if (!finalAnswer.trim()) {
      setError('Please provide an answer');
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
      <div className="container">
        <h1>Tournament of Couples</h1>
        <p>Loading...</p>
      </div>
    );
  }

  // Find partner name
  const me = gameState?.players.find((p) => p.name === playerInfo.name);
  const myTeam = me?.teamId
    ? gameState?.teams.find((t) => t.teamId === me.teamId)
    : null;
  const partnerId = myTeam
    ? myTeam.player1Id === me?.socketId
      ? myTeam.player2Id
      : myTeam.player1Id
    : null;
  const partner = partnerId
    ? gameState?.players.find((p) => p.socketId === partnerId)
    : null;

  return (
    <div className="container">
      <header>
        <h1>Tournament of Couples</h1>
        <div className="header-info">
          <p>
            Room: <strong>{gameState?.roomCode.toUpperCase() ?? playerInfo.roomCode.toUpperCase()}</strong>
          </p>
          <p>
            Host: <strong>{gameState?.host.name ?? '-'}</strong>
          </p>
          <p>
            <strong>{playerInfo.name}</strong>
          </p>
          <p>
            Partner: <strong>{partner?.name ?? '-'}</strong>
          </p>
          <p>
            Team Score:{' '}
            <strong className={`team-score ${isCelebrating ? 'celebrating' : ''}`} ref={scoreRef}>
              {teamScore}
            </strong>
          </p>
        </div>
      </header>

      {section === 'waiting' && (
        <div className="player-section">
          <div className="waiting-message">
            <h2>Waiting for Host</h2>
            <p>The host will start the next round soon...</p>
          </div>
        </div>
      )}

      {section === 'answering' && (
        <div className="player-section">
          <div className="round-info">
            <h2>Round {roundNumber}</h2>
            <div className="timer">
              {(responseTime / 1000).toFixed(2)}s
            </div>
          </div>

          <div className="question-box">
            <p>{question}</p>
          </div>

          <form onSubmit={handleSubmit}>
            {variant === 'open_ended' ? (
              <div className="form-group">
                <label htmlFor="answerInput">Your Answer:</label>
                <textarea
                  id="answerInput"
                  rows={3}
                  placeholder="Type your answer here..."
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  required
                />
              </div>
            ) : (
              <div className="answer-options">
                {options?.map((option, index) => (
                  <div
                    key={index}
                    className={`answer-option ${selectedOption === option ? 'selected' : ''}`}
                    onClick={() => setSelectedOption(option)}
                  >
                    <input
                      type="radio"
                      id={`option-${index}`}
                      name="answer-option"
                      value={option}
                      checked={selectedOption === option}
                      onChange={(e) => setSelectedOption(e.target.value)}
                      required
                    />
                    <label htmlFor={`option-${index}`}>{option}</label>
                  </div>
                ))}
              </div>
            )}
            <button type="submit" className="btn-primary">
              Submit Answer
            </button>
          </form>
        </div>
      )}

      {section === 'submitted' && (
        <div className="player-section">
          <div className="success-message">
            <h2>Answer Submitted!</h2>
            <div className="submitted-answer">
              <p>
                <strong>You said:</strong>
              </p>
              <p>{submittedAnswer}</p>
            </div>
            {partner && (
              <div className="partner-status">
                <p>
                  <strong>{partner.name}:</strong>{' '}
                  {gameState?.currentRound?.answers?.[partner.name] ? '✓ Submitted' : '...'}
                </p>
              </div>
            )}
            {gameState?.currentRound?.answers && Object.keys(gameState.currentRound.answers).length < 4 && (
              <p>Waiting for other players to finish...</p>
            )}
          </div>
        </div>
      )}

      {section === 'scoring' && (
        <div className="player-section">
          <div className="scoring-message">
            <h2>All answers are in!</h2>
            <p>The host is reviewing answers and awarding points...</p>
          </div>
        </div>
      )}

      {error && <div className="error">{error}</div>}
    </div>
  );
}
