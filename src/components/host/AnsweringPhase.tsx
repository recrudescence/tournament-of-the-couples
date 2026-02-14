import {useEffect} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {type CurrentRound, type Player, RoundVariant} from '../../types/game';
import {PlayerAvatar} from '../common/PlayerAvatar';
import {useTimer} from '../../hooks/useTimer';
import {useCountdown} from '../../hooks/useCountdown';
import {formatResponseTime} from '../../utils/formatUtils';
import {springDefault} from '../../styles/motion';

interface AnsweringPhaseProps {
  question: string;
  variant?: RoundVariant;
  options?: string[];
  players: Player[];
  currentRound: CurrentRound | null;
  submittedCount: number;
  allAnswersIn: boolean;
  onReopenAnswering: () => void;
  onStartScoring: () => void;
  // Pool selection props
  picksSubmitted?: string[];
  allPicksIn?: boolean;
}

export function AnsweringPhase({
  question,
  variant,
  options,
  players,
  currentRound,
  submittedCount,
  allAnswersIn,
  onReopenAnswering,
  onStartScoring,
  picksSubmitted = [],
  allPicksIn = false
}: AnsweringPhaseProps) {
  const isPoolSelection = variant === RoundVariant.POOL_SELECTION;
  const isSelectingPhase = isPoolSelection && allAnswersIn && !allPicksIn;
  const canStartScoring = isPoolSelection ? allPicksIn : allAnswersIn;

  // Count-up timer for regular rounds
  const { responseTime, startTimer, stopTimer } = useTimer();

  // Countdown timer for pool selection rounds
  const {
    remaining: countdownRemaining,
    isExpired: countdownExpired,
    start: startCountdown,
    stop: stopCountdown,
    reset: resetCountdown
  } = useCountdown();

  useEffect(() => {
    if (currentRound?.createdAt) {
      if (isPoolSelection) {
        // Reset then start to handle round changes
        resetCountdown();
        // Use setTimeout to ensure reset completes before start
        const timeoutId = setTimeout(() => {
          startCountdown(currentRound.createdAt);
        }, 0);
        return () => {
          clearTimeout(timeoutId);
          stopCountdown();
        };
      } else {
        startTimer(currentRound.createdAt);
        return () => stopTimer();
      }
    }
  }, [currentRound?.createdAt, currentRound?.roundNumber, isPoolSelection, startTimer, stopTimer, startCountdown, stopCountdown, resetCountdown]);

  // Stop timer/countdown when all answers are in
  useEffect(() => {
    if (allAnswersIn) {
      stopTimer();
      stopCountdown();
    }
  }, [allAnswersIn, stopTimer, stopCountdown]);

  // Determine timer display
  const showTimer = isPoolSelection ? (!allAnswersIn && !countdownExpired) : true;
  const timerValue = isPoolSelection ? countdownRemaining : responseTime;
  const isUrgent = isPoolSelection && countdownRemaining <= 10000;
  const isWarning = isPoolSelection && countdownRemaining <= 20000 && countdownRemaining > 10000;
  const timerColor = isUrgent ? 'is-danger' : isWarning ? 'is-warning' : 'is-info';
  const timerClass = isUrgent ? 'countdown-urgent' : isWarning ? 'countdown-warning' : '';

  return (
    <div className="box">
      <div className="is-flex is-justify-content-space-between is-align-items-center mb-3">
        <h2 className="subtitle is-4 mb-0">Current Question</h2>
        {showTimer && (
          <span className={`tag ${timerColor} is-large is-mono ${timerClass}`} style={{ minWidth: '6rem', justifyContent: 'center' }}>
            {formatResponseTime(timerValue, isPoolSelection ? 0 : 2)}
          </span>
        )}
      </div>
      <div className="notification is-primary is-light mb-4">
        <p className="is-size-5 has-text-weight-semibold">{question}</p>
      </div>

      {variant === 'multiple_choice' && options && options.length > 0 && (
        <div className="columns is-multiline is-centered mb-4">
          {options.map((option, index) => (
            <div key={index} className="column is-half-tablet is-one-third-desktop">
              <div className="box has-background-light has-text-centered py-3">
                <span className="is-size-6">{option}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pool selection: show all answers while players are picking */}
      {isPoolSelection && allAnswersIn && currentRound?.answerPool && (() => {
        // Consolidate duplicate answers (case-insensitive) and empty responses
        const answerGroups = new Map<string, { text: string; count: number }>();
        let emptyCount = 0;

        for (const entry of currentRound.answerPool) {
          const isEmpty = !entry.answer || entry.answer.trim() === '';
          if (isEmpty) {
            emptyCount++;
          } else {
            const normalized = entry.answer.toLowerCase().trim();
            const existing = answerGroups.get(normalized);
            if (existing) {
              existing.count++;
            } else {
              answerGroups.set(normalized, { text: entry.answer, count: 1 });
            }
          }
        }

        const poolItems = [
          ...Array.from(answerGroups.values()).map(g => ({ text: g.text, isEmpty: false, count: g.count })),
          ...(emptyCount > 0 ? [{ text: '(no response)', isEmpty: true, count: emptyCount }] : [])
        ];

        return (
          <>
            <h3 className="subtitle is-5 mb-3">Answer Pool</h3>
            <div className="response-pool mb-4">
              {poolItems.map((item, index) => (
                <span
                  key={item.isEmpty ? 'empty' : item.text.toLowerCase()}
                  className={`response-bubble ${item.isEmpty ? 'is-empty' : ''}`}
                  style={{ cursor: 'default', '--index': index } as React.CSSProperties}
                >
                  {item.text.toLowerCase()}
                  {item.count > 1 && (
                    <span className="tag is-small is-light ml-2">×{item.count}</span>
                  )}
                </span>
              ))}
            </div>
          </>
        );
      })()}

      <h3 className="subtitle is-5 mb-3">
        {isSelectingPhase ? 'Pick Status' : 'Answer Status'}
      </h3>
      <div className="mb-4" style={{ perspective: 800 }}>
        {players.map((player) => {
          const hasSubmitted = currentRound
            ? currentRound.status === 'complete' || currentRound.status === 'selecting'
              ? player.name in currentRound.answers
              : currentRound.submittedInCurrentPhase.includes(player.name)
            : false;
          const hasPicked = picksSubmitted.includes(player.name);

          // For pool selection in selecting phase, show pick status
          // Otherwise show answer status
          const showPickStatus = isPoolSelection && allAnswersIn;
          const currentStatus = showPickStatus ? hasPicked : hasSubmitted;

          // Show green if done, grey if disconnected and not done, yellow if waiting
          const statusColor = currentStatus
            ? 'has-background-success-light'
            : !player.connected
            ? 'has-background-grey-lighter'
            : 'has-background-warning-light';

          // Build status text
          const statusParts: string[] = [];
          if (showPickStatus) {
            if (hasPicked) statusParts.push('✅ Picked');
          } else {
            if (hasSubmitted) statusParts.push('✅ Submitted');
          }
          if (!player.connected) statusParts.push('📱 Disconnected');
          const statusText = statusParts.length > 0 ? statusParts.join(' · ') : null;

          return (
            <AnimatePresence mode="popLayout" key={player.socketId}>
              <motion.div
                key={`${player.socketId}-${hasSubmitted}-${hasPicked}`}
                className={`box mb-2 p-3 ${statusColor}`}
                initial={{ rotateX: -90, opacity: 0 }}
                animate={{ rotateX: 0, opacity: 1 }}
                transition={springDefault}
              >
                <div className="is-flex is-align-items-center is-justify-content-space-between">
                  <div className="is-flex is-align-items-center" style={{ gap: '0.5rem' }}>
                    <PlayerAvatar avatar={player.avatar} size="small" />
                    <span className="has-text-weight-semibold">{player.name}</span>
                  </div>
                  {statusText ? (
                    <span>{statusText}</span>
                  ) : (
                    <div className="typing-indicator">
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                    </div>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          );
        })}
      </div>

      {/* Progress counts */}
      {!allAnswersIn && (
        <p className="has-text-centered has-text-grey mb-4">
          {submittedCount} / {players.length} answers submitted
        </p>
      )}
      {isSelectingPhase && (
        <p className="has-text-centered has-text-grey mb-4">
          {picksSubmitted.length} / {players.length} picks submitted
        </p>
      )}

      {/* Status notifications */}
      {allAnswersIn && !isPoolSelection && (
        <div className="notification is-success mb-4">
          ✅ All answers are in! Ready to score.
        </div>
      )}
      {isPoolSelection && allAnswersIn && !allPicksIn && (
        <div className="notification is-info mb-4 is-flex is-justify-content-center">
          waiting for players to pick their partner's answer...
        </div>
      )}
      {isPoolSelection && allPicksIn && (
        <div className="notification is-success mb-4">
          ✅ All picks are in! Ready to reveal answers.
        </div>
      )}

      {/* Action buttons */}
      {canStartScoring && (
        <div className="field is-grouped is-grouped-centered">
          {!isPoolSelection && (
            <div className="control">
              <button className="button is-info" onClick={onReopenAnswering}>
                Re-open Answering
              </button>
            </div>
          )}
          <div className="control">
            <button className="button is-primary" onClick={onStartScoring}>
              {isPoolSelection ? 'Reveal Answers' : 'Begin Scoring'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
