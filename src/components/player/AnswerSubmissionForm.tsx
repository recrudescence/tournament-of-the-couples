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
  onSubmit
}: AnswerSubmissionFormProps) {
  return (
    <div className="box">
      <div className="is-flex is-justify-content-space-between is-align-items-center mb-4">
        <h2 className="subtitle is-4 mb-0">Round {roundNumber}</h2>
        <div className="tag is-info is-large">
          {(responseTime / 1000).toFixed(2)}s
        </div>
      </div>

      <div className="notification is-primary is-light mb-4">
        <p className="is-size-5 has-text-weight-semibold">{question}</p>
      </div>

      <form onSubmit={onSubmit}>
        {variant === 'open_ended' ? (
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
                  className={`button is-fullwidth mb-2 ${selectedOption === option ? 'is-primary' : 'is-light'}`}
                  style={{ display: 'block', cursor: 'pointer' }}
                >
                  <input
                    type="radio"
                    id={`option-${index}`}
                    name="answer-option"
                    value={option}
                    checked={selectedOption === option}
                    onChange={(e) => onOptionChange(e.target.value)}
                    required
                    style={{ marginRight: '8px' }}
                  />
                  {option}
                </label>
              ))}
            </div>
          </div>
        )}
        <button type="submit" className="button is-primary is-fullwidth is-large">
          Submit Answer
        </button>
      </form>
    </div>
  );
}
