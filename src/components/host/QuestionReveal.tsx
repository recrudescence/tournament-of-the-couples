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

export function QuestionReveal({
  question,
  chapter,
  isNewChapter,
  revealStage,
  roundNumber,
  onNext
}: QuestionRevealProps) {
  const variant = question.variant as RoundVariant;
  const answerForBoth = question.answerForBoth ?? false;

  // Determine if we should show chapter title stage
  // Only show chapter title on first question of each chapter
  const showChapterStage = isNewChapter && revealStage === 'chapter_title';

  return (
    <div className="box">
      <h2 className="subtitle is-5 has-text-grey mb-4">Question {roundNumber}</h2>

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
              variant={variant}
              options={question.options ?? null}
              answerForBoth={answerForBoth}
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

interface VariantContextProps {
  variant: RoundVariant;
  options: string[] | null;
  answerForBoth: boolean;
  compact?: boolean;
}

function VariantContext({ variant, options, answerForBoth, compact = false }: VariantContextProps) {
  if (variant === 'open_ended') {
    const caption = answerForBoth
      ? 'What is your answer, and your partner\'s answer, to the following question...'
      : 'What is your answer to the following question...';

    return (
      <motion.div
        className={`has-text-centered ${compact ? '' : 'py-5'}`}
        variants={captionEntrance}
        initial="hidden"
        animate="visible"
        transition={springDefault}
      >
        <p className={`has-text-grey-dark ${compact ? 'is-size-6' : 'is-size-5'} is-italic`}>
          {caption}
        </p>
      </motion.div>
    );
  }

  if (variant === 'multiple_choice' && options) {
    return (
      <div className={`${compact ? '' : 'py-4'}`}>
        <div className="columns is-multiline is-centered">
          {options.map((option, index) => (
            <div key={index} className="column is-half-tablet is-one-third-desktop">
              <motion.div
                className="box has-background-light has-text-centered py-4"
                variants={optionTileEntrance}
                initial="hidden"
                animate="visible"
                transition={{ ...springBouncy, delay: staggerDelay(index, 0, 0.1) }}
              >
                <span className={compact ? 'is-size-6' : 'is-size-5'}>{option}</span>
              </motion.div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'binary') {
    return (
      <div className={`${compact ? '' : 'py-4'}`}>
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
            <span className="is-size-4 has-text-grey">vs</span>
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
        {!compact && (
          <p className="has-text-centered has-text-grey is-size-7 mt-2">
            Player names will be filled in for each team
          </p>
        )}
      </div>
    );
  }

  return null;
}

interface RevealButtonProps {
  label: string;
  onClick: () => void;
  isPrimary?: boolean;
}

function RevealButton({ label, onClick, isPrimary = false }: RevealButtonProps) {
  return (
    <motion.button
      className={`button is-fullwidth is-large ${isPrimary ? 'is-primary' : 'is-info is-light'}`}
      onClick={onClick}
      // animate={revealButtonPulse}
      // transition={revealButtonPulseTransition}
      // whileHover={buttonHover}
      whileTap={buttonTap}
    >
      {label}
    </motion.button>
  );
}
