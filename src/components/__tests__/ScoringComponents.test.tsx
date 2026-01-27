import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BothPlayersScoring } from '../host/BothPlayersScoring';
import { SinglePlayerScoring } from '../host/SinglePlayerScoring';
import type { Player, CurrentRound } from '../../types/game';
import { RoundVariant, RoundStatus } from '../../types/game';

const mockAvatar = { color: '#ff0000', emoji: '😀' };

const mockPlayer1: Player = {
  socketId: 'socket1',
  name: 'Alice',
  connected: true,
  partnerId: 'socket2',
  teamId: 'team1',
  avatar: mockAvatar
};

const mockPlayer2: Player = {
  socketId: 'socket2',
  name: 'Bob',
  connected: true,
  partnerId: 'socket1',
  teamId: 'team1',
  avatar: { color: '#0000ff', emoji: '🎉' }
};

describe('BothPlayersScoring', () => {
  const mockRoundWithDualAnswers: CurrentRound = {
    roundNumber: 1,
    roundId: 'round1',
    question: 'What is your favorite food?',
    variant: RoundVariant.OPEN_ENDED,
    options: null,
    answerForBoth: true,
    status: RoundStatus.COMPLETE,
    answers: {
      'Alice': { text: JSON.stringify({ 'Alice': 'Pizza', 'Bob': 'Sushi' }), responseTime: 5000 },
      'Bob': { text: JSON.stringify({ 'Alice': 'Tacos', 'Bob': 'Pasta' }), responseTime: 6000 }
    },
    submittedInCurrentPhase: ['Alice', 'Bob']
  };

  it('renders both player sections', () => {
    render(
      <BothPlayersScoring
        player1={mockPlayer1}
        player2={mockPlayer2}
        currentRound={mockRoundWithDualAnswers}
        revealedAnswers={new Set()}
        onRevealAnswer={vi.fn()}
      />
    );

    // Both player names should appear as section headers
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('shows partner guess labels correctly', () => {
    render(
      <BothPlayersScoring
        player1={mockPlayer1}
        player2={mockPlayer2}
        currentRound={mockRoundWithDualAnswers}
        revealedAnswers={new Set()}
        onRevealAnswer={vi.fn()}
      />
    );

    // Alice section should show "According to Bob, Alice would say..."
    expect(screen.getByText('According to Bob, Alice would say...')).toBeInTheDocument();
    // Bob section should show "According to Alice, Bob would say..."
    expect(screen.getByText('According to Alice, Bob would say...')).toBeInTheDocument();
  });

  it('shows self answer labels correctly', () => {
    render(
      <BothPlayersScoring
        player1={mockPlayer1}
        player2={mockPlayer2}
        currentRound={mockRoundWithDualAnswers}
        revealedAnswers={new Set()}
        onRevealAnswer={vi.fn()}
      />
    );

    expect(screen.getByText('Alice actually said...')).toBeInTheDocument();
    expect(screen.getByText('Bob actually said...')).toBeInTheDocument();
  });

  it('shows reveal buttons when answers not revealed', () => {
    render(
      <BothPlayersScoring
        player1={mockPlayer1}
        player2={mockPlayer2}
        currentRound={mockRoundWithDualAnswers}
        revealedAnswers={new Set()}
        onRevealAnswer={vi.fn()}
      />
    );

    // Should have 4 reveal buttons (2 per player section)
    const revealButtons = screen.getAllByRole('button', { name: 'Reveal' });
    expect(revealButtons).toHaveLength(4);
  });

  it('calls onRevealAnswer with correct key for partner answer', () => {
    const onRevealAnswer = vi.fn();
    render(
      <BothPlayersScoring
        player1={mockPlayer1}
        player2={mockPlayer2}
        currentRound={mockRoundWithDualAnswers}
        revealedAnswers={new Set()}
        onRevealAnswer={onRevealAnswer}
      />
    );

    // Click first reveal button (Bob's answer about Alice)
    const revealButtons = screen.getAllByRole('button', { name: 'Reveal' });
    fireEvent.click(revealButtons[0]);

    expect(onRevealAnswer).toHaveBeenCalledWith('Bob:Alice');
  });

  it('calls onRevealAnswer with correct key for self answer', () => {
    const onRevealAnswer = vi.fn();
    render(
      <BothPlayersScoring
        player1={mockPlayer1}
        player2={mockPlayer2}
        currentRound={mockRoundWithDualAnswers}
        revealedAnswers={new Set()}
        onRevealAnswer={onRevealAnswer}
      />
    );

    // Click second reveal button (Alice's self answer)
    const revealButtons = screen.getAllByRole('button', { name: 'Reveal' });
    fireEvent.click(revealButtons[1]);

    expect(onRevealAnswer).toHaveBeenCalledWith('Alice:Alice');
  });

  it('shows revealed answers instead of buttons', () => {
    const revealedAnswers = new Set(['Bob:Alice', 'Alice:Alice']);
    render(
      <BothPlayersScoring
        player1={mockPlayer1}
        player2={mockPlayer2}
        currentRound={mockRoundWithDualAnswers}
        revealedAnswers={revealedAnswers}
        onRevealAnswer={vi.fn()}
      />
    );

    // Bob's guess about Alice
    expect(screen.getByText('Tacos')).toBeInTheDocument();
    // Alice's actual answer for herself
    expect(screen.getByText('Pizza')).toBeInTheDocument();
    // Only 2 reveal buttons remaining (for Bob's section)
    const revealButtons = screen.getAllByRole('button', { name: 'Reveal' });
    expect(revealButtons).toHaveLength(2);
  });

  it('returns null when player1 is undefined', () => {
    const { container } = render(
      <BothPlayersScoring
        player1={undefined}
        player2={mockPlayer2}
        currentRound={mockRoundWithDualAnswers}
        revealedAnswers={new Set()}
        onRevealAnswer={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('returns null when player2 is undefined', () => {
    const { container } = render(
      <BothPlayersScoring
        player1={mockPlayer1}
        player2={undefined}
        currentRound={mockRoundWithDualAnswers}
        revealedAnswers={new Set()}
        onRevealAnswer={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('shows (no answer) for missing answers', () => {
    const roundWithMissingAnswers: CurrentRound = {
      ...mockRoundWithDualAnswers,
      answers: {}
    };

    const revealedAnswers = new Set(['Bob:Alice', 'Alice:Alice', 'Alice:Bob', 'Bob:Bob']);
    render(
      <BothPlayersScoring
        player1={mockPlayer1}
        player2={mockPlayer2}
        currentRound={roundWithMissingAnswers}
        revealedAnswers={revealedAnswers}
        onRevealAnswer={vi.fn()}
      />
    );

    const noAnswers = screen.getAllByText('(no answer)');
    expect(noAnswers).toHaveLength(4);
  });
});

describe('SinglePlayerScoring', () => {
  const mockRound: CurrentRound = {
    roundNumber: 1,
    roundId: 'round1',
    question: 'What is your favorite color?',
    variant: RoundVariant.OPEN_ENDED,
    options: null,
    answerForBoth: false,
    status: RoundStatus.COMPLETE,
    answers: {
      'Alice': { text: 'Blue', responseTime: 3000 },
      'Bob': { text: 'Red', responseTime: 4500 }
    },
    submittedInCurrentPhase: ['Alice', 'Bob']
  };

  const sortedPlayers = [
    { player: mockPlayer1, time: 3000 },
    { player: mockPlayer2, time: 4500 }
  ];

  it('renders player sections', () => {
    render(
      <SinglePlayerScoring
        sortedPlayers={sortedPlayers}
        currentRound={mockRound}
        revealedAnswers={new Set()}
        revealedResponseTimes={{}}
        onRevealAnswer={vi.fn()}
      />
    );

    expect(screen.getByText('Alice said...')).toBeInTheDocument();
    expect(screen.getByText('Bob said...')).toBeInTheDocument();
  });

  it('shows reveal buttons when answers not revealed', () => {
    render(
      <SinglePlayerScoring
        sortedPlayers={sortedPlayers}
        currentRound={mockRound}
        revealedAnswers={new Set()}
        revealedResponseTimes={{}}
        onRevealAnswer={vi.fn()}
      />
    );

    const revealButtons = screen.getAllByRole('button', { name: 'Reveal Answer' });
    expect(revealButtons).toHaveLength(2);
  });

  it('calls onRevealAnswer with player name', () => {
    const onRevealAnswer = vi.fn();
    render(
      <SinglePlayerScoring
        sortedPlayers={sortedPlayers}
        currentRound={mockRound}
        revealedAnswers={new Set()}
        revealedResponseTimes={{}}
        onRevealAnswer={onRevealAnswer}
      />
    );

    const revealButtons = screen.getAllByRole('button', { name: 'Reveal Answer' });
    fireEvent.click(revealButtons[0]);

    expect(onRevealAnswer).toHaveBeenCalledWith('Alice');
  });

  it('shows revealed answers', () => {
    render(
      <SinglePlayerScoring
        sortedPlayers={sortedPlayers}
        currentRound={mockRound}
        revealedAnswers={new Set(['Alice', 'Bob'])}
        revealedResponseTimes={{}}
        onRevealAnswer={vi.fn()}
      />
    );

    expect(screen.getByText('Blue')).toBeInTheDocument();
    expect(screen.getByText('Red')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reveal Answer' })).not.toBeInTheDocument();
  });

  it('shows response times when revealed', () => {
    render(
      <SinglePlayerScoring
        sortedPlayers={sortedPlayers}
        currentRound={mockRound}
        revealedAnswers={new Set(['Alice'])}
        revealedResponseTimes={{ 'Alice': 3000 }}
        onRevealAnswer={vi.fn()}
      />
    );

    expect(screen.getByText('(took 3.00s)')).toBeInTheDocument();
  });

  it('shows "No answer" for players who did not answer', () => {
    const roundWithMissingAnswer: CurrentRound = {
      ...mockRound,
      answers: {
        'Bob': { text: 'Red', responseTime: 4500 }
      }
    };

    render(
      <SinglePlayerScoring
        sortedPlayers={sortedPlayers}
        currentRound={roundWithMissingAnswer}
        revealedAnswers={new Set(['Alice', 'Bob'])}
        revealedResponseTimes={{}}
        onRevealAnswer={vi.fn()}
      />
    );

    expect(screen.getByText('No answer')).toBeInTheDocument();
    expect(screen.getByText('Red')).toBeInTheDocument();
  });

  it('handles undefined players in sortedPlayers', () => {
    const playersWithUndefined = [
      { player: mockPlayer1, time: 3000 },
      { player: undefined, time: 4500 }
    ];

    render(
      <SinglePlayerScoring
        sortedPlayers={playersWithUndefined}
        currentRound={mockRound}
        revealedAnswers={new Set()}
        revealedResponseTimes={{}}
        onRevealAnswer={vi.fn()}
      />
    );

    // Should only render one player section
    expect(screen.getByText('Alice said...')).toBeInTheDocument();
    expect(screen.queryByText('Bob said...')).not.toBeInTheDocument();
  });
});
