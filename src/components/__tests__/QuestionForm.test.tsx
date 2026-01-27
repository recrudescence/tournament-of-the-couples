import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuestionForm } from '../host/QuestionForm';
import userEvent from '@testing-library/user-event';

describe('QuestionForm', () => {
  const mockOnSubmit = vi.fn();
  const mockOnError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Open Ended Variant', () => {
    it('renders open ended form by default', () => {
      render(<QuestionForm onSubmit={mockOnSubmit} onError={mockOnError} />);

      expect(screen.getByLabelText(/Enter Question/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Start Round/i })).toBeInTheDocument();
    });

    it('submits open ended question', async () => {
      const user = userEvent.setup();
      render(<QuestionForm onSubmit={mockOnSubmit} onError={mockOnError} />);

      const textarea = screen.getByLabelText(/Enter Question/i);
      await user.type(textarea, 'What is your favorite color?');

      const submitButton = screen.getByRole('button', { name: /Start Round/i });
      await user.click(submitButton);

      expect(mockOnSubmit).toHaveBeenCalledWith(
        'What is your favorite color?',
        'open_ended',
        undefined,
        false
      );
    });

    it('textarea has required attribute', () => {
      render(<QuestionForm onSubmit={mockOnSubmit} onError={mockOnError} />);

      const textarea = screen.getByLabelText(/Enter Question/i);
      expect(textarea).toBeRequired();
    });

    it('trims whitespace from question', async () => {
      const user = userEvent.setup();
      render(<QuestionForm onSubmit={mockOnSubmit} onError={mockOnError} />);

      const textarea = screen.getByLabelText(/Enter Question/i);
      await user.type(textarea, '   What is your favorite color?   ');

      const submitButton = screen.getByRole('button', { name: /Start Round/i });
      await user.click(submitButton);

      expect(mockOnSubmit).toHaveBeenCalledWith(
        'What is your favorite color?',
        'open_ended',
        undefined,
        false
      );
    });

    it('clears form after successful submission', async () => {
      const user = userEvent.setup();
      render(<QuestionForm onSubmit={mockOnSubmit} onError={mockOnError} />);

      const textarea = screen.getByLabelText(/Enter Question/i) as HTMLTextAreaElement;
      await user.type(textarea, 'Test question');
      await user.click(screen.getByRole('button', { name: /Start Round/i }));

      await waitFor(() => expect(textarea.value).toBe(''));
    });
  });

  describe('Multiple Choice Variant', () => {
    it('switches to multiple choice variant', async () => {
      const user = userEvent.setup();
      render(<QuestionForm onSubmit={mockOnSubmit} onError={mockOnError} />);

      const mcTab = screen.getByText('Multiple Choice');
      await user.click(mcTab);

      expect(screen.getByLabelText(/Enter Question/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Option 1/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Option 2/i)).toBeInTheDocument();
    });

    it('submits multiple choice question with 2 options', async () => {
      const user = userEvent.setup();
      render(<QuestionForm onSubmit={mockOnSubmit} onError={mockOnError} />);

      await user.click(screen.getByText('Multiple Choice'));

      await user.type(screen.getByLabelText(/Enter Question/i), 'Favorite color?');
      await user.type(screen.getByPlaceholderText(/Option 1/i), 'Red');
      await user.type(screen.getByPlaceholderText(/Option 2/i), 'Blue');

      await user.click(screen.getByRole('button', { name: /Start Round/i }));

      expect(mockOnSubmit).toHaveBeenCalledWith(
        'Favorite color?',
        'multiple_choice',
        ['Red', 'Blue'],
        false
      );
    });

    it('submits multiple choice question with 4 options', async () => {
      const user = userEvent.setup();
      render(<QuestionForm onSubmit={mockOnSubmit} onError={mockOnError} />);

      await user.click(screen.getByText('Multiple Choice'));

      await user.type(screen.getByLabelText(/Enter Question/i), 'Favorite color?');
      await user.type(screen.getByPlaceholderText(/Option 1/i), 'Red');
      await user.type(screen.getByPlaceholderText(/Option 2/i), 'Blue');
      await user.click(screen.getByRole('button', { name: /Add Option/i }));
      await user.type(screen.getByPlaceholderText(/Option 3/i), 'Green');
      await user.click(screen.getByRole('button', { name: /Add Option/i }));
      await user.type(screen.getByPlaceholderText(/Option 4/i), 'Yellow');

      await user.click(screen.getByRole('button', { name: /Start Round/i }));

      expect(mockOnSubmit).toHaveBeenCalledWith(
        'Favorite color?',
        'multiple_choice',
        ['Red', 'Blue', 'Green', 'Yellow'],
        false
      );
    });

    it('option inputs have required attribute', async () => {
      const user = userEvent.setup();
      render(<QuestionForm onSubmit={mockOnSubmit} onError={mockOnError} />);

      await user.click(screen.getByText('Multiple Choice'));

      const option1 = screen.getByPlaceholderText(/Option 1/i);
      const option2 = screen.getByPlaceholderText(/Option 2/i);

      expect(option1).toBeRequired();
      expect(option2).toBeRequired();
    });

    it('trims whitespace from options', async () => {
      const user = userEvent.setup();
      render(<QuestionForm onSubmit={mockOnSubmit} onError={mockOnError} />);

      await user.click(screen.getByText('Multiple Choice'));

      await user.type(screen.getByLabelText(/Enter Question/i), 'Favorite color?');
      await user.type(screen.getByPlaceholderText(/Option 1/i), '  Red  ');
      await user.type(screen.getByPlaceholderText(/Option 2/i), '  Blue  ');

      await user.click(screen.getByRole('button', { name: /Start Round/i }));

      expect(mockOnSubmit).toHaveBeenCalledWith(
        'Favorite color?',
        'multiple_choice',
        ['Red', 'Blue'],
        false
      );
    });

    it('can add and remove options', async () => {
      const user = userEvent.setup();
      render(<QuestionForm onSubmit={mockOnSubmit} onError={mockOnError} />);

      await user.click(screen.getByText('Multiple Choice'));

      // Add option
      await user.click(screen.getByRole('button', { name: /Add Option/i }));
      expect(screen.getByPlaceholderText(/Option 3/i)).toBeInTheDocument();

      // Remove option
      const removeButtons = screen.getAllByRole('button', { name: /Remove/i });
      await user.click(removeButtons[2]); // Remove option 3

      expect(screen.queryByPlaceholderText(/Option 3/i)).not.toBeInTheDocument();
    });

    it('can add up to 4 options', async () => {
      const user = userEvent.setup();
      render(<QuestionForm onSubmit={mockOnSubmit} onError={mockOnError} />);

      await user.click(screen.getByText('Multiple Choice'));

      // Initially has 2 options
      expect(screen.getByPlaceholderText(/Option 1/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Option 2/i)).toBeInTheDocument();

      // Add third option
      await user.click(screen.getByRole('button', { name: /Add Option/i }));
      expect(screen.getByPlaceholderText(/Option 3/i)).toBeInTheDocument();

      // Add fourth option
      await user.click(screen.getByRole('button', { name: /Add Option/i }));
      expect(screen.getByPlaceholderText(/Option 4/i)).toBeInTheDocument();

      // Add Option button should not exist when at max
      expect(screen.queryByRole('button', { name: /Add Option/i })).not.toBeInTheDocument();
    });
  });

  describe('Binary Variant', () => {
    it('switches to binary variant', async () => {
      const user = userEvent.setup();
      render(<QuestionForm onSubmit={mockOnSubmit} onError={mockOnError} />);

      const binaryTab = screen.getByText('Binary');
      await user.click(binaryTab);

      expect(screen.getByLabelText(/Enter Question/i)).toBeInTheDocument();
      expect(screen.getByText(/Player names will be filled in dynamically/i)).toBeInTheDocument();
    });

    it('submits binary question with placeholder options', async () => {
      const user = userEvent.setup();
      render(<QuestionForm onSubmit={mockOnSubmit} onError={mockOnError} />);

      await user.click(screen.getByText('Binary'));

      await user.type(screen.getByLabelText(/Enter Question/i), 'Who is more likely to cook?');

      await user.click(screen.getByRole('button', { name: /Start Round/i }));

      expect(mockOnSubmit).toHaveBeenCalledWith(
        'Who is more likely to cook?',
        'binary',
        ['Player 1', 'Player 2'],
        false
      );
    });

    it('clears form after binary submission', async () => {
      const user = userEvent.setup();
      render(<QuestionForm onSubmit={mockOnSubmit} onError={mockOnError} />);

      await user.click(screen.getByText('Binary'));

      const textarea = screen.getByLabelText(/Enter Question/i) as HTMLTextAreaElement;
      await user.type(textarea, 'Test question');
      await user.click(screen.getByRole('button', { name: /Start Round/i }));

      await waitFor(() => expect(textarea.value).toBe(''));
    });
  });

  describe('Variant switching', () => {
    it('preserves question when switching variants', async () => {
      const user = userEvent.setup();
      render(<QuestionForm onSubmit={mockOnSubmit} onError={mockOnError} />);

      await user.type(screen.getByLabelText(/Enter Question/i), 'Test question');

      await user.click(screen.getByText('Multiple Choice'));

      const textarea = screen.getByLabelText(/Enter Question/i) as HTMLTextAreaElement;
      expect(textarea.value).toBe('Test question');
    });

    it('highlights active variant tab', async () => {
      const user = userEvent.setup();
      render(<QuestionForm onSubmit={mockOnSubmit} onError={mockOnError} />);

      const openEndedTab = screen.getByText('Open Ended').closest('li');
      const mcTab = screen.getByText('Multiple Choice').closest('li');
      const binaryTab = screen.getByText('Binary').closest('li');

      expect(openEndedTab).toHaveClass('is-active');
      expect(mcTab).not.toHaveClass('is-active');
      expect(binaryTab).not.toHaveClass('is-active');

      await user.click(screen.getByText('Multiple Choice'));

      expect(openEndedTab).not.toHaveClass('is-active');
      expect(mcTab).toHaveClass('is-active');
      expect(binaryTab).not.toHaveClass('is-active');
    });
  });
});
