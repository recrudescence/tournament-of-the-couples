import {useMemo, useState} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {springDefault} from '../../styles/motion';
import type {PlayerAvatar as PlayerAvatarType, PoolAnswer} from '../../types/game';

// =============================================================================
// Types
// =============================================================================

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
  count: number; // For consolidated responses
}

// =============================================================================
// Helper Functions
// =============================================================================

// Normalize answer for case-insensitive grouping
function normalizeAnswer(text: string): string {
  return (text || '').toLowerCase().trim();
}

function buildPoolItems(
  answers: PoolAnswer[],
  myPlayerName: string,
  myAnswerText: string,
  myAnswerIsEmpty: boolean
): PoolItem[] {
  const items: PoolItem[] = [];

  // Track empty responses
  let emptyFromOthers = 0;
  let myEmptyIncluded = false;

  // Group non-empty answers by normalized text (excluding viewer's own)
  const otherAnswerGroups = new Map<string, { displayText: string; actualAnswer: string; count: number }>();

  for (const entry of answers) {
    const isEmpty = !entry.answer || entry.answer.trim() === '';
    const isOwn = entry.playerName === myPlayerName;
    const normalized = normalizeAnswer(entry.answer);

    if (isEmpty) {
      if (isOwn) {
        myEmptyIncluded = true;
      } else {
        emptyFromOthers++;
      }
    } else if (isOwn) {
      // Add viewer's own answer (always separate, marked "yours")
      items.push({
        displayText: entry.answer,
        actualAnswer: entry.answer,
        isOwn: true,
        isEmpty: false,
        count: 1,
      });
    } else {
      // Group other players' answers by normalized text
      const existing = otherAnswerGroups.get(normalized);
      if (existing) {
        existing.count++;
      } else {
        otherAnswerGroups.set(normalized, {
          displayText: entry.answer,
          actualAnswer: entry.answer,
          count: 1,
        });
      }
    }
  }

  // Add consolidated groups from other players
  for (const group of otherAnswerGroups.values()) {
    items.push({
      displayText: group.displayText,
      actualAnswer: group.actualAnswer,
      isOwn: false,
      isEmpty: false,
      count: group.count,
    });
  }

  // Add consolidated empty responses
  if (myAnswerIsEmpty && myEmptyIncluded) {
    // Player submitted empty: show their own
    items.push({
      displayText: '(no response)',
      actualAnswer: myAnswerText,
      isOwn: true,
      isEmpty: true,
      count: 1,
    });
  }
  if (emptyFromOthers > 0) {
    // Consolidated empty from others
    items.push({
      displayText: '(no response)',
      actualAnswer: '',
      isOwn: false,
      isEmpty: true,
      count: emptyFromOthers,
    });
  }

  return items;
}

function getPoolBubbleClassName(item: PoolItem, isSelected: boolean): string {
  const classes = ['response-bubble'];

  if (item.isOwn) {
    classes.push('is-own');
    if (item.isEmpty) classes.push('is-empty');
  } else if (item.isEmpty) {
    classes.push('is-empty-pickable');
  }

  if (isSelected) classes.push('is-selected');

  return classes.join(' ');
}

// =============================================================================
// Sub-components
// =============================================================================

function PoolHeader({ partnerName }: { partnerName: string }) {
  return (
    <div className="has-text-centered mb-4">
      <h3 className="title is-5 mb-2">Which answer did {partnerName} write?</h3>
      <p className="subtitle is-6 has-text-grey">
        Tap an answer to select it
      </p>
    </div>
  );
}

function PoolBubble({
  item,
  index,
  isSelected,
  onSelect
}: {
  item: PoolItem;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const isDisabled = item.isOwn;

  return (
    <button
      key={item.actualAnswer || `empty-${item.isOwn ? 'own' : 'other'}`}
      className={getPoolBubbleClassName(item, isSelected)}
      onClick={() => !isDisabled && onSelect()}
      disabled={isDisabled}
      style={{ '--index': index } as React.CSSProperties}
    >
      {item.displayText.toLowerCase()}
      {item.isOwn && (
        <span className="tag is-small is-light ml-2">yours</span>
      )}
      {!item.isOwn && item.count > 1 && (
        <span className="tag is-small is-light ml-2">×{item.count}</span>
      )}
    </button>
  );
}

function ConfirmButton({ onConfirm }: { onConfirm: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={springDefault}
      className="confirmation-panel mt-5"
    >
      <button
        className="button is-primary is-medium is-fullwidth"
        onClick={onConfirm}
      >
        Confirm Pick
      </button>
    </motion.div>
  );
}

function PickSubmittedStatus() {
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

// =============================================================================
// Main Component
// =============================================================================

export function ResponsePool({
  answers,
  myPlayerName,
  partnerName,
  hasPicked,
  onPick,
}: ResponsePoolProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Find my answer from the pool
  const myAnswerEntry = answers.find(a => a.playerName === myPlayerName);
  const myAnswerText = myAnswerEntry?.answer ?? '';
  const myAnswerNormalized = normalizeAnswer(myAnswerText);
  const myAnswerIsEmpty = !myAnswerNormalized;

  // Build consolidated pool
  const poolItems = useMemo(() => {
    return buildPoolItems(answers, myPlayerName, myAnswerText, myAnswerIsEmpty);
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
    return <PickSubmittedStatus />;
  }

  return (
    <div className="box">
      <PoolHeader partnerName={partnerName} />

      {/* Answer Pool */}
      <div className="response-pool">
        {poolItems.map((item, index) => (
          <PoolBubble
            key={item.actualAnswer || `empty-${item.isOwn ? 'own' : 'other'}`}
            item={item}
            index={index}
            isSelected={index === selectedIndex}
            onSelect={() => handleSelectAnswer(index)}
          />
        ))}
      </div>

      {/* Confirmation */}
      <AnimatePresence>
        {selectedIndex !== null && (
          <ConfirmButton onConfirm={handleConfirm} />
        )}
      </AnimatePresence>
    </div>
  );
}
