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
  onNext
}: QuestionRevealProps) {
  const variant = question.variant as RoundVariant;
  const answerForBoth = question.answerForBoth ?? false;

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
              answerForBoth={answerForBoth}
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

interface VariantContextProps {
  variant: RoundVariant;
  options: string[] | null;
  answerForBoth: boolean;
  questionText: string;
  compact?: boolean;
}

function VariantContext({ variant, options, answerForBoth, questionText, compact = false }: VariantContextProps) {
  const [isBlurred, setIsBlurred] = useState(true);

  useEffect(() => {
    if (compact) return; // Skip blur timer in compact mode
    const timer = setTimeout(() => setIsBlurred(false), 3000);
    return () => clearTimeout(timer);
  }, [compact]);

  const renderQuestion = () => (
    <motion.div
      className={`has-text-centered ${compact ? 'mt-1' : 'mt-3'} mb-5`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: compact ? 0 : 0.3 }}
    >
      <p
        className={`box has-text-weight-semibold ${compact ? 'is-size-2' : 'is-size-2'}`}
        style={{
          filter: compact ? 'none' : (isBlurred ? 'blur(8px)' : 'blur(0)'),
          transition: 'filter 0.5s ease-out',
          userSelect: isBlurred ? 'none' : 'auto',
        }}
      >
        {questionText}
      </p>
    </motion.div>
  );

  if (variant === 'open_ended' || variant === 'pool_selection') {
    const caption = answerForBoth
      ? 'What is your answer, and your partner\'s answer, to the following question...'
      : 'What is your answer to the following question...';

    return (
      <>
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
        {renderQuestion()}
      </>
    );
  }

  if (variant === 'multiple_choice' && options) {
    return (
      <>
        {renderQuestion()}
        <div className={`${compact ? 'mt-3' : 'py-4 mt-4'}`}>
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
      </>
    );
  }

  if (variant === 'binary') {
    return (
      <>
        {renderQuestion()}
        <div className={`${compact ? 'mt-3' : 'py-4 mt-4'}`}>
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
          {!compact && (
            <p className="has-text-centered has-text-grey is-size-7 mt-2">
              Player names will be filled in for each team
            </p>
          )}
        </div>
      </>
    );
  }

  // Fallback for unknown variants - just show the question
  return renderQuestion();
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
