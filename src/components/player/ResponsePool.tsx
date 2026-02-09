import {useState} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {bubbleEntrance, bubbleFloat, bubbleFloatTransition, springDefault, staggerDelay,} from '../../styles/motion';
import type {PlayerAvatar as PlayerAvatarType} from '../../types/game';

interface ResponsePoolProps {
  answers: string[];
  myAnswer: string;
  partnerName: string;
  partnerAvatar: PlayerAvatarType | null;
  hasPicked: boolean;
  onPick: (answer: string) => void;
}

export function ResponsePool({
  answers,
  myAnswer,
  partnerName,
  hasPicked,
  onPick,
}: ResponsePoolProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);

  const handleSelectAnswer = (answer: string) => {
    if (hasPicked) return;
    if (answer === myAnswer) return; // Can't pick own answer

    setSelectedAnswer(answer);
  };

  const handleConfirm = () => {
    if (selectedAnswer) {
      onPick(selectedAnswer);
    }
  };

  if (hasPicked) {
    return (
      <div className="box has-text-centered">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={springDefault}
        >
          <h3 className="title is-4">Pick submitted!</h3>
          <p className="subtitle is-6">Waiting for others to pick...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="box">
      <div className="has-text-centered mb-4">
        <h3 className="title is-5 mb-2">Which answer did {partnerName} write?</h3>
        <p className="subtitle is-6 has-text-grey">
          Tap an answer to select it
        </p>
      </div>

      {/* Answer Pool */}
      <div className="response-pool">
        <AnimatePresence>
          {answers.map((answer, index) => {
            const isOwnAnswer = answer === myAnswer;
            const isSelected = answer === selectedAnswer;

            return (
              <motion.span
                animate={bubbleFloat(index)}
                transition={bubbleFloatTransition(index)}
              >
              <motion.button
                key={answer}
                variants={bubbleEntrance}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={{ ...springDefault, delay: staggerDelay(index, 0, 0.08) }}
                className={`response-bubble ${isOwnAnswer ? 'is-own' : ''} ${isSelected ? 'is-selected' : ''}`}
                onClick={() => handleSelectAnswer(answer)}
                disabled={isOwnAnswer}
                whileHover={!isOwnAnswer ? { scale: 1.03, y: -2 } : undefined}
                whileTap={!isOwnAnswer ? { scale: 0.97 } : undefined}
              >
                  {answer}
                {isOwnAnswer && (
                  <span className="tag is-small is-light ml-2">yours</span>
                )}
              </motion.button>
              </motion.span>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Confirmation */}
      <AnimatePresence>
        {selectedAnswer && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={springDefault}
            className="confirmation-panel mt-5"
          >
            <button
              className="button is-primary is-medium is-fullwidth"
              onClick={handleConfirm}
            >
              Confirm Pick
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
