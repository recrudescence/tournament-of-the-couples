import { useState } from 'react';

interface QuestionFormProps {
  onSubmit: (question: string, variant: 'open_ended' | 'multiple_choice' | 'binary', options?: string[], answerForBoth?: boolean) => void;
  onError: (message: string) => void;
}

export function QuestionForm({ onSubmit, onError }: QuestionFormProps) {
  const [questionInput, setQuestionInput] = useState('');
  const [selectedVariant, setSelectedVariant] = useState<'open_ended' | 'multiple_choice' | 'binary'>('open_ended');
  const [mcOptions, setMcOptions] = useState<string[]>(['', '']);
  const [answerForBoth, setAnswerForBoth] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!questionInput.trim()) {
      onError('Please enter a question');
      return;
    }

    let options: string[] | undefined = undefined;

    if (selectedVariant === 'multiple_choice') {
      const filledOptions = mcOptions.filter(opt => opt.trim() !== '');
      if (filledOptions.length < 2 || filledOptions.length > 4) {
        onError('Please provide 2-4 options');
        return;
      }
      options = filledOptions.map(opt => opt.trim());
    } else if (selectedVariant === 'binary') {
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
      <h2 className="subtitle is-4 mb-4">Start New Round</h2>

      {/* Variant Tabs */}
      <div className="tabs is-centered is-boxed mb-4">
        <ul>
          <li className={selectedVariant === 'open_ended' ? 'is-active' : ''}>
            <a onClick={() => setSelectedVariant('open_ended')}>
              Open Ended
            </a>
          </li>
          <li className={selectedVariant === 'multiple_choice' ? 'is-active' : ''}>
            <a onClick={() => setSelectedVariant('multiple_choice')}>
              Multiple Choice
            </a>
          </li>
          <li className={selectedVariant === 'binary' ? 'is-active' : ''}>
            <a onClick={() => setSelectedVariant('binary')}>
              Binary
            </a>
          </li>
        </ul>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Open Ended Form */}
        {selectedVariant === 'open_ended' && (
          <div className="field">
            <label className="label" htmlFor="questionInput">Enter Question:</label>
            <div className="control">
              <textarea
                id="questionInput"
                className="textarea"
                rows={6}
                placeholder="What's your partner's favorite movie?"
                value={questionInput}
                onChange={(e) => setQuestionInput(e.target.value)}
                required
              />
            </div>
          </div>
        )}

        {/* Multiple Choice Form */}
        {selectedVariant === 'multiple_choice' && (
          <>
            <div className="field">
              <label className="label" htmlFor="mcQuestionInput">Enter Question:</label>
              <div className="control">
                <textarea
                  id="mcQuestionInput"
                  className="textarea"
                  rows={4}
                  placeholder="What's your partner's favorite color?"
                  value={questionInput}
                  onChange={(e) => setQuestionInput(e.target.value)}
                  required
                />
              </div>
            </div>

            <label className="label">Options (2-4 choices):</label>
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

            {mcOptions.length < 4 && (
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
        {selectedVariant === 'binary' && (
          <>
            <div className="field">
              <label className="label" htmlFor="binaryQuestionInput">Enter Question:</label>
              <div className="control">
                <textarea
                  id="binaryQuestionInput"
                  className="textarea"
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

        {/* Answer for Both checkbox */}
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

        <button type="submit" className="button is-primary is-fullwidth is-large">
          Start Round
        </button>
      </form>
    </div>
  );
}
