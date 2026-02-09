import {PlayerAvatar} from '../common/PlayerAvatar';
import {PlayerIdentity, RoundVariant} from '../../types/game';
import {formatResponseTime} from '../../utils/formatUtils';

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
  const isCountdownMode = countdown !== undefined;
  const timerValue = isCountdownMode ? countdown : responseTime;
  const isLowTime = isCountdownMode && countdown < 10000; // < 10 seconds
  const timerColor = isExpired ? 'is-danger' : isLowTime ? 'is-warning' : 'is-info';

  return (
    <div className="box">
      <div className="is-flex is-justify-content-space-between is-align-items-center mb-4">
        <h2 className="subtitle is-4 mb-0">Round {roundNumber}</h2>
        <div className={`tag is-mono ${timerColor} is-large`}>
          {formatResponseTime(timerValue, isCountdownMode ? 1 : 2)}
        </div>
      </div>

      <div className="notification is-primary is-light mb-4">
        <p className="is-size-5 has-text-weight-semibold">{question}</p>
      </div>

      <form onSubmit={onSubmit}>
        {answerForBoth ? (
          // Dual answer mode: answer for both players
          <div className="dual-answer-sections">
            {/* Answer for self */}
            <div className="box has-background-light mb-4">
              <h3 className="subtitle is-5 mb-3 is-flex is-align-items-center" style={{ gap: '0.5rem' }}>
                {player.avatar && <PlayerAvatar avatar={player.avatar} size="small" />}
                You would say:
              </h3>
              {(variant === 'open_ended' || variant === RoundVariant.POOL_SELECTION) ? (
                <div className="field">
                  <div className="control">
                    <textarea
                      className="textarea"
                      rows={2}
                      placeholder={`Your answer goes here!`}
                      value={dualAnswers.self}
                      onChange={(e) => onDualAnswerChange('self', e.target.value)}
                      required
                    />
                  </div>
                </div>
              ) : (
                <div className="field">
                  <div className="control">
                    {options?.map((option, index) => (
                      <label
                        key={index}
                        className={`button is-fullwidth is-justify-content-start mb-2 answer-option-label ${dualAnswers.self === option ? 'is-primary' : 'is-light'}`}
                      >
                        <input
                          type="radio"
                          name="answer-self"
                          value={option}
                          checked={dualAnswers.self === option}
                          onChange={(e) => onDualAnswerChange('self', e.target.value)}
                          required
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Answer for partner */}
            <div className="box has-background-light mb-4">
              <h3 className="subtitle is-5 mb-3 is-flex is-align-items-center" style={{ gap: '0.5rem' }}>
                {partner.avatar && <PlayerAvatar avatar={partner.avatar} size="small" />}
                {partner.name} would say:
              </h3>
              {(variant === 'open_ended' || variant === RoundVariant.POOL_SELECTION) ? (
                <div className="field">
                  <div className="control">
                    <textarea
                      className="textarea"
                      rows={2}
                      placeholder={`Meanwhile, ${partner.name} would say...`}
                      value={dualAnswers.partner}
                      onChange={(e) => onDualAnswerChange('partner', e.target.value)}
                      required
                    />
                  </div>
                </div>
              ) : (
                <div className="field">
                  <div className="control">
                    {options?.map((option, index) => (
                      <label
                        key={index}
                        className={`button is-fullwidth is-justify-content-start mb-2 answer-option-label ${dualAnswers.partner === option ? 'is-primary' : 'is-light'}`}
                      >
                        <input
                          type="radio"
                          name="answer-partner"
                          value={option}
                          checked={dualAnswers.partner === option}
                          onChange={(e) => onDualAnswerChange('partner', e.target.value)}
                          required
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          // Single answer mode
          (variant === 'open_ended' || variant === RoundVariant.POOL_SELECTION) ? (
            <div className="field">
              <label className="label" htmlFor="answerInput">Your Answer:</label>
              <div className="control">
                <textarea
                  id="answerInput"
                  className="textarea"
                  rows={3}
                  placeholder="Type your answer here..."
                  value={answer}
                  onChange={(e) => onAnswerChange(e.target.value)}
                  required
                />
              </div>
            </div>
          ) : (
            <div className="field">
              <div className="control">
                {options?.map((option, index) => (
                  <label
                    key={index}
                    className={`button is-fullwidth is-justify-content-start mb-2 answer-option-label ${selectedOption === option ? 'is-primary' : 'is-light'}`}
                  >
                    <input
                      type="radio"
                      id={`option-${index}`}
                      name="answer-option"
                      value={option}
                      checked={selectedOption === option}
                      onChange={(e) => onOptionChange(e.target.value)}
                      required
                    />
                    {option}
                  </label>
                ))}
              </div>
            </div>
          )
        )}
        <button type="submit" className="button is-primary is-fullwidth is-large">
          Submit Answer
        </button>
      </form>
    </div>
  );
}
