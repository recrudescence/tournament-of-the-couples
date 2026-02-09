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
  // Track selection by index to handle duplicate answer texts
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const handleSelectAnswer = (index: number, answer: string) => {
    if (hasPicked) return;
    if (answer === myAnswer) return; // Can't pick own answer

    setSelectedIndex(index);
  };

  const handleConfirm = () => {
    if (selectedIndex !== null) {
      onPick(answers[selectedIndex]);
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
            const isEmpty = !answer || answer.trim() === '';
            const displayText = isEmpty ? '(no response)' : answer;
            const isOwnAnswer = answer === myAnswer;
            const isDisabled = isOwnAnswer || isEmpty;
            const isSelected = index === selectedIndex;

            return (
              <motion.span
                key={index}
                animate={bubbleFloat(index)}
                transition={bubbleFloatTransition(index)}
              >
              <motion.button
                variants={bubbleEntrance}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={{ ...springDefault, delay: staggerDelay(index, 0, 0.08) }}
                className={`response-bubble ${isOwnAnswer ? 'is-own' : ''} ${isEmpty ? 'is-empty' : ''} ${isSelected ? 'is-selected' : ''}`}
                onClick={() => !isDisabled && handleSelectAnswer(index, answer)}
                disabled={isDisabled}
                whileHover={!isDisabled ? { scale: 1.03, y: -2 } : undefined}
                whileTap={!isDisabled ? { scale: 0.97 } : undefined}
              >
                  {displayText}
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
        {selectedIndex !== null && (
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
