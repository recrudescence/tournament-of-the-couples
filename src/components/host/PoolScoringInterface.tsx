import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlayerAvatar } from '../common/PlayerAvatar';
import {
  slideInUp,
  springDefault,
  staggerDelay,
  buttonHover,
  buttonTap,
} from '../../styles/motion';
import type { Player, CurrentRound } from '../../types/game';

interface PoolAnswer {
  text: string;
  pickCount: number;
  pickersRevealed: boolean;
  authorRevealed: boolean;
  pickers: Player[];
  author: Player | null;
  correctPickers: Player[];
  pointAwarded: boolean;
}

interface PoolScoringInterfaceProps {
  currentRound: CurrentRound;
  onRevealPickers: (answerText: string) => void;
  onRevealAuthor: (answerText: string) => void;
  onFinishRound: () => void;
  revealedPickers: Record<string, Player[]>;
  revealedAuthors: Record<string, { author: Player; correctPickers: Player[] }>;
}

export function PoolScoringInterface({
  currentRound,
  onRevealPickers,
  onRevealAuthor,
  onFinishRound,
  revealedPickers,
  revealedAuthors,
}: PoolScoringInterfaceProps) {
  const [currentAnswerIndex, setCurrentAnswerIndex] = useState(0);

  // Build answer data sorted by pick count
  const answers: PoolAnswer[] = Object.entries(currentRound.answers || {})
    .map(([, answer]) => {
      const text = answer.text;
      const picks = currentRound.picks || {};
      const pickCount = Object.values(picks).filter(p => p === text).length;
      const pickers = revealedPickers[text] || [];
      const authorData = revealedAuthors[text];

      return {
        text,
        pickCount,
        pickersRevealed: text in revealedPickers,
        authorRevealed: text in revealedAuthors,
        pickers,
        author: authorData?.author || null,
        correctPickers: authorData?.correctPickers || [],
        pointAwarded: (authorData?.correctPickers?.length || 0) > 0,
      };
    })
    .sort((a, b) => b.pickCount - a.pickCount);

  const currentAnswer = answers[currentAnswerIndex];
  const allRevealed = answers.every(a => a.authorRevealed);

  const handleNext = () => {
    if (currentAnswerIndex < answers.length - 1) {
      setCurrentAnswerIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentAnswerIndex > 0) {
      setCurrentAnswerIndex(prev => prev - 1);
    }
  };

  if (!currentAnswer) {
    return (
      <div className="box has-text-centered">
        <p>No answers to score</p>
        <button className="button is-primary mt-4" onClick={onFinishRound}>
          Finish Round
        </button>
      </div>
    );
  }

  return (
    <div className="pool-scoring">
      {/* Progress indicator */}
      <div className="mb-4">
        <div className="is-flex is-justify-content-space-between is-align-items-center mb-2">
          <span className="has-text-grey">
            Answer {currentAnswerIndex + 1} of {answers.length}
          </span>
          <span className="has-text-grey">
            {answers.filter(a => a.authorRevealed).length} revealed
          </span>
        </div>
        <progress
          className="progress is-primary is-small"
          value={answers.filter(a => a.authorRevealed).length}
          max={answers.length}
        />
      </div>

      {/* Current answer card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentAnswer.text}
          variants={slideInUp}
          initial="hidden"
          animate="visible"
          exit="hidden"
          transition={springDefault}
          className="box"
        >
          <div className="has-text-centered mb-4">
            <h3 className="title is-4 mb-2">"{currentAnswer.text}"</h3>
            <div className="tags is-centered">
              <span className="tag is-info is-medium">
                {currentAnswer.pickCount} pick{currentAnswer.pickCount !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Pickers section */}
          <div className="mb-4">
            <h4 className="subtitle is-6 mb-2">Who picked this answer?</h4>
            {!currentAnswer.pickersRevealed ? (
              <motion.button
                className="button is-info is-fullwidth"
                onClick={() => onRevealPickers(currentAnswer.text)}
                whileHover={buttonHover}
                whileTap={buttonTap}
              >
                Reveal Pickers
              </motion.button>
            ) : (
              <div className="is-flex is-flex-wrap-wrap gap-2">
                {currentAnswer.pickers.length > 0 ? (
                  currentAnswer.pickers.map((picker, idx) => (
                    <motion.div
                      key={picker.socketId}
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ ...springDefault, delay: staggerDelay(idx) }}
                      className="is-flex is-align-items-center"
                    >
                      <PlayerAvatar avatar={picker.avatar} size="small" />
                      <span className="ml-1">{picker.name}</span>
                    </motion.div>
                  ))
                ) : (
                  <span className="has-text-grey-light">No one picked this</span>
                )}
              </div>
            )}
          </div>

          {/* Author section */}
          <div className="mb-4">
            <h4 className="subtitle is-6 mb-2">Who wrote this answer?</h4>
            {!currentAnswer.authorRevealed ? (
              <motion.button
                className="button is-warning is-fullwidth"
                onClick={() => onRevealAuthor(currentAnswer.text)}
                disabled={!currentAnswer.pickersRevealed}
                whileHover={currentAnswer.pickersRevealed ? buttonHover : undefined}
                whileTap={currentAnswer.pickersRevealed ? buttonTap : undefined}
              >
                Reveal Author
              </motion.button>
            ) : (
              <div>
                <motion.div
                  initial={{ opacity: 0, scale: 0.5, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={springDefault}
                  className="is-flex is-align-items-center is-justify-content-center mb-3"
                >
                  <PlayerAvatar avatar={currentAnswer.author?.avatar ?? null} size="medium" />
                  <span className="ml-2 is-size-5 has-text-weight-semibold">
                    {currentAnswer.author?.name}
                  </span>
                </motion.div>

                {/* Point awarded indicator */}
                {currentAnswer.pointAwarded && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...springDefault, delay: 0.3 }}
                    className="notification is-success is-light has-text-centered"
                  >
                    <span className="icon">
                      <i className="fas fa-check-circle"></i>
                    </span>
                    <strong>+1 point</strong> to{' '}
                    {currentAnswer.correctPickers.map(p => p.name).join(', ')}'s team!
                  </motion.div>
                )}
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="buttons is-centered mt-5">
            <button
              className="button"
              onClick={handlePrevious}
              disabled={currentAnswerIndex === 0}
            >
              Previous
            </button>
            {currentAnswerIndex < answers.length - 1 ? (
              <button
                className="button is-primary"
                onClick={handleNext}
              >
                Next Answer
              </button>
            ) : allRevealed ? (
              <motion.button
                className="button is-success is-large"
                onClick={onFinishRound}
                whileHover={buttonHover}
                whileTap={buttonTap}
              >
                Finish Round
              </motion.button>
            ) : (
              <button className="button is-light" disabled>
                Reveal all authors first
              </button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Answer overview dots */}
      <div className="is-flex is-justify-content-center gap-2 mt-4">
        {answers.map((answer, idx) => (
          <button
            key={answer.text}
            className={`pool-answer-dot ${idx === currentAnswerIndex ? 'is-active' : ''} ${answer.authorRevealed ? 'is-revealed' : ''}`}
            onClick={() => setCurrentAnswerIndex(idx)}
            title={answer.text}
          />
        ))}
      </div>
    </div>
  );
}
