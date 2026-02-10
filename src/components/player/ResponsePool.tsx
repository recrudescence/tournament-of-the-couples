import {useMemo, useState} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {springDefault} from '../../styles/motion';
import type {PlayerAvatar as PlayerAvatarType} from '../../types/game';

interface ResponsePoolProps {
  answers: string[];
  myAnswer: string;
  partnerName: string;
  partnerAvatar: PlayerAvatarType | null;
  hasPicked: boolean;
  onPick: (answer: string) => void;
}

interface PoolItem {
  displayText: string;
  actualAnswer: string;
  isOwn: boolean;
  isEmpty: boolean;
  count: number; // For consolidated empty responses
}

export function ResponsePool({
  answers,
  myAnswer,
  partnerName,
  hasPicked,
  onPick,
}: ResponsePoolProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Check if my answer is empty
  const myAnswerIsEmpty = !myAnswer || myAnswer.trim() === '';

  // Build consolidated pool: separate real answers from empty ones
  const poolItems = useMemo(() => {
    const items: PoolItem[] = [];
    let emptyCount = 0;
    let myEmptyIncluded = false;

    for (const answer of answers) {
      const isEmpty = !answer || answer.trim() === '';

      if (isEmpty) {
        emptyCount++;
        if (answer === myAnswer) {
          myEmptyIncluded = true;
        }
      } else {
        items.push({
          displayText: answer,
          actualAnswer: answer,
          isOwn: answer === myAnswer,
          isEmpty: false,
          count: 1,
        });
      }
    }

    // Add consolidated empty response(s)
    if (emptyCount > 0) {
      if (myAnswerIsEmpty && myEmptyIncluded) {
        // Player submitted empty: show their own + others consolidated
        items.push({
          displayText: '(no response)',
          actualAnswer: myAnswer,
          isOwn: true,
          isEmpty: true,
          count: 1,
        });
        if (emptyCount > 1) {
          items.push({
            displayText: '(no response)',
            actualAnswer: '', // Empty string for "others"
            isOwn: false,
            isEmpty: true,
            count: emptyCount - 1,
          });
        }
      } else {
        // Player submitted real answer: one consolidated empty pill
        items.push({
          displayText: '(no response)',
          actualAnswer: '',
          isOwn: false,
          isEmpty: true,
          count: emptyCount,
        });
      }
    }

    return items;
  }, [answers, myAnswer, myAnswerIsEmpty]);

  const handleSelectAnswer = (index: number) => {
    if (hasPicked) return;
    const item = poolItems[index];
    if (item.isOwn) return; // Can't pick own answer (including own empty)
    setSelectedIndex(index);
  };

  const handleConfirm = () => {
    if (selectedIndex !== null) {
      onPick(poolItems[selectedIndex].actualAnswer);
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
        {poolItems.map((item, index) => {
          const isDisabled = item.isOwn; // Only own answer is disabled
          const isSelected = index === selectedIndex;

          return (
            <button
              key={item.actualAnswer || `empty-${item.isOwn ? 'own' : 'other'}`}
              className={`response-bubble ${item.isOwn ? 'is-own' : ''} ${item.isEmpty && !item.isOwn ? 'is-empty-pickable' : ''} ${item.isEmpty && item.isOwn ? 'is-empty is-own' : ''} ${isSelected ? 'is-selected' : ''}`}
              onClick={() => !isDisabled && handleSelectAnswer(index)}
              disabled={isDisabled}
              style={{ '--index': index } as React.CSSProperties}
            >
              {item.displayText}
              {item.isOwn && (
                <span className="tag is-small is-light ml-2">yours</span>
              )}
              {item.isEmpty && item.count > 1 && (
                <span className="tag is-small is-light ml-2">×{item.count}</span>
              )}
            </button>
          );
        })}
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
