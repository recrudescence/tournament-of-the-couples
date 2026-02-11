import {useState} from 'react';
import {RoundVariant} from '../../types/game';

interface QuestionFormProps {
  onSubmit: (question: string, variant: RoundVariant, options?: string[], answerForBoth?: boolean) => void;
  onError: (message: string) => void;
}

export function QuestionForm({ onSubmit, onError }: QuestionFormProps) {
  const [questionInput, setQuestionInput] = useState('');
  const [selectedVariant, setSelectedVariant] = useState<RoundVariant>(RoundVariant.OPEN_ENDED);
  const [mcOptions, setMcOptions] = useState<string[]>(['', '']);
  const [answerForBoth, setAnswerForBoth] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!questionInput.trim()) {
      onError('Please enter a question');
      return;
    }

    let options: string[] | undefined = undefined;

    if (selectedVariant === RoundVariant.MULTIPLE_CHOICE) {
      const filledOptions = mcOptions.filter(opt => opt.trim() !== '');
      if (filledOptions.length < 2 || filledOptions.length > 6) {
        onError('Please provide 2-6 options');
        return;
      }
      options = filledOptions.map(opt => opt.trim());
    } else if (selectedVariant === RoundVariant.BINARY) {
      options = ['Player 1', 'Player 2'];
    }

    onSubmit(questionInput.trim(), selectedVariant, options, answerForBoth);

    // Reset form
    setQuestionInput('');
    setMcOptions(['', '']);
    setAnswerForBoth(false);
  };

  return (
    <div className="box">
      <h2 className="subtitle is-4 mb-4">Ask New Question</h2>

      {/* Variant Tabs */}
      <div className="tabs is-centered is-boxed mb-4">
        <ul>
          <li className={selectedVariant === RoundVariant.OPEN_ENDED ? 'is-active' : ''}>
            <a onClick={() => setSelectedVariant(RoundVariant.OPEN_ENDED)}>
              Open Ended
            </a>
          </li>
          <li className={selectedVariant === RoundVariant.MULTIPLE_CHOICE ? 'is-active' : ''}>
            <a onClick={() => setSelectedVariant(RoundVariant.MULTIPLE_CHOICE)}>
              Multiple Choice
            </a>
          </li>
          <li className={selectedVariant === RoundVariant.BINARY ? 'is-active' : ''}>
            <a onClick={() => setSelectedVariant(RoundVariant.BINARY)}>
              Binary
            </a>
          </li>
          <li className={selectedVariant === RoundVariant.POOL_SELECTION ? 'is-active' : ''}>
            <a onClick={() => setSelectedVariant(RoundVariant.POOL_SELECTION)}>
              Pool Selection
            </a>
          </li>
        </ul>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Open Ended Form */}
        {selectedVariant === RoundVariant.OPEN_ENDED && (
          <div className="field">
            <label className="label" htmlFor="questionInput">Enter Question:</label>
            <div className="control">
              <textarea
                id="questionInput"
                className="textarea is-medium"
                rows={6}
                placeholder="What's your partner's favorite ...?"
                value={questionInput}
                onChange={(e) => setQuestionInput(e.target.value)}
                required
              />
            </div>
          </div>
        )}

        {/* Multiple Choice Form */}
        {selectedVariant === RoundVariant.MULTIPLE_CHOICE && (
          <>
            <div className="field">
              <label className="label" htmlFor="mcQuestionInput">Enter Question:</label>
              <div className="control">
                <textarea
                  id="mcQuestionInput"
                  className="textarea is-medium"
                  rows={4}
                  placeholder="What's your partner's favorite ...?"
                  value={questionInput}
                  onChange={(e) => setQuestionInput(e.target.value)}
                  required
                />
              </div>
            </div>

            <label className="label">Options (2-6 choices):</label>
            <div className="mb-3">
              {mcOptions.map((option, index) => (
                <div key={index} className="field has-addons mb-2">
                  <div className="control is-expanded">
                    <input
                      type="text"
                      className="input"
                      placeholder={`Option ${index + 1}`}
                      value={option}
                      onChange={(e) => {
                        const newOptions = [...mcOptions];
                        newOptions[index] = e.target.value;
                        setMcOptions(newOptions);
                      }}
                      required
                    />
                  </div>
                  {mcOptions.length > 2 && (
                    <div className="control">
                      <button
                        type="button"
                        className="button is-danger"
                        onClick={() => {
                          const newOptions = mcOptions.filter((_, i) => i !== index);
                          setMcOptions(newOptions);
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {mcOptions.length < 6 && (
              <button
                type="button"
                className="button is-light mb-3"
                onClick={() => setMcOptions([...mcOptions, ''])}
              >
                + Add Option
              </button>
            )}
          </>
        )}

        {/* Binary Form */}
        {selectedVariant === RoundVariant.BINARY && (
          <>
            <div className="field">
              <label className="label" htmlFor="binaryQuestionInput">Enter Question:</label>
              <div className="control">
                <textarea
                  id="binaryQuestionInput"
                  className="textarea is-medium"
                  rows={4}
                  placeholder="Who is more likely to...?"
                  value={questionInput}
                  onChange={(e) => setQuestionInput(e.target.value)}
                  required
                />
              </div>
            </div>

            <label className="label">Options (auto-filled with team member names):</label>
            <div className="tags mb-3">
              <span className="tag is-info is-medium">Player 1</span>
              <span className="tag is-info is-medium">Player 2</span>
            </div>
            <p className="help mb-3">
              Note: Player names will be filled in dynamically for each team
            </p>
          </>
        )}

        {/* Pool Selection Form */}
        {selectedVariant === RoundVariant.POOL_SELECTION && (
          <>
            <div className="field">
              <label className="label" htmlFor="poolQuestionInput">Enter Question:</label>
              <div className="control">
                <textarea
                  id="poolQuestionInput"
                  className="textarea is-medium"
                  rows={6}
                  placeholder="What's your partner's dream ...?"
                  value={questionInput}
                  onChange={(e) => setQuestionInput(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="notification is-info is-light">
              <p className="has-text-weight-semibold mb-2">How it works:</p>
              <ol className="ml-4">
                <li>Everyone submits an answer</li>
                <li>All answers are shuffled into a pool</li>
                <li>Players guess which answer their partner wrote</li>
                <li>Correct guesses automatically earn 1 point</li>
              </ol>
            </div>
          </>
        )}

        {/* Answer for Both checkbox */}
        {selectedVariant !== RoundVariant.POOL_SELECTION && (
          <div className="field mb-4">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={answerForBoth}
                onChange={(e) => setAnswerForBoth(e.target.checked)}
                className="mr-2"
              />
              Players answer for both parties
            </label>
            <p className="help">
              Each player will answer the question for themselves AND their partner
            </p>
          </div>
        )}

        <button type="submit" className="button is-primary is-fullwidth is-large">
          Start Round
        </button>
      </form>
    </div>
  );
}
