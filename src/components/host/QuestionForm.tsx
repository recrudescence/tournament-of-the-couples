import {useState} from 'react';
import {RoundVariant} from '../../types/game';

// =============================================================================
// Types
// =============================================================================

interface QuestionFormProps {
  onSubmit: (question: string, variant: RoundVariant, options?: string[], answerForBoth?: boolean) => void;
  onError: (message: string) => void;
}

// =============================================================================
// Sub-components
// =============================================================================

function VariantTabs({
  selectedVariant,
  onSelect
}: {
  selectedVariant: RoundVariant;
  onSelect: (variant: RoundVariant) => void;
}) {
  return (
    <div className="tabs is-centered is-boxed mb-4">
      <ul>
        <li className={selectedVariant === RoundVariant.OPEN_ENDED ? 'is-active' : ''}>
          <a onClick={() => onSelect(RoundVariant.OPEN_ENDED)}>
            Open Ended
          </a>
        </li>
        <li className={selectedVariant === RoundVariant.MULTIPLE_CHOICE ? 'is-active' : ''}>
          <a onClick={() => onSelect(RoundVariant.MULTIPLE_CHOICE)}>
            Multiple Choice
          </a>
        </li>
        <li className={selectedVariant === RoundVariant.BINARY ? 'is-active' : ''}>
          <a onClick={() => onSelect(RoundVariant.BINARY)}>
            Binary
          </a>
        </li>
        <li className={selectedVariant === RoundVariant.POOL_SELECTION ? 'is-active' : ''}>
          <a onClick={() => onSelect(RoundVariant.POOL_SELECTION)}>
            Pool Selection
          </a>
        </li>
      </ul>
    </div>
  );
}

function QuestionTextarea({
  id,
  value,
  onChange,
  placeholder,
  rows = 6
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  rows?: number;
}) {
  return (
    <div className="field">
      <label className="label" htmlFor={id}>Enter Question:</label>
      <div className="control">
        <textarea
          id={id}
          className="textarea is-medium"
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

function OpenEndedForm({
  questionInput,
  setQuestionInput
}: {
  questionInput: string;
  setQuestionInput: (value: string) => void;
}) {
  return (
    <QuestionTextarea
      id="questionInput"
      value={questionInput}
      onChange={setQuestionInput}
      placeholder="What's your partner's favorite ...?"
    />
  );
}

function MultipleChoiceForm({
  questionInput,
  setQuestionInput,
  mcOptions,
  setMcOptions
}: {
  questionInput: string;
  setQuestionInput: (value: string) => void;
  mcOptions: string[];
  setMcOptions: (options: string[]) => void;
}) {
  return (
    <>
      <QuestionTextarea
        id="mcQuestionInput"
        value={questionInput}
        onChange={setQuestionInput}
        placeholder="What's your partner's favorite ...?"
        rows={4}
      />

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
  );
}

function BinaryForm({
  questionInput,
  setQuestionInput
}: {
  questionInput: string;
  setQuestionInput: (value: string) => void;
}) {
  return (
    <>
      <QuestionTextarea
        id="binaryQuestionInput"
        value={questionInput}
        onChange={setQuestionInput}
        placeholder="Who is more likely to...?"
        rows={4}
      />

      <label className="label">Options (auto-filled with team member names):</label>
      <div className="tags mb-3">
        <span className="tag is-info is-medium">Player 1</span>
        <span className="tag is-info is-medium">Player 2</span>
      </div>
      <p className="help mb-3">
        Note: Player names will be filled in dynamically for each team
      </p>
    </>
  );
}

function PoolSelectionForm({
  questionInput,
  setQuestionInput
}: {
  questionInput: string;
  setQuestionInput: (value: string) => void;
}) {
  return (
    <>
      <QuestionTextarea
        id="poolQuestionInput"
        value={questionInput}
        onChange={setQuestionInput}
        placeholder="What's your partner's dream ...?"
      />
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
  );
}

function AnswerForBothCheckbox({
  answerForBoth,
  setAnswerForBoth
}: {
  answerForBoth: boolean;
  setAnswerForBoth: (value: boolean) => void;
}) {
  return (
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
  );
}

// =============================================================================
// Main Component
// =============================================================================

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

      <VariantTabs
        selectedVariant={selectedVariant}
        onSelect={setSelectedVariant}
      />

      <form onSubmit={handleSubmit}>
        {selectedVariant === RoundVariant.OPEN_ENDED && (
          <OpenEndedForm
            questionInput={questionInput}
            setQuestionInput={setQuestionInput}
          />
        )}

        {selectedVariant === RoundVariant.MULTIPLE_CHOICE && (
          <MultipleChoiceForm
            questionInput={questionInput}
            setQuestionInput={setQuestionInput}
            mcOptions={mcOptions}
            setMcOptions={setMcOptions}
          />
        )}

        {selectedVariant === RoundVariant.BINARY && (
          <BinaryForm
            questionInput={questionInput}
            setQuestionInput={setQuestionInput}
          />
        )}

        {selectedVariant === RoundVariant.POOL_SELECTION && (
          <PoolSelectionForm
            questionInput={questionInput}
            setQuestionInput={setQuestionInput}
          />
        )}

        {/* Answer for Both checkbox */}
        {selectedVariant !== RoundVariant.POOL_SELECTION && (
          <AnswerForBothCheckbox
            answerForBoth={answerForBoth}
            setAnswerForBoth={setAnswerForBoth}
          />
        )}

        <button type="submit" className="button is-primary is-fullwidth is-large">
          Start Round
        </button>
      </form>
    </div>
  );
}
