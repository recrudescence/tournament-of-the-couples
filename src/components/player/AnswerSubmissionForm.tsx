import {useEffect, useRef, useState} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {PlayerAvatar} from '../common/PlayerAvatar';
import {PlayerIdentity, RoundVariant} from '../../types/game';
import {formatResponseTime} from '../../utils/formatUtils';
import {springDefault} from '../../styles/motion';

// =============================================================================
// Types
// =============================================================================

interface AnswerSubmissionFormProps {
  roundNumber: number;
  question: string;
  responseTime: number;
  variant: string;
  options: string[] | null;
  answer: string;
  selectedOption: string;
  onAnswerChange: (answer: string) => void;
  onOptionChange: (option: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  // Dual answer mode props
  answerForBoth: boolean;
  player: PlayerIdentity;
  partner: PlayerIdentity;
  dualAnswers: { self: string; partner: string };
  onDualAnswerChange: (key: 'self' | 'partner', value: string) => void;
  // Countdown mode (pool selection)
  countdown?: number; // Remaining time in ms (undefined = use responseTime count-up)
  isExpired?: boolean;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getTimerStyles(countdown: number | undefined, isExpired: boolean | undefined) {
  const isCountdownMode = countdown !== undefined;
  const isUrgent = isCountdownMode && countdown <= 10000; // <= 10 seconds
  const isWarning = isCountdownMode && countdown <= 20000 && countdown > 10000; // 10-20 seconds
  const timerColor = isExpired ? 'is-danger' : isUrgent ? 'is-danger' : isWarning ? 'is-warning' : 'is-info';
  const timerClass = isUrgent && !isExpired ? 'countdown-urgent' : isWarning ? 'countdown-warning' : '';

  return { timerColor, timerClass, isCountdownMode };
}

function isOpenEndedVariant(variant: string): boolean {
  return variant === 'open_ended' || variant === RoundVariant.POOL_SELECTION;
}

// =============================================================================
// Sub-components
// =============================================================================

function TimerDisplay({
  roundNumber,
  timerValue,
  timerColor,
  timerClass,
  isCountdownMode,
  timerRef
}: {
  roundNumber: number;
  timerValue: number;
  timerColor: string;
  timerClass: string;
  isCountdownMode: boolean;
  timerRef?: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div ref={timerRef} className="is-flex is-justify-content-space-between is-align-items-center mb-4">
      <h2 className="subtitle is-4 mb-0">Round {roundNumber}</h2>
      <div className={`tag is-mono ${timerColor} is-large ${timerClass}`}>
        {formatResponseTime(timerValue, isCountdownMode ? 0 : 2)}
      </div>
    </div>
  );
}

function FloatingTimer({
  timerValue,
  timerColor,
  timerClass,
  isCountdownMode
}: {
  timerValue: number;
  timerColor: string;
  timerClass: string;
  isCountdownMode: boolean;
}) {
  return (
    <motion.div
      className="floating-timer"
      initial={{ opacity: 0, y: -20, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.8 }}
      transition={springDefault}
    >
      <div className={`tag is-mono ${timerColor} is-medium ${timerClass}`}>
        {formatResponseTime(timerValue, isCountdownMode ? 0 : 2)}
      </div>
    </motion.div>
  );
}

function QuestionHeader({ question }: { question: string }) {
  return (
    <div className="notification is-primary is-light mb-4">
      <p className="is-size-5 has-text-weight-semibold">{question}</p>
    </div>
  );
}

function OpenEndedInput({
  id,
  value,
  onChange,
  placeholder,
  label,
  rows = 3
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label?: string;
  rows?: number;
}) {
  return (
    <div className="field">
      {label && <label className="label" htmlFor={id}>{label}</label>}
      <div className="control">
        <textarea
          id={id}
          className="textarea"
          rows={rows}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
        />
      </div>
    </div>
  );
}

function OptionRadioList({
  name,
  options,
  selectedValue,
  onChange
}: {
  name: string;
  options: string[];
  selectedValue: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="field">
      <div className="control">
        {options.map((option, index) => (
          <label
            key={index}
            className={`button is-fullwidth is-justify-content-start mb-2 answer-option-label ${selectedValue === option ? 'is-primary' : 'is-light'}`}
          >
            <input
              type="radio"
              id={`${name}-${index}`}
              name={name}
              value={option}
              checked={selectedValue === option}
              onChange={(e) => onChange(e.target.value)}
              required
            />
            {option}
          </label>
        ))}
      </div>
    </div>
  );
}

function DualAnswerSection({
  variant,
  options,
  player,
  partner,
  dualAnswers,
  onDualAnswerChange
}: {
  variant: string;
  options: string[] | null;
  player: PlayerIdentity;
  partner: PlayerIdentity;
  dualAnswers: { self: string; partner: string };
  onDualAnswerChange: (key: 'self' | 'partner', value: string) => void;
}) {
  const isOpenEnded = isOpenEndedVariant(variant);

  return (
    <div className="dual-answer-sections">
      {/* Answer for self */}
      <div className="box has-background-light mb-4">
        <h3 className="subtitle is-5 mb-3 is-flex is-align-items-center gap-sm">
          {player.avatar && <PlayerAvatar avatar={player.avatar} size="small" />}
          You would say:
        </h3>
        {isOpenEnded ? (
          <OpenEndedInput
            value={dualAnswers.self}
            onChange={(value) => onDualAnswerChange('self', value)}
            placeholder="Your answer goes here!"
            rows={2}
          />
        ) : options && (
          <OptionRadioList
            name="answer-self"
            options={options}
            selectedValue={dualAnswers.self}
            onChange={(value) => onDualAnswerChange('self', value)}
          />
        )}
      </div>

      {/* Answer for partner */}
      <div className="box has-background-light mb-4">
        <h3 className="subtitle is-5 mb-3 is-flex is-align-items-center gap-sm">
          {partner.avatar && <PlayerAvatar avatar={partner.avatar} size="small" />}
          {partner.name} would say:
        </h3>
        {isOpenEnded ? (
          <OpenEndedInput
            value={dualAnswers.partner}
            onChange={(value) => onDualAnswerChange('partner', value)}
            placeholder={`Meanwhile, ${partner.name} would say...`}
            rows={2}
          />
        ) : options && (
          <OptionRadioList
            name="answer-partner"
            options={options}
            selectedValue={dualAnswers.partner}
            onChange={(value) => onDualAnswerChange('partner', value)}
          />
        )}
      </div>
    </div>
  );
}

function SingleAnswerSection({
  variant,
  options,
  answer,
  selectedOption,
  onAnswerChange,
  onOptionChange
}: {
  variant: string;
  options: string[] | null;
  answer: string;
  selectedOption: string;
  onAnswerChange: (value: string) => void;
  onOptionChange: (value: string) => void;
}) {
  const isOpenEnded = isOpenEndedVariant(variant);

  if (isOpenEnded) {
    return (
      <OpenEndedInput
        id="answerInput"
        value={answer}
        onChange={onAnswerChange}
        placeholder="Type your answer here..."
        label="Your Answer:"
      />
    );
  }

  return options ? (
    <OptionRadioList
      name="answer-option"
      options={options}
      selectedValue={selectedOption}
      onChange={onOptionChange}
    />
  ) : null;
}

// =============================================================================
// Main Component
// =============================================================================

export function AnswerSubmissionForm({
  roundNumber,
  question,
  responseTime,
  variant,
  options,
  answer,
  selectedOption,
  onAnswerChange,
  onOptionChange,
  onSubmit,
  answerForBoth,
  player,
  partner,
  dualAnswers,
  onDualAnswerChange,
  countdown,
  isExpired
}: AnswerSubmissionFormProps) {
  const { timerColor, timerClass, isCountdownMode } = getTimerStyles(countdown, isExpired);
  const timerValue = isCountdownMode ? countdown! : responseTime;

  const timerRef = useRef<HTMLDivElement>(null);
  const [timerVisible, setTimerVisible] = useState(true);

  useEffect(() => {
    const el = timerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => setTimerVisible(entries[0]?.isIntersecting ?? true),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="box">
      <AnimatePresence>
        {!timerVisible && (
          <FloatingTimer
            timerValue={timerValue}
            timerColor={timerColor}
            timerClass={timerClass}
            isCountdownMode={isCountdownMode}
          />
        )}
      </AnimatePresence>

      <TimerDisplay
        roundNumber={roundNumber}
        timerValue={timerValue}
        timerColor={timerColor}
        timerClass={timerClass}
        isCountdownMode={isCountdownMode}
        timerRef={timerRef}
      />

      <QuestionHeader question={question} />

      <form onSubmit={onSubmit}>
        {answerForBoth ? (
          <DualAnswerSection
            variant={variant}
            options={options}
            player={player}
            partner={partner}
            dualAnswers={dualAnswers}
            onDualAnswerChange={onDualAnswerChange}
          />
        ) : (
          <SingleAnswerSection
            variant={variant}
            options={options}
            answer={answer}
            selectedOption={selectedOption}
            onAnswerChange={onAnswerChange}
            onOptionChange={onOptionChange}
          />
        )}

        <button type="submit" className="button is-primary is-fullwidth is-large">
          Submit Answer
        </button>
      </form>
    </div>
  );
}
