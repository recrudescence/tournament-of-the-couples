import {useMemo, useState} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {springDefault} from '../../styles/motion';
import type {PlayerAvatar as PlayerAvatarType, PoolAnswer} from '../../types/game';

interface ResponsePoolProps {
  answers: PoolAnswer[];
  myPlayerName: string;
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
  myPlayerName,
  partnerName,
  hasPicked,
  onPick,
}: ResponsePoolProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Find my answer text from the pool
  const myAnswerEntry = answers.find(a => a.playerName === myPlayerName);
  const myAnswerText = myAnswerEntry?.answer ?? '';
  const myAnswerIsEmpty = !myAnswerText || myAnswerText.trim() === '';

  // Build consolidated pool: separate real answers from empty ones
  const poolItems = useMemo(() => {
    const items: PoolItem[] = [];
    let emptyCount = 0;
    let myEmptyIncluded = false;

    for (const entry of answers) {
      const isEmpty = !entry.answer || entry.answer.trim() === '';
      const isOwn = entry.playerName === myPlayerName;

      if (isEmpty) {
        emptyCount++;
        if (isOwn) {
          myEmptyIncluded = true;
        }
      } else {
        items.push({
          displayText: entry.answer,
          actualAnswer: entry.answer,
          isOwn,
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
          actualAnswer: myAnswerText,
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
  }, [answers, myPlayerName, myAnswerText, myAnswerIsEmpty]);

  const handleSelectAnswer = (index: number) => {
    if (hasPicked) return;
    const item = poolItems[index];
    if (!item || item.isOwn) return; // Can't pick own answer (including own empty)
    setSelectedIndex(index);
  };

  const handleConfirm = () => {
    if (selectedIndex !== null) {
      const item = poolItems[selectedIndex];
      if (item) {
        onPick(item.actualAnswer);
      }
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
              {item.displayText.toLowerCase()}
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
