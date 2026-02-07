import {useEffect} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {type CurrentRound, type Player, type RoundVariant} from '../../types/game';
import {PlayerAvatar} from '../common/PlayerAvatar';
import {useTimer} from '../../hooks/useTimer';
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
  onStartScoring
}: AnsweringPhaseProps) {
  const { responseTime, startTimer, stopTimer } = useTimer();

  useEffect(() => {
    if (currentRound?.createdAt) {
      startTimer(currentRound.createdAt);
    }
    return () => stopTimer();
  }, [currentRound?.createdAt]);

  // Stop timer when all answers are in
  useEffect(() => {
    if (allAnswersIn) {
      stopTimer();
    }
  }, [allAnswersIn]);

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

      <h3 className="subtitle is-5 mb-3">Answer Status</h3>
      <div className="mb-4" style={{ perspective: 800 }}>
        {players.map((player) => {
          const hasSubmitted = currentRound
            ? currentRound.status === 'complete'
              ? player.name in currentRound.answers
              : currentRound.submittedInCurrentPhase.includes(player.name)
            : false;

          // Show green if submitted (even if disconnected), grey only if disconnected AND not submitted
          const statusColor = hasSubmitted
            ? 'has-background-success-light'
            : !player.connected
            ? 'has-background-grey-lighter'
            : 'has-background-warning-light';

          // Build status text showing both states when applicable
          const statusParts: string[] = [];
          if (hasSubmitted) statusParts.push('✅ Submitted');
          if (!player.connected) statusParts.push('📱 Phone screen off');
          const statusText = statusParts.length > 0 ? statusParts.join(' · ') : null;

          return (
            <AnimatePresence mode="popLayout" key={player.socketId}>
              <motion.div
                key={`${player.socketId}-${hasSubmitted}`}
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

      {!allAnswersIn && (
        <p className="has-text-centered has-text-grey mb-4">
          {submittedCount} / {players.length} answers submitted
        </p>
      )}
      {allAnswersIn && (
        <div className="notification is-success mb-4">
          ✅ All answers are in! Ready to score.
        </div>
      )}

      {allAnswersIn && (
        <div className="field is-grouped is-grouped-centered">
          <div className="control">
            <button className="button is-info" onClick={onReopenAnswering}>
              Re-open Answering
            </button>
          </div>
          <div className="control">
            <button className="button is-primary" onClick={onStartScoring}>
              Begin Scoring
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
