import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnswerSubmissionForm } from '../player/AnswerSubmissionForm';
import userEvent from '@testing-library/user-event';

describe('AnswerSubmissionForm', () => {
  const mockOnAnswerChange = vi.fn();
  const mockOnOptionChange = vi.fn();
  const mockOnSubmit = vi.fn((e) => e.preventDefault());
  const mockOnDualAnswerChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Open Ended Variant', () => {
    const defaultProps = {
      roundNumber: 1,
      question: 'What is your favorite movie?',
      responseTime: 5000,
      variant: 'open_ended',
      options: null,
      answer: '',
      selectedOption: '',
      onAnswerChange: mockOnAnswerChange,
      onOptionChange: mockOnOptionChange,
      onSubmit: mockOnSubmit,
      answerForBoth: false,
      player: { name: 'Alice', avatar: null },
      partner: { name: 'Bob', avatar: null },
      dualAnswers: { self: '', partner: '' },
      onDualAnswerChange: mockOnDualAnswerChange,
    };

    it('renders question and round number', () => {
      render(<AnswerSubmissionForm {...defaultProps} />);

      expect(screen.getByText('Round 1')).toBeInTheDocument();
      expect(screen.getByText('What is your favorite movie?')).toBeInTheDocument();
    });

    it('displays response time', () => {
      render(<AnswerSubmissionForm {...defaultProps} responseTime={3450} />);

      expect(screen.getByText('3.45s')).toBeInTheDocument();
    });

    it('renders textarea for open ended questions', () => {
      render(<AnswerSubmissionForm {...defaultProps} />);

      const textarea = screen.getByLabelText(/Your Answer/i);
      expect(textarea).toBeInTheDocument();
      expect(textarea.tagName).toBe('TEXTAREA');
    });

    it('calls onAnswerChange when typing in textarea', async () => {
      const user = userEvent.setup();
      render(<AnswerSubmissionForm {...defaultProps} />);

      const textarea = screen.getByLabelText(/Your Answer/i);
      await user.type(textarea, 'The Matrix');

      expect(mockOnAnswerChange).toHaveBeenCalled();
    });

    it('displays pre-filled answer', () => {
      render(<AnswerSubmissionForm {...defaultProps} answer="The Matrix" />);

      const textarea = screen.getByLabelText(/Your Answer/i) as HTMLTextAreaElement;
      expect(textarea.value).toBe('The Matrix');
    });

    it('calls onSubmit when form is submitted', async () => {
      const user = userEvent.setup();
      render(<AnswerSubmissionForm {...defaultProps} answer="Test answer" />);

      const submitButton = screen.getByRole('button', { name: /Submit Answer/i });
      await user.click(submitButton);

      expect(mockOnSubmit).toHaveBeenCalled();
    });

    it('has required attribute on textarea', () => {
      render(<AnswerSubmissionForm {...defaultProps} />);

      const textarea = screen.getByLabelText(/Your Answer/i);
      expect(textarea).toBeRequired();
    });
  });

  describe('Multiple Choice Variant', () => {
    const defaultProps = {
      roundNumber: 2,
      question: 'What is your favorite color?',
      responseTime: 2500,
      variant: 'multiple_choice',
      options: ['Red', 'Blue', 'Green'],
      answer: '',
      selectedOption: '',
      onAnswerChange: mockOnAnswerChange,
      onOptionChange: mockOnOptionChange,
      onSubmit: mockOnSubmit,
      answerForBoth: false,
      player: { name: 'Alice', avatar: null },
      partner: { name: 'Bob', avatar: null },
      dualAnswers: { self: '', partner: '' },
      onDualAnswerChange: mockOnDualAnswerChange,
    };

    it('renders all options as radio buttons', () => {
      render(<AnswerSubmissionForm {...defaultProps} />);

      expect(screen.getByLabelText('Red')).toBeInTheDocument();
      expect(screen.getByLabelText('Blue')).toBeInTheDocument();
      expect(screen.getByLabelText('Green')).toBeInTheDocument();
    });

    it('calls onOptionChange when selecting an option', async () => {
      const user = userEvent.setup();
      render(<AnswerSubmissionForm {...defaultProps} />);

      const redOption = screen.getByLabelText('Red');
      await user.click(redOption);

      expect(mockOnOptionChange).toHaveBeenCalledWith('Red');
    });

    it('highlights selected option', () => {
      render(<AnswerSubmissionForm {...defaultProps} selectedOption="Blue" />);

      const blueLabel = screen.getByLabelText('Blue').closest('label');
      expect(blueLabel).toHaveClass('is-primary');
    });

    it('does not highlight unselected options', () => {
      render(<AnswerSubmissionForm {...defaultProps} selectedOption="Blue" />);

      const redLabel = screen.getByLabelText('Red').closest('label');
      expect(redLabel).toHaveClass('is-light');
      expect(redLabel).not.toHaveClass('is-primary');
    });

    it('checks the correct radio button', () => {
      render(<AnswerSubmissionForm {...defaultProps} selectedOption="Green" />);

      const greenRadio = screen.getByLabelText('Green') as HTMLInputElement;
      expect(greenRadio.checked).toBe(true);
    });

    it('does not check unselected radio buttons', () => {
      render(<AnswerSubmissionForm {...defaultProps} selectedOption="Green" />);

      const redRadio = screen.getByLabelText('Red') as HTMLInputElement;
      const blueRadio = screen.getByLabelText('Blue') as HTMLInputElement;
      expect(redRadio.checked).toBe(false);
      expect(blueRadio.checked).toBe(false);
    });

    it('has required attribute on radio buttons', () => {
      render(<AnswerSubmissionForm {...defaultProps} />);

      const redRadio = screen.getByLabelText('Red');
      expect(redRadio).toBeRequired();
    });

    it('renders with 4 options', () => {
      const props = {
        ...defaultProps,
        options: ['Red', 'Blue', 'Green', 'Yellow'],
      };

      render(<AnswerSubmissionForm {...props} />);

      expect(screen.getByLabelText('Red')).toBeInTheDocument();
      expect(screen.getByLabelText('Blue')).toBeInTheDocument();
      expect(screen.getByLabelText('Green')).toBeInTheDocument();
      expect(screen.getByLabelText('Yellow')).toBeInTheDocument();
    });
  });

  describe('Binary Variant', () => {
    const defaultProps = {
      roundNumber: 3,
      question: 'Who is more likely to cook dinner?',
      responseTime: 1800,
      variant: 'binary',
      options: ['Alice', 'Bob'],
      answer: '',
      selectedOption: '',
      onAnswerChange: mockOnAnswerChange,
      onOptionChange: mockOnOptionChange,
      onSubmit: mockOnSubmit,
      answerForBoth: false,
      player: { name: 'Alice', avatar: null },
      partner: { name: 'Bob', avatar: null },
      dualAnswers: { self: '', partner: '' },
      onDualAnswerChange: mockOnDualAnswerChange,
    };

    it('renders both player names as options', () => {
      render(<AnswerSubmissionForm {...defaultProps} />);

      expect(screen.getByLabelText('Alice')).toBeInTheDocument();
      expect(screen.getByLabelText('Bob')).toBeInTheDocument();
    });

    it('calls onOptionChange when selecting a player', async () => {
      const user = userEvent.setup();
      render(<AnswerSubmissionForm {...defaultProps} />);

      const aliceOption = screen.getByLabelText('Alice');
      await user.click(aliceOption);

      expect(mockOnOptionChange).toHaveBeenCalledWith('Alice');
    });

    it('highlights selected player', () => {
      render(<AnswerSubmissionForm {...defaultProps} selectedOption="Bob" />);

      const bobLabel = screen.getByLabelText('Bob').closest('label');
      expect(bobLabel).toHaveClass('is-primary');
    });

    it('shows actual player names not placeholders', () => {
      render(<AnswerSubmissionForm {...defaultProps} />);

      expect(screen.queryByText('Player 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Player 2')).not.toBeInTheDocument();
    });
  });

  describe('Response Timer', () => {
    const defaultProps = {
      roundNumber: 1,
      question: 'Test question',
      responseTime: 0,
      variant: 'open_ended',
      options: null,
      answer: '',
      selectedOption: '',
      onAnswerChange: mockOnAnswerChange,
      onOptionChange: mockOnOptionChange,
      onSubmit: mockOnSubmit,
      answerForBoth: false,
      player: { name: 'Alice', avatar: null },
      partner: { name: 'Bob', avatar: null },
      dualAnswers: { self: '', partner: '' },
      onDualAnswerChange: mockOnDualAnswerChange,
    };

    it('displays 0 seconds initially', () => {
      render(<AnswerSubmissionForm {...defaultProps} responseTime={0} />);

      expect(screen.getByText('0.00s')).toBeInTheDocument();
    });

    it('displays elapsed time with 2 decimal places', () => {
      render(<AnswerSubmissionForm {...defaultProps} responseTime={12345} />);

      expect(screen.getByText('12.35s')).toBeInTheDocument();
    });

    it('rounds response time correctly', () => {
      render(<AnswerSubmissionForm {...defaultProps} responseTime={5678} />);

      expect(screen.getByText('5.68s')).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    const defaultProps = {
      roundNumber: 1,
      question: 'Test question',
      responseTime: 1000,
      variant: 'open_ended',
      options: null,
      answer: 'Test answer',
      selectedOption: '',
      onAnswerChange: mockOnAnswerChange,
      onOptionChange: mockOnOptionChange,
      onSubmit: mockOnSubmit,
      answerForBoth: false,
      player: { name: 'Alice', avatar: null },
      partner: { name: 'Bob', avatar: null },
      dualAnswers: { self: '', partner: '' },
      onDualAnswerChange: mockOnDualAnswerChange,
    };

    it('renders submit button', () => {
      render(<AnswerSubmissionForm {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Submit Answer/i })).toBeInTheDocument();
    });

    it('submit button is styled correctly', () => {
      render(<AnswerSubmissionForm {...defaultProps} />);

      const button = screen.getByRole('button', { name: /Submit Answer/i });
      expect(button).toHaveClass('is-primary');
      expect(button).toHaveClass('is-fullwidth');
      expect(button).toHaveClass('is-large');
    });
  });

  describe('Edge Cases', () => {
    const dualAnswerProps = {
      answerForBoth: false,
      player: { name: 'Alice', avatar: null },
      partner: { name: 'Bob', avatar: null },
      dualAnswers: { self: '', partner: '' },
      onDualAnswerChange: mockOnDualAnswerChange,
    };

    it('handles empty options array', () => {
      const props = {
        roundNumber: 1,
        question: 'Test',
        responseTime: 1000,
        variant: 'multiple_choice',
        options: [],
        answer: '',
        selectedOption: '',
        onAnswerChange: mockOnAnswerChange,
        onOptionChange: mockOnOptionChange,
        onSubmit: mockOnSubmit,
        ...dualAnswerProps,
      };

      render(<AnswerSubmissionForm {...props} />);

      // Should render without crashing
      expect(screen.getByText('Test')).toBeInTheDocument();
    });

    it('handles null options for open ended', () => {
      const props = {
        roundNumber: 1,
        question: 'Test',
        responseTime: 1000,
        variant: 'open_ended',
        options: null,
        answer: '',
        selectedOption: '',
        onAnswerChange: mockOnAnswerChange,
        onOptionChange: mockOnOptionChange,
        onSubmit: mockOnSubmit,
        ...dualAnswerProps,
      };

      render(<AnswerSubmissionForm {...props} />);

      expect(screen.getByLabelText(/Your Answer/i)).toBeInTheDocument();
    });

    it('handles very long response times', () => {
      const props = {
        roundNumber: 1,
        question: 'Test',
        responseTime: 123456789,
        variant: 'open_ended',
        options: null,
        answer: '',
        selectedOption: '',
        onAnswerChange: mockOnAnswerChange,
        onOptionChange: mockOnOptionChange,
        onSubmit: mockOnSubmit,
        ...dualAnswerProps,
      };

      render(<AnswerSubmissionForm {...props} />);

      expect(screen.getByText('123456.79s')).toBeInTheDocument();
    });

    it('handles special characters in question', () => {
      const props = {
        roundNumber: 1,
        question: 'What\'s your partner\'s "favorite" movie? 🎬',
        responseTime: 1000,
        variant: 'open_ended',
        options: null,
        answer: '',
        selectedOption: '',
        onAnswerChange: mockOnAnswerChange,
        onOptionChange: mockOnOptionChange,
        onSubmit: mockOnSubmit,
        ...dualAnswerProps,
      };

      render(<AnswerSubmissionForm {...props} />);

      expect(screen.getByText(/What's your partner's "favorite" movie\? 🎬/)).toBeInTheDocument();
    });

    it('handles special characters in options', () => {
      const props = {
        roundNumber: 1,
        question: 'Test',
        responseTime: 1000,
        variant: 'multiple_choice',
        options: ['Option & More', 'Option < 2', 'Option > 3'],
        answer: '',
        selectedOption: '',
        onAnswerChange: mockOnAnswerChange,
        onOptionChange: mockOnOptionChange,
        onSubmit: mockOnSubmit,
        ...dualAnswerProps,
      };

      render(<AnswerSubmissionForm {...props} />);

      expect(screen.getByLabelText('Option & More')).toBeInTheDocument();
      expect(screen.getByLabelText('Option < 2')).toBeInTheDocument();
      expect(screen.getByLabelText('Option > 3')).toBeInTheDocument();
    });
  });
});
