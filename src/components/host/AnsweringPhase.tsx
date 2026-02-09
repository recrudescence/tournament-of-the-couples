import {useEffect} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {type CurrentRound, type Player, RoundVariant} from '../../types/game';
import {PlayerAvatar} from '../common/PlayerAvatar';
import {useTimer} from '../../hooks/useTimer';
import {formatResponseTime} from '../../utils/formatUtils';
import {bubbleEntrance, bubbleFloat, bubbleFloatTransition, springDefault, staggerDelay} from '../../styles/motion';

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
  const { responseTime, startTimer, stopTimer } = useTimer();

  useEffect(() => {
    if (currentRound?.createdAt) {
      startTimer(currentRound.createdAt);
    }
    return () => stopTimer();
  }, [currentRound?.createdAt, startTimer, stopTimer]);

  // Stop timer when all answers are in
  useEffect(() => {
    if (allAnswersIn) {
      stopTimer();
    }
  }, [allAnswersIn, stopTimer]);

  return (
    <div className="box">
      <div className="is-flex is-justify-content-space-between is-align-items-center mb-3">
        <h2 className="subtitle is-4 mb-0">Current Question</h2>
        <span className="tag is-info is-large is-mono" style={{ minWidth: '8rem', justifyContent: 'center' }}>⏱️ {formatResponseTime(responseTime, 2)}</span>
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
      {isPoolSelection && allAnswersIn && currentRound?.answerPool && (
        <>
          <h3 className="subtitle is-5 mb-3">Answer Pool</h3>
          <div className="response-pool mb-4">
            <AnimatePresence>
              {currentRound.answerPool.map((answer, index) => (
                <motion.span
                  key={answer}
                  animate={bubbleFloat(index)}
                  transition={bubbleFloatTransition(index)}
                >
                  <motion.span
                    variants={bubbleEntrance}
                    initial="hidden"
                    animate="visible"
                    transition={{ ...springDefault, delay: staggerDelay(index, 0, 0.08) }}
                    className="response-bubble"
                    style={{ cursor: 'default' }}
                  >
                    {answer}
                  </motion.span>
                </motion.span>
              ))}
            </AnimatePresence>
          </div>
        </>
      )}

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
        <div className="notification is-info mb-4">
          📝 All answers in! Waiting for players to pick their partner's answer...
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
