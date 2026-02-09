import {useState} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import confetti from 'canvas-confetti';
import {PlayerAvatar} from '../common/PlayerAvatar';
import {TeamName} from '../common/TeamName';
import {bubbleEntrance, buttonHover, buttonTap, springBouncy, springDefault, staggerDelay,} from '../../styles/motion';
import type {CurrentRound, Player} from '../../types/game';

interface PoolScoringInterfaceProps {
  question: string;
  currentRound: CurrentRound;
  onRevealPickers: (answerText: string) => void;
  onRevealAuthor: (answerText: string) => void;
  onFinishRound: () => void;
  revealedPickers: Record<string, Player[]>;
  revealedAuthors: Record<string, { author: Player; authors: Player[]; correctPickers: Player[] }>;
}

export function PoolScoringInterface({
  question,
  currentRound,
  onRevealPickers,
  onRevealAuthor,
  onFinishRound,
  revealedPickers,
  revealedAuthors,
}: PoolScoringInterfaceProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);

  // Build answer data
  const answers = Object.entries(currentRound.answers || {}).map(([, answer]) => {
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
      authors: authorData?.authors || [],
      correctPickers: authorData?.correctPickers || [],
    };
  });

  const selectedAnswerData = answers.find(a => a.text === selectedAnswer);
  const allRevealed = answers.every(a => a.authorRevealed);
  const revealedCount = answers.filter(a => a.authorRevealed).length;

  const handleBubbleClick = (text: string) => {
    setSelectedAnswer(text);
  };

  const closeModal = () => {
    setSelectedAnswer(null);
  };

  return (
    <div className="pool-scoring box">
      {/* Question */}
      <div className="notification is-primary is-light mb-4">
        <p className="is-size-5 has-text-weight-semibold has-text-centered">{question}</p>
      </div>

      {/* Progress */}
      <div className="mb-4">
        <div className="is-flex is-justify-content-space-between is-align-items-center mb-2">
          <span className="has-text-grey">Tap an answer to reveal</span>
          <span className="has-text-grey">{revealedCount} / {answers.length} revealed</span>
        </div>
        <progress
          className="progress is-primary is-small"
          value={revealedCount}
          max={answers.length}
        />
      </div>

      {/* Answer Pool */}
      <div className="response-pool mb-5" style={{ minHeight: '120px' }}>
        <AnimatePresence>
          {answers.map((answer, index) => {
            const isEmpty = !answer.text || answer.text.trim() === '';
            const displayText = isEmpty ? '(no response)' : answer.text;
            return (
              <motion.span key={index}>
                <motion.button
                  variants={bubbleEntrance}
                  initial="hidden"
                  animate="visible"
                  transition={{ ...springDefault, delay: staggerDelay(index, 0, 0.08) }}
                  className={`response-bubble ${answer.authorRevealed ? 'is-scored' : ''} ${isEmpty ? 'is-empty' : ''}`}
                  onClick={() => handleBubbleClick(answer.text)}
                  whileHover={{ scale: 1.05, y: -3 }}
                  whileTap={{ scale: 0.97 }}
                >
                  {displayText}
                  <span className={`tag is-small ml-2 ${answer.authorRevealed ? 'is-success' : 'is-info'}`} style={{
                    borderRadius: '999px',
                    minWidth: '1.5rem',
                  }}>
                    {answer.pickCount}
                  </span>
                </motion.button>
              </motion.span>
            );
          })}
        </AnimatePresence>
      </div>

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
        {selectedAnswer && selectedAnswerData && (
          <motion.div
            className="modal is-active"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="modal-background"
              onClick={closeModal}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              className="modal-content"
              initial={{ scale: 0.8, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 50 }}
              transition={springBouncy}
              style={{ maxWidth: '500px' }}
            >
              <div className="box">
                {/* Question */}
                <div className="notification is-primary is-light mb-4">
                  <p className="is-size-5 has-text-weight-semibold has-text-centered">{question}</p>
                </div>

                {/* Answer box with picker stickers */}
                <div className="mb-5" style={{ position: 'relative', minHeight: '8rem' }}>
                  <div className="box has-background-white-ter has-text-centered py-5" style={{ position: 'relative' }}>
                    <h3 className={`title is-4 mb-0 ${(!selectedAnswerData.text || selectedAnswerData.text.trim() === '') ? 'has-text-grey-light' : ''}`} style={(!selectedAnswerData.text || selectedAnswerData.text.trim() === '') ? { fontStyle: 'italic' } : undefined}>
                      "{(!selectedAnswerData.text || selectedAnswerData.text.trim() === '') ? '(no response)' : selectedAnswerData.text}"
                    </h3>

                    {/* Picker stickers - positioned at bottom right of box */}
                    {selectedAnswerData.pickersRevealed && selectedAnswerData.pickers.length > 0 && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: '-1.5rem',
                          right: '0.5rem',
                          display: 'flex',
                          perspective: 800,
                        }}
                      >
                        {selectedAnswerData.pickers.map((picker, idx) => {
                          const rotation = (idx % 2 === 0 ? -1 : 1) * (5 + idx * 3);
                          const isCorrect = selectedAnswerData.authorRevealed &&
                            selectedAnswerData.correctPickers.some(cp => cp.socketId === picker.socketId);
                          return (
                            <motion.div
                              key={`${picker.socketId}-${isCorrect}`}
                              initial={{ opacity: 0, scale: 0, y: -30, rotate: rotation * 2 }}
                              animate={{
                                opacity: 1,
                                scale: isCorrect ? 1.1 : 1,
                                y: 0,
                                rotate: rotation,
                              }}
                              transition={{
                                ...springBouncy,
                                delay: idx * 0.08,
                              }}
                              style={{
                                marginLeft: idx > 0 ? '-0.75rem' : 0,
                                zIndex: isCorrect ? 10 : selectedAnswerData.pickers.length - idx,
                                borderRadius: '50%',
                                boxShadow: isCorrect ? '0 0 0 3px hsl(141, 53%, 53%), 0 0 12px hsl(141, 53%, 53%)' : undefined,
                              }}
                              title={picker.name + (isCorrect ? ' ✓' : '')}
                              onAnimationComplete={() => {
                                if (isCorrect) {
                                  // Fire confetti from this element's position
                                  const el = document.querySelector(`[data-picker-id="${picker.socketId}"]`);
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
                                }
                              }}
                              data-picker-id={picker.socketId}
                            >
                              <PlayerAvatar avatar={picker.avatar} size="medium" />
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Reveal pickers button or "no pickers" message */}
                  {selectedAnswerData.pickCount === 0 ? (
                    <p className="has-text-grey has-text-centered mt-3">No one picked this answer</p>
                  ) : !selectedAnswerData.pickersRevealed && (
                    <motion.button
                      className="button is-info is-fullwidth is-medium mt-3"
                      onClick={() => onRevealPickers(selectedAnswerData.text)}
                      whileHover={buttonHover}
                      whileTap={buttonTap}
                    >
                      <span className="icon"><i className="fas fa-users" /></span>
                      <span>Reveal Pickers ({selectedAnswerData.pickCount})</span>
                    </motion.button>
                  )}
                </div>

                {/* Author Section */}
                <div className="mb-4" style={{ perspective: 800 }}>
                  {!selectedAnswerData.authorRevealed ? (
                    <motion.button
                      className="button is-warning is-fullwidth is-medium"
                      onClick={() => onRevealAuthor(selectedAnswerData.text)}
                      whileHover={ buttonHover }
                      whileTap={buttonTap}
                    >
                      <span className="icon"><i className="fas fa-user-secret" /></span>
                      <span>Reveal Author</span>
                    </motion.button>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, rotateY: -90 }}
                      animate={{ opacity: 1, rotateY: 0 }}
                      transition={springBouncy}
                      className="has-text-centered"
                    >
                      <div className="title is-4 mt-3 is-flex is-align-items-center is-justify-content-center is-flex-wrap-wrap" style={{ gap: '0.75rem' }}>
                        Written by:
                        {selectedAnswerData.authors.map((author, idx) => (
                          <span key={author.socketId} className="is-flex is-align-items-center" style={{ gap: '0.25rem' }}>
                            <PlayerAvatar avatar={author.avatar} size="large" />
                            {author.name}
                            {idx < selectedAnswerData.authors.length - 1 && <span>&</span>}
                          </span>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Floating +1 point badge(s) - one per correct picker */}
              <AnimatePresence>
                {selectedAnswerData.authorRevealed && selectedAnswerData.correctPickers.map((picker, idx) => {
                  // Find the author that this picker is partnered with
                  const partnerAuthor = selectedAnswerData.authors.find(a => a.partnerId === picker.socketId);
                  return (
                    <motion.div
                      key={picker.socketId}
                      initial={{ opacity: 0, rotateX: -90, y: -20 }}
                      animate={{ opacity: 1, rotateX: 0, y: 0 }}
                      exit={{ opacity: 0, rotateX: 90, y: -20 }}
                      transition={{ ...springBouncy, delay: 0.3 + idx * 0.15 }}
                      className="notification is-success is-flex is-align-items-center is-justify-content-center"
                      style={{
                        gap: '0.5rem',
                        marginTop: idx === 0 ? '1rem' : '0.5rem',
                        transformOrigin: 'top center',
                        perspective: 800,
                      }}
                    >
                      <strong>+1 point</strong> for
                      <TeamName
                        player1={picker}
                        player2={partnerAuthor}
                        size="small"
                      />
                      !
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
            <button
              className="modal-close is-large"
              aria-label="close"
              onClick={closeModal}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
