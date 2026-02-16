import {useEffect, useState} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {ChapterTitleCard} from './ChapterTitleCard';
import type {ImportedChapter, ImportedQuestion, RoundVariant} from '../../types/game';
import {
  binaryCardEntrance,
  buttonTap,
  captionEntrance,
  optionTileEntrance,
  springBouncy,
  springDefault,
  staggerDelay
} from '../../styles/motion';

// =============================================================================
// Types
// =============================================================================

export type RevealStage = 'chapter_title' | 'variant_context';

interface QuestionRevealProps {
  question: ImportedQuestion;
  chapter: ImportedChapter;
  isNewChapter: boolean;
  isLastQuestion: boolean;
  revealStage: RevealStage;
  roundNumber: number;
  onNext: () => void;
}

interface RevealButtonProps {
  label: string;
  onClick: () => void;
  isPrimary?: boolean;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getQuestionTypeLabel(variant: RoundVariant): string {
  switch (variant) {
    case 'open_ended': return 'Open Ended';
    case 'pool_selection': return 'Pool Selection';
    case 'multiple_choice': return 'Multiple Choice';
    case 'binary': return 'Binary';
    default: return '';
  }
}

// =============================================================================
// Sub-components
// =============================================================================

function QuestionTypeTag({ variant }: { variant: RoundVariant }) {
  const label = getQuestionTypeLabel(variant);
  if (!label) return null;

  return (
    <motion.div
      className="has-text-centered"
      variants={captionEntrance}
      initial="hidden"
      animate="visible"
      transition={springDefault}
    >
      <p className="tag is-size-5 is-warning">
        {label}
      </p>
    </motion.div>
  );
}

function BlurredQuestion({
  questionText,
  isBlurred
}: {
  questionText: string;
  isBlurred: boolean;
}) {
  return (
    <motion.div
      className="has-text-centered mt-3 mb-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3 }}
    >
      <p
        className="box has-text-weight-semibold is-size-2 blur-reveal"
        style={{
          filter: isBlurred ? 'blur(8px)' : 'blur(0)',
          transition: 'filter 0.5s ease-out',
          userSelect: isBlurred ? 'none' : 'auto',
        }}
      >
        {questionText}
      </p>
    </motion.div>
  );
}

function MultipleChoiceGrid({ options }: { options: string[] }) {
  return (
    <div className="py-4 mt-4">
      <div className="columns is-multiline is-centered">
        {options.map((option, index) => (
          <div key={index} className="column is-half-tablet is-one-third-desktop">
            <motion.div
              className="box has-background-info-light has-text-centered py-4"
              variants={optionTileEntrance}
              initial="hidden"
              animate="visible"
              transition={{ ...springBouncy, delay: staggerDelay(index, 0, 0.1) }}
            >
              <span className="is-size-5">{option}</span>
            </motion.div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BinaryChoiceGrid() {
  return (
    <div className="py-4 mt-4">
      <div className="columns is-centered">
        <div className="column is-5">
          <motion.div
            className="box has-background-info-light has-text-centered py-5"
            variants={binaryCardEntrance}
            initial="hidden"
            animate="visible"
            transition={{ ...springBouncy, delay: 0 }}
            style={{ perspective: 1000 }}
          >
            <span className="is-size-4">Player 1</span>
          </motion.div>
        </div>
        <div className="column is-2 is-flex is-align-items-center is-justify-content-center">
          <span className="is-size-4 has-text-grey">or</span>
        </div>
        <div className="column is-5">
          <motion.div
            className="box has-background-warning-light has-text-centered py-5"
            variants={binaryCardEntrance}
            initial="hidden"
            animate="visible"
            transition={{ ...springBouncy, delay: 0.15 }}
            style={{ perspective: 1000 }}
          >
            <span className="is-size-4">Player 2</span>
          </motion.div>
        </div>
      </div>
      <p className="has-text-centered has-text-grey is-size-7 mt-2">
        Player names will be filled in for each team
      </p>
    </div>
  );
}

function VariantContext({
  variant,
  options,
  questionText
}: {
  variant: RoundVariant;
  options: string[] | null;
  questionText: string;
}) {
  const [isBlurred, setIsBlurred] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsBlurred(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  // Open ended or pool selection - just show question
  if (variant === 'open_ended' || variant === 'pool_selection') {
    return (
      <>
        <QuestionTypeTag variant={variant} />
        <BlurredQuestion questionText={questionText} isBlurred={isBlurred} />
      </>
    );
  }

  // Multiple choice - show question and options grid
  if (variant === 'multiple_choice' && options) {
    return (
      <>
        <QuestionTypeTag variant={variant} />
        <BlurredQuestion questionText={questionText} isBlurred={isBlurred} />
        <MultipleChoiceGrid options={options} />
      </>
    );
  }

  // Binary - show question and binary choice cards
  if (variant === 'binary') {
    return (
      <>
        <QuestionTypeTag variant={variant} />
        <BlurredQuestion questionText={questionText} isBlurred={isBlurred} />
        <BinaryChoiceGrid />
      </>
    );
  }

  // Fallback for unknown variants - just show the question
  return <BlurredQuestion questionText={questionText} isBlurred={isBlurred} />;
}

function RevealButton({ label, onClick, isPrimary = false }: RevealButtonProps) {
  return (
    <motion.button
      className={`button is-fullwidth is-large ${isPrimary ? 'is-primary' : 'is-info is-light'}`}
      onClick={onClick}
      whileTap={buttonTap}
    >
      {label}
    </motion.button>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function QuestionReveal({
  question,
  chapter,
  isNewChapter,
  revealStage,
  onNext
}: QuestionRevealProps) {
  const variant = question.variant as RoundVariant;

  // Determine if we should show chapter title stage
  // Only show chapter title on first question of each chapter
  const showChapterStage = isNewChapter && revealStage === 'chapter_title';

  return (
    <div className="box">
      <AnimatePresence mode="wait">
        {showChapterStage && (
          <motion.div key="chapter" exit={{ opacity: 0 }}>
            <ChapterTitleCard title={chapter.title} />
            <motion.div
              className="mt-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <RevealButton label="Next" onClick={onNext} />
            </motion.div>
          </motion.div>
        )}

        {revealStage === 'variant_context' && (
          <motion.div
            key="variant"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <VariantContext
              key={question.question} // Reset blur state when question changes
              variant={variant}
              options={question.options ?? null}
              questionText={question.question}
            />
            <motion.div
              className="mt-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <RevealButton label="Begin Answering" onClick={onNext} isPrimary />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
