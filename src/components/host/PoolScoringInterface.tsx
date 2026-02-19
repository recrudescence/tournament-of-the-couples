import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import confetti from 'canvas-confetti';
import {PlayerAvatar} from '../common/PlayerAvatar';
import {PlayerPill} from '../common/PlayerPill';
import {TeamName} from '../common/TeamName';
import type {NavDirection} from '../../styles/motion';
import {buttonHover, buttonTap, scoringCardVariants, springBouncy, springStiff} from '../../styles/motion';
import type {CurrentRound, Player} from '../../types/game';

// =============================================================================
// Types
// =============================================================================

// Special key for consolidated empty responses
const EMPTY_ANSWER_KEY = '__EMPTY__';

interface PoolItem {
  key: string; // Unique key for selection (normalized text or EMPTY_ANSWER_KEY)
  text: string; // One of the actual answer texts (for display/reveal calls)
  displayText: string;
  isEmpty: boolean;
  count: number; // Number of authors
  pickCount: number;
  pickersRevealed: boolean;
  authorRevealed: boolean;
  pickers: Player[];
  authors: Player[];
  correctPickers: Player[];
  teamPoints: Record<string, number>; // teamId -> points earned
}

interface PoolScoringInterfaceProps {
  question: string;
  currentRound: CurrentRound;
  onRevealPickers: (answerText: string) => void;
  onRevealAuthor: (answerText: string) => void;
  onFinishRound: () => void;
  revealedPickers: Record<string, Player[]>;
  revealedAuthors: Record<string, { author: Player; authors: Player[]; correctPickers: Player[]; teamPoints?: Record<string, number>; isEmptyAnswer?: boolean }>;
}

// =============================================================================
// Helper Functions
// =============================================================================

// Normalize answer for case-insensitive grouping
function normalizeAnswer(text: string): string {
  return (text || '').toLowerCase().trim();
}

function buildPoolItems(
  answers: Record<string, { text: string }> | undefined,
  picks: Record<string, string> | undefined,
  revealedPickers: Record<string, Player[]>,
  revealedAuthors: Record<string, { authors: Player[]; correctPickers: Player[]; teamPoints?: Record<string, number> }>
): PoolItem[] {
  const items: PoolItem[] = [];
  const pickMap = picks || {};

  // Count picks for empty responses (case-insensitive: empty or whitespace only)
  const emptyPickCount = Object.values(pickMap).filter(p => !p || p.trim() === '').length;

  // Group answers by normalized text
  const answerGroups = new Map<string, { text: string; count: number }>();
  let emptyCount = 0;

  for (const [, answer] of Object.entries(answers || {})) {
    const text = answer.text;
    const isEmpty = !text || text.trim() === '';

    if (isEmpty) {
      emptyCount++;
    } else {
      const normalized = normalizeAnswer(text);
      const existing = answerGroups.get(normalized);
      if (existing) {
        existing.count++;
      } else {
        answerGroups.set(normalized, { text, count: 1 });
      }
    }
  }

  // Build pool items from grouped answers
  for (const [normalized, group] of answerGroups) {
    // Count picks for this answer (case-insensitive)
    const pickCount = Object.values(pickMap).filter(
      p => normalizeAnswer(p) === normalized
    ).length;

    // Look up revealed data by normalized key
    const pickers = revealedPickers[normalized] || [];
    const authorData = revealedAuthors[normalized];
    const pickersRevealed = normalized in revealedPickers;
    const authorRevealed = normalized in revealedAuthors;

    items.push({
      key: normalized,
      text: group.text, // Use one of the original texts for display/reveal
      displayText: group.text.toLowerCase(),
      isEmpty: false,
      count: group.count,
      pickCount,
      pickersRevealed,
      authorRevealed,
      pickers,
      authors: authorData?.authors || [],
      correctPickers: authorData?.correctPickers || [],
      teamPoints: authorData?.teamPoints || {},
    });
  }

  // Add consolidated empty response if any
  if (emptyCount > 0) {
    const emptyPickers = revealedPickers[''] || [];
    const emptyAuthorData = revealedAuthors[''];
    const pickersRevealed = Object.prototype.hasOwnProperty.call(revealedPickers, '');
    const authorRevealed = Object.prototype.hasOwnProperty.call(revealedAuthors, '');

    items.push({
      key: EMPTY_ANSWER_KEY,
      text: '',
      displayText: '(no response)',
      isEmpty: true,
      count: emptyCount,
      pickCount: emptyPickCount,
      pickersRevealed,
      authorRevealed,
      pickers: emptyPickers,
      authors: emptyAuthorData?.authors || [],
      correctPickers: emptyAuthorData?.correctPickers || [],
      teamPoints: emptyAuthorData?.teamPoints || {},
    });
  }

  return items;
}

// =============================================================================
// Sub-components
// =============================================================================

function QuestionDisplay({ question }: { question: string }) {
  return (
    <div className="notification is-primary is-light">
      <p className="is-size-5 has-text-weight-semibold has-text-centered">{question}</p>
    </div>
  );
}

function ProgressBar({
  revealedCount,
  totalCount
}: {
  revealedCount: number;
  totalCount: number;
}) {
  return (
    <div className="mb-4">
      <div className="is-flex is-justify-content-space-between is-align-items-center mb-2">
        <span className="has-text-grey">Tap an answer to reveal</span>
        <span className="has-text-grey">{revealedCount} / {totalCount} revealed</span>
      </div>
      <progress
        className="progress is-primary is-small"
        value={revealedCount}
        max={totalCount}
      />
    </div>
  );
}

function AnswerPoolGrid({
  poolItems,
  onBubbleClick
}: {
  poolItems: PoolItem[];
  onBubbleClick: (key: string) => void;
}) {
  return (
    <div className="response-pool mb-5" style={{ minHeight: '6rem' }}>
      {poolItems.map((item, index) => (
        <button
          key={item.key}
          className={`response-bubble ${item.authorRevealed ? 'is-scored' : ''} ${item.isEmpty ? 'is-empty' : ''}`}
          onClick={() => onBubbleClick(item.key)}
          style={{ '--index': index } as React.CSSProperties}
        >
          {item.displayText}
          {item.count > 1 && (
            <span className="tag is-small is-light ml-2">×{item.count}</span>
          )}
          <span
            className={`tag is-small ml-2 ${item.authorRevealed ? 'is-success' : 'is-info'}`}
            style={{ borderRadius: '999px', minWidth: '1.5rem' }}
          >
            {item.pickCount}
          </span>
        </button>
      ))}
    </div>
  );
}

const GLOW_GREEN = '0 0 0 3px hsl(141, 53%, 53%), 0 0 12px hsl(141, 53%, 53%)';

function StickerPile({
  players,
  glowIds,
  side,
  onConfetti,
}: {
  players: Player[];
  glowIds: Set<string>;
  side: 'left' | 'right';
  onConfetti?: (socketId: string) => void;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: '-1.2rem',
        [side]: '0.5rem',
        display: 'flex',
        perspective: 800,
      }}
    >
      {players.map((player, idx) => {
        const rotation = (idx % 2 === 0 ? -1 : 1) * (5 + idx * 3);
        const isGlowing = glowIds.has(player.socketId);

        return (
          <motion.div
            key={`${player.socketId}-${isGlowing}`}
            initial={{ opacity: 0, scale: 0, y: -30, rotate: rotation * 2 }}
            animate={{
              opacity: 1,
              scale: isGlowing ? 1.1 : 1,
              y: 0,
              rotate: rotation,
            }}
            transition={{ ...springBouncy, delay: idx * 0.08 }}
            style={{
              marginLeft: idx > 0 ? '-0.75rem' : 0,
              zIndex: isGlowing ? 10 : players.length - idx,
              borderRadius: '50%',
              boxShadow: isGlowing ? GLOW_GREEN : undefined,
            }}
            data-tooltip-id="tooltip"
            data-tooltip-content={player.name + (isGlowing ? ' ✓' : '')}
            data-picker-id={player.socketId}
            onAnimationComplete={() => {
              if (isGlowing && onConfetti) onConfetti(player.socketId);
            }}
          >
            <PlayerAvatar avatar={player.avatar} size="medium" />
          </motion.div>
        );
      })}
    </div>
  );
}

function PillList({
  label,
  players,
  glowIds,
}: {
  label: string;
  players: Player[];
  glowIds?: Set<string>;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="has-text-centered"
    >
      <motion.div
        className="is-size-7 mb-3 mt-3 has-text-grey"
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {label}
      </motion.div>
      <div className="is-flex is-align-items-center is-justify-content-center is-flex-wrap-wrap gap-sm">
        {players.map((player, idx) => (
          <motion.div
            key={player.socketId}
            initial={{ opacity: 0, scale: 0.5, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ ...springBouncy, delay: idx * 0.1 }}
          >
            <PlayerPill
              player={player}
              size="small"
              style={glowIds?.has(player.socketId) ? { boxShadow: GLOW_GREEN } : undefined}
            />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function PointsBadges({
  teamPoints,
  correctPickers,
  authors,
  isEmpty
}: {
  teamPoints: Record<string, number>;
  correctPickers: Player[];
  authors: Player[];
  isEmpty: boolean;
}) {
  if (correctPickers.length === 0) return null;

  if (isEmpty) {
    // Empty answer: show consolidated "no points" message
    return (
      <motion.div
        key="no-points"
        initial={{ opacity: 0, rotateX: -90, y: -20 }}
        animate={{ opacity: 1, rotateX: 0, y: 0 }}
        exit={{ opacity: 0, rotateX: 90, y: -20 }}
        transition={{ ...springBouncy, delay: 0.3 }}
        className="notification is-info is-flex is-align-items-center is-justify-content-center gap-sm"
        style={{ marginTop: '1rem', transformOrigin: 'top center', perspective: 800 }}
      >
        <strong>correct guesses!</strong> but no points
      </motion.div>
    );
  }

  // Regular answer: show points per team
  return (
    <>
      {Object.entries(teamPoints).map(([teamId, points], idx) => {
        // Find the players for this team from correct pickers
        const teamPickers = correctPickers.filter(p => p.teamId === teamId);
        const picker = teamPickers[0];
        const partnerAuthor = picker ? authors.find(a => a.partnerId === picker.socketId) : undefined;

        return (
          <motion.div
            key={teamId}
            initial={{ opacity: 0, rotateX: -90, y: -20 }}
            animate={{ opacity: 1, rotateX: 0, y: 0 }}
            exit={{ opacity: 0, rotateX: 90, y: -20 }}
            transition={{ ...springBouncy, delay: 0.3 + idx * 0.15 }}
            className="notification is-secondary is-flex is-align-items-center is-justify-content-center gap-sm"
            style={{ marginTop: idx === 0 ? '1rem' : '0.5rem', transformOrigin: 'top center', perspective: 800 }}
          >
            <strong>+{points} {points === 1 ? 'point' : 'points'}</strong> for
            <TeamName player1={picker} player2={partnerAuthor} size="small" />
            !
          </motion.div>
        );
      })}
    </>
  );
}

function AnswerDetailModal({
  answerData,
  question,
  navDirection,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  onRevealPickers,
  onRevealAuthor,
  onClose
}: {
  answerData: PoolItem;
  question: string;
  navDirection: NavDirection;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onRevealPickers: (text: string) => void;
  onRevealAuthor: (text: string) => void;
  onClose: () => void;
}) {
  const answerDisplayText = !answerData.text || answerData.text.trim() === '' ? '(no response)' : answerData.text;
  const isEmptyDisplay = !answerData.text || answerData.text.trim() === '';

  // IDs that get a glow when author is revealed (correct pickers + matched authors)
  const correctPickerIds = new Set(answerData.correctPickers.map(p => p.socketId));
  const glowPickers = answerData.authorRevealed ? correctPickerIds : new Set<string>();
  // Only glow authors whose teammate is a correct picker
  const correctPickerTeamIds = new Set(answerData.correctPickers.map(p => p.teamId));
  const glowAuthors = answerData.authorRevealed
    ? new Set(answerData.authors.filter(a => correctPickerTeamIds.has(a.teamId)).map(a => a.socketId))
    : new Set<string>();

  const fireConfetti = (socketId: string) => {
    if (answerData.isEmpty) return;
    const el = document.querySelector(`[data-picker-id="${socketId}"]`);
    if (el) {
      const rect = el.getBoundingClientRect();
      const x = (rect.left + rect.width / 2) / window.innerWidth;
      const y = (rect.top + rect.height / 2) / window.innerHeight;
      confetti({
        particleCount: 40,
        startVelocity: 20,
        spread: 360,
        origin: { x, y },
        colors: ['#48c774', '#3ec46d', '#00d1b2', '#FFD700'],
        ticks: 80,
        gravity: 0.8,
        scalar: 0.9,
      });
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && hasPrev) {
        onPrev();
      } else if (e.key === 'ArrowRight' && hasNext) {
        onNext();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [hasPrev, hasNext]);

  const cardVariants = scoringCardVariants(navDirection);
  const [initialTilt] = useState(() => ({
    rotateX: -20 + Math.random() * 10,
    rotateZ: (Math.random() - 0.5) * 8,
  }));

  return (
    <motion.div
      className="modal is-active"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="modal-background"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.div
        className="modal-card"
        key={answerData.key}
        custom={initialTilt}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={cardVariants}
        transition={springStiff}
        style={{ maxWidth: '600px', overflow: 'visible' }}
      >
        <header className="modal-card-head has-background-white">
          <QuestionDisplay question={question} />
        </header>

        <section className="modal-card-body has-background-light">
          {/* Answer box with sticker piles */}
          <div className="mb-4" style={{ position: 'relative' }}>
            <div className="box has-background-white has-text-centered py-5 px-6" style={{ position: 'relative' }}>
              <h3
                className={`title is-4 mb-0 ${isEmptyDisplay ? 'has-text-grey-light' : ''}`}
                style={{ whiteSpace: 'pre-wrap', ...(isEmptyDisplay ? { fontStyle: 'italic' } : {}) }}
              >
                "{answerDisplayText}"
              </h3>

              {/* Picker stickers - left side */}
              {answerData.pickersRevealed && answerData.pickers.length > 0 && (
                <StickerPile
                  players={answerData.pickers}
                  glowIds={glowPickers}
                  side="left"
                  onConfetti={fireConfetti}
                />
              )}

              {/* Author stickers - right side */}
              {answerData.authorRevealed && (
                <StickerPile
                  players={answerData.authors}
                  glowIds={glowAuthors}
                  side="right"
                />
              )}
            </div>
          </div>

          {/* Action buttons / revealed info */}
          <div className="is-flex is-flex-direction-column" style={{ gap: '0.75rem' }}>
            {/* Pickers section */}
            <AnimatePresence mode="wait" initial={false}>
              {answerData.pickCount === 0 ? (
                <motion.p
                  key="no-pickers"
                  className="has-text-grey has-text-centered py-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  No one picked this answer
                </motion.p>
              ) : !answerData.pickersRevealed ? (
                <motion.button
                  key="reveal-pickers"
                  className="button is-info is-fullwidth is-medium"
                  onClick={() => onRevealPickers(answerData.text)}
                  whileHover={buttonHover}
                  whileTap={buttonTap}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0, padding: 0, overflow: 'hidden', transition: { duration: 0.2 } }}
                >
                  <span className="icon"><i className="fas fa-users" /></span>
                  <span>Reveal Pickers ({answerData.pickCount})</span>
                </motion.button>
              ) : (
                <motion.div
                  key="pickers-display"
                  initial={{ opacity: 0, height: 0, overflow: 'hidden' }}
                  animate={{ opacity: 1, height: 'auto', overflow: 'visible' }}
                  exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                  transition={{ duration: 0.2 }}
                >
                  <PillList label="Picked by:" players={answerData.pickers} glowIds={glowPickers} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Author section */}
            <AnimatePresence mode="wait" initial={false}>
              {!answerData.authorRevealed ? (
                <motion.button
                  key="reveal-author"
                  className="button is-warning is-fullwidth is-medium"
                  onClick={() => onRevealAuthor(answerData.text)}
                  whileHover={buttonHover}
                  whileTap={buttonTap}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0, padding: 0, overflow: 'hidden', transition: { duration: 0.2 } }}
                >
                  <span className="icon"><i className="fas fa-user-secret" /></span>
                  <span>Reveal Author</span>
                </motion.button>
              ) : !answerData.isEmpty ? (
                <motion.div
                  key="author-display"
                  initial={{ opacity: 0, height: 0, overflow: 'hidden' }}
                  animate={{ opacity: 1, height: 'auto', overflow: 'visible' }}
                  exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                  transition={{ duration: 0.2 }}
                >
                  <PillList label="Written by:" players={answerData.authors} glowIds={glowAuthors} />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

        </section>

        <footer className="modal-card-foot is-justify-content-space-between has-background-white p-4">
          <motion.button
            className="button is-medium"
            onClick={onPrev}
            disabled={!hasPrev}
            style={{ visibility: hasPrev ? 'visible' : 'hidden' }}
            whileHover={buttonHover}
            whileTap={buttonTap}
          >
            ← Prev
          </motion.button>
          <motion.button
            className="button is-medium is-primary"
            onClick={hasNext ? onNext : onClose}
            style={{ visibility: hasNext ? 'visible' : 'hidden' }}
            whileHover={buttonHover}
            whileTap={buttonTap}
          >
            Next →
          </motion.button>
        </footer>
      </motion.div>

      {/* Floating points badges below modal */}
      <AnimatePresence>
        {answerData.authorRevealed && (
          <PointsBadges
            teamPoints={answerData.teamPoints}
            correctPickers={answerData.correctPickers}
            authors={answerData.authors}
            isEmpty={answerData.isEmpty}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function PoolScoringInterface({
  question,
  currentRound,
  onRevealPickers,
  onRevealAuthor,
  onFinishRound,
  revealedPickers,
  revealedAuthors,
}: PoolScoringInterfaceProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [navDirection, setNavDirection] = useState<NavDirection>(null);

  // Build consolidated answer data (group by normalized text)
  const poolItems = useMemo(() => {
    return buildPoolItems(
      currentRound.answers,
      currentRound.picks,
      revealedPickers,
      revealedAuthors
    );
  }, [currentRound.answers, currentRound.picks, revealedPickers, revealedAuthors]);

  const selectedAnswerData = selectedIndex !== null ? poolItems[selectedIndex] ?? null : null;
  const allRevealed = poolItems.every(a => a.authorRevealed);
  const revealedCount = poolItems.filter(a => a.authorRevealed).length;
  const totalCount = poolItems.length;

  const handleBubbleClick = useCallback((key: string) => {
    const index = poolItems.findIndex(item => item.key === key);
    if (index !== -1) {
      setNavDirection(null);
      setSelectedIndex(index);
    }
  }, [poolItems]);

  const handlePrev = useCallback(() => {
    setNavDirection('prev');
    setSelectedIndex(prev => prev !== null && prev > 0 ? prev - 1 : prev);
  }, []);

  const handleNext = useCallback(() => {
    setNavDirection('next');
    setSelectedIndex(prev => prev !== null && prev < poolItems.length - 1 ? prev + 1 : prev);
  }, [poolItems.length]);

  const closeModal = useCallback(() => {
    setSelectedIndex(null);
    setNavDirection(null);
  }, []);

  return (
    <div className="pool-scoring box">
      <QuestionDisplay question={question} />

      <ProgressBar revealedCount={revealedCount} totalCount={totalCount} />

      <AnswerPoolGrid poolItems={poolItems} onBubbleClick={handleBubbleClick} />

      {/* Finish Round Button */}
      {allRevealed && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="has-text-centered"
        >
          <motion.button
            className="button is-success is-large"
            onClick={onFinishRound}
            whileHover={buttonHover}
            whileTap={buttonTap}
          >
            Finish Round
          </motion.button>
        </motion.div>
      )}

      {/* Answer Modal */}
      <AnimatePresence>
        {selectedIndex !== null && selectedAnswerData && (
          <AnswerDetailModal
            key={selectedAnswerData.key}
            answerData={selectedAnswerData}
            question={question}
            navDirection={navDirection}
            hasPrev={selectedIndex > 0}
            hasNext={selectedIndex < poolItems.length - 1}
            onPrev={handlePrev}
            onNext={handleNext}
            onRevealPickers={onRevealPickers}
            onRevealAuthor={onRevealAuthor}
            onClose={closeModal}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
