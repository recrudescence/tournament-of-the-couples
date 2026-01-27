import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BothPlayersScoring } from '../host/BothPlayersScoring';
import { SinglePlayerScoring } from '../host/SinglePlayerScoring';
import { ScoringInterface } from '../host/ScoringInterface';
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
    submittedInCurrentPhase: ['Alice', 'Bob'],
    createdAt: Date.now() - 5000
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
    submittedInCurrentPhase: ['Alice', 'Bob'],
    createdAt: Date.now() - 4500
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

describe('ScoringInterface', () => {
  const mockAvatar1 = { color: '#ff0000', emoji: '😀' };
  const mockAvatar2 = { color: '#0000ff', emoji: '🎉' };

  const mockPlayer1: Player = {
    socketId: 'socket1',
    name: 'Alice',
    connected: true,
    partnerId: 'socket2',
    teamId: 'team1',
    avatar: mockAvatar1
  };

  const mockPlayer2: Player = {
    socketId: 'socket2',
    name: 'Bob',
    connected: true,
    partnerId: 'socket1',
    teamId: 'team1',
    avatar: mockAvatar2
  };

  const mockPlayers = [mockPlayer1, mockPlayer2];

  const mockTeamWithTiming = {
    team: {
      teamId: 'team1',
      player1Id: 'socket1',
      player2Id: 'socket2',
      score: 5
    },
    originalIndex: 0,
    totalResponseTime: 8000,
    player1Time: 3000,
    player2Time: 5000
  };

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
      'Bob': { text: 'Red', responseTime: 5000 }
    },
    submittedInCurrentPhase: ['Alice', 'Bob'],
    createdAt: Date.now() - 5000
  };

  it('renders back to answering button', () => {
    render(
      <ScoringInterface
        teamsSortedByResponseTime={[mockTeamWithTiming]}
        players={mockPlayers}
        currentRound={mockRound}
        currentTeamIndex={0}
        teamPointsAwarded={{}}
        revealedAnswers={new Set()}
        revealedResponseTimes={{}}
        showFinishBtn={false}
        onBackToAnswering={vi.fn()}
        onRevealAnswer={vi.fn()}
        onAwardPoints={vi.fn()}
        onReopenTeamScoring={vi.fn()}
        onFinishRound={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /Back to Answering/i })).toBeInTheDocument();
  });

  it('calls onBackToAnswering when back button is clicked', () => {
    const onBackToAnswering = vi.fn();
    render(
      <ScoringInterface
        teamsSortedByResponseTime={[mockTeamWithTiming]}
        players={mockPlayers}
        currentRound={mockRound}
        currentTeamIndex={0}
        teamPointsAwarded={{}}
        revealedAnswers={new Set()}
        revealedResponseTimes={{}}
        showFinishBtn={false}
        onBackToAnswering={onBackToAnswering}
        onRevealAnswer={vi.fn()}
        onAwardPoints={vi.fn()}
        onReopenTeamScoring={vi.fn()}
        onFinishRound={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Back to Answering/i }));
    expect(onBackToAnswering).toHaveBeenCalledTimes(1);
  });

  it('renders question', () => {
    render(
      <ScoringInterface
        teamsSortedByResponseTime={[mockTeamWithTiming]}
        players={mockPlayers}
        currentRound={mockRound}
        currentTeamIndex={0}
        teamPointsAwarded={{}}
        revealedAnswers={new Set()}
        revealedResponseTimes={{}}
        showFinishBtn={false}
        onBackToAnswering={vi.fn()}
        onRevealAnswer={vi.fn()}
        onAwardPoints={vi.fn()}
        onReopenTeamScoring={vi.fn()}
        onFinishRound={vi.fn()}
      />
    );

    expect(screen.getByText('What is your favorite color?')).toBeInTheDocument();
  });

  it('renders team name with player names', () => {
    render(
      <ScoringInterface
        teamsSortedByResponseTime={[mockTeamWithTiming]}
        players={mockPlayers}
        currentRound={mockRound}
        currentTeamIndex={0}
        teamPointsAwarded={{}}
        revealedAnswers={new Set()}
        revealedResponseTimes={{}}
        showFinishBtn={false}
        onBackToAnswering={vi.fn()}
        onRevealAnswer={vi.fn()}
        onAwardPoints={vi.fn()}
        onReopenTeamScoring={vi.fn()}
        onFinishRound={vi.fn()}
      />
    );

    expect(screen.getByText('Alice & Bob')).toBeInTheDocument();
  });

  it('renders scoring buttons for current team', () => {
    render(
      <ScoringInterface
        teamsSortedByResponseTime={[mockTeamWithTiming]}
        players={mockPlayers}
        currentRound={mockRound}
        currentTeamIndex={0}
        teamPointsAwarded={{}}
        revealedAnswers={new Set()}
        revealedResponseTimes={{}}
        showFinishBtn={false}
        onBackToAnswering={vi.fn()}
        onRevealAnswer={vi.fn()}
        onAwardPoints={vi.fn()}
        onReopenTeamScoring={vi.fn()}
        onFinishRound={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /zero pts/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /one point/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /two/i })).toBeInTheDocument();
  });

  it('calls onAwardPoints with 0 when zero button is clicked', () => {
    const onAwardPoints = vi.fn();
    render(
      <ScoringInterface
        teamsSortedByResponseTime={[mockTeamWithTiming]}
        players={mockPlayers}
        currentRound={mockRound}
        currentTeamIndex={0}
        teamPointsAwarded={{}}
        revealedAnswers={new Set()}
        revealedResponseTimes={{}}
        showFinishBtn={false}
        onBackToAnswering={vi.fn()}
        onRevealAnswer={vi.fn()}
        onAwardPoints={onAwardPoints}
        onReopenTeamScoring={vi.fn()}
        onFinishRound={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /zero pts/i }));
    expect(onAwardPoints).toHaveBeenCalledWith('team1', 0, 0);
  });

  it('calls onAwardPoints with 1 when one point button is clicked', () => {
    const onAwardPoints = vi.fn();
    render(
      <ScoringInterface
        teamsSortedByResponseTime={[mockTeamWithTiming]}
        players={mockPlayers}
        currentRound={mockRound}
        currentTeamIndex={0}
        teamPointsAwarded={{}}
        revealedAnswers={new Set()}
        revealedResponseTimes={{}}
        showFinishBtn={false}
        onBackToAnswering={vi.fn()}
        onRevealAnswer={vi.fn()}
        onAwardPoints={onAwardPoints}
        onReopenTeamScoring={vi.fn()}
        onFinishRound={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /one point/i }));
    expect(onAwardPoints).toHaveBeenCalledWith('team1', 0, 1);
  });

  it('calls onAwardPoints with 2 when two points button is clicked', () => {
    const onAwardPoints = vi.fn();
    render(
      <ScoringInterface
        teamsSortedByResponseTime={[mockTeamWithTiming]}
        players={mockPlayers}
        currentRound={mockRound}
        currentTeamIndex={0}
        teamPointsAwarded={{}}
        revealedAnswers={new Set()}
        revealedResponseTimes={{}}
        showFinishBtn={false}
        onBackToAnswering={vi.fn()}
        onRevealAnswer={vi.fn()}
        onAwardPoints={onAwardPoints}
        onReopenTeamScoring={vi.fn()}
        onFinishRound={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /two/i }));
    expect(onAwardPoints).toHaveBeenCalledWith('team1', 0, 2);
  });

  it('shows points awarded tag after scoring', () => {
    render(
      <ScoringInterface
        teamsSortedByResponseTime={[mockTeamWithTiming]}
        players={mockPlayers}
        currentRound={mockRound}
        currentTeamIndex={1}
        teamPointsAwarded={{ 'team1': 1 }}
        revealedAnswers={new Set()}
        revealedResponseTimes={{}}
        showFinishBtn={false}
        onBackToAnswering={vi.fn()}
        onRevealAnswer={vi.fn()}
        onAwardPoints={vi.fn()}
        onReopenTeamScoring={vi.fn()}
        onFinishRound={vi.fn()}
      />
    );

    expect(screen.getByText(/\+1 point!/)).toBeInTheDocument();
  });

  it('shows 0 points message when team awarded zero', () => {
    render(
      <ScoringInterface
        teamsSortedByResponseTime={[mockTeamWithTiming]}
        players={mockPlayers}
        currentRound={mockRound}
        currentTeamIndex={1}
        teamPointsAwarded={{ 'team1': 0 }}
        revealedAnswers={new Set()}
        revealedResponseTimes={{}}
        showFinishBtn={false}
        onBackToAnswering={vi.fn()}
        onRevealAnswer={vi.fn()}
        onAwardPoints={vi.fn()}
        onReopenTeamScoring={vi.fn()}
        onFinishRound={vi.fn()}
      />
    );

    expect(screen.getByText(/0 points/)).toBeInTheDocument();
  });

  it('shows Finish Round button when showFinishBtn is true', () => {
    render(
      <ScoringInterface
        teamsSortedByResponseTime={[mockTeamWithTiming]}
        players={mockPlayers}
        currentRound={mockRound}
        currentTeamIndex={1}
        teamPointsAwarded={{ 'team1': 1 }}
        revealedAnswers={new Set()}
        revealedResponseTimes={{}}
        showFinishBtn={true}
        onBackToAnswering={vi.fn()}
        onRevealAnswer={vi.fn()}
        onAwardPoints={vi.fn()}
        onReopenTeamScoring={vi.fn()}
        onFinishRound={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Finish Round' })).toBeInTheDocument();
  });

  it('calls onFinishRound when Finish Round is clicked', () => {
    const onFinishRound = vi.fn();
    render(
      <ScoringInterface
        teamsSortedByResponseTime={[mockTeamWithTiming]}
        players={mockPlayers}
        currentRound={mockRound}
        currentTeamIndex={1}
        teamPointsAwarded={{ 'team1': 1 }}
        revealedAnswers={new Set()}
        revealedResponseTimes={{}}
        showFinishBtn={true}
        onBackToAnswering={vi.fn()}
        onRevealAnswer={vi.fn()}
        onAwardPoints={vi.fn()}
        onReopenTeamScoring={vi.fn()}
        onFinishRound={onFinishRound}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Finish Round' }));
    expect(onFinishRound).toHaveBeenCalledTimes(1);
  });

  it('shows total response time after both answers revealed', () => {
    render(
      <ScoringInterface
        teamsSortedByResponseTime={[mockTeamWithTiming]}
        players={mockPlayers}
        currentRound={mockRound}
        currentTeamIndex={0}
        teamPointsAwarded={{}}
        revealedAnswers={new Set(['Alice', 'Bob'])}
        revealedResponseTimes={{ 'Alice': 3000, 'Bob': 5000 }}
        showFinishBtn={false}
        onBackToAnswering={vi.fn()}
        onRevealAnswer={vi.fn()}
        onAwardPoints={vi.fn()}
        onReopenTeamScoring={vi.fn()}
        onFinishRound={vi.fn()}
      />
    );

    expect(screen.getByText(/took 8.0 seconds!/)).toBeInTheDocument();
  });

  it('renders reopen button for scored teams', () => {
    render(
      <ScoringInterface
        teamsSortedByResponseTime={[mockTeamWithTiming]}
        players={mockPlayers}
        currentRound={mockRound}
        currentTeamIndex={1}
        teamPointsAwarded={{ 'team1': 1 }}
        revealedAnswers={new Set()}
        revealedResponseTimes={{}}
        showFinishBtn={false}
        onBackToAnswering={vi.fn()}
        onRevealAnswer={vi.fn()}
        onAwardPoints={vi.fn()}
        onReopenTeamScoring={vi.fn()}
        onFinishRound={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: '↪️' })).toBeInTheDocument();
  });

  it('calls onReopenTeamScoring when reopen button is clicked', () => {
    const onReopenTeamScoring = vi.fn();
    render(
      <ScoringInterface
        teamsSortedByResponseTime={[mockTeamWithTiming]}
        players={mockPlayers}
        currentRound={mockRound}
        currentTeamIndex={1}
        teamPointsAwarded={{ 'team1': 1 }}
        revealedAnswers={new Set()}
        revealedResponseTimes={{}}
        showFinishBtn={false}
        onBackToAnswering={vi.fn()}
        onRevealAnswer={vi.fn()}
        onAwardPoints={vi.fn()}
        onReopenTeamScoring={onReopenTeamScoring}
        onFinishRound={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '↪️' }));
    expect(onReopenTeamScoring).toHaveBeenCalledWith('team1', 0);
  });

  it('uses BothPlayersScoring when answerForBoth is true', () => {
    const dualRound: CurrentRound = {
      ...mockRound,
      answerForBoth: true,
      answers: {
        'Alice': { text: JSON.stringify({ 'Alice': 'Pizza', 'Bob': 'Sushi' }), responseTime: 3000 },
        'Bob': { text: JSON.stringify({ 'Alice': 'Tacos', 'Bob': 'Pasta' }), responseTime: 5000 }
      }
    };

    render(
      <ScoringInterface
        teamsSortedByResponseTime={[mockTeamWithTiming]}
        players={mockPlayers}
        currentRound={dualRound}
        currentTeamIndex={0}
        teamPointsAwarded={{}}
        revealedAnswers={new Set()}
        revealedResponseTimes={{}}
        showFinishBtn={false}
        onBackToAnswering={vi.fn()}
        onRevealAnswer={vi.fn()}
        onAwardPoints={vi.fn()}
        onReopenTeamScoring={vi.fn()}
        onFinishRound={vi.fn()}
      />
    );

    // BothPlayersScoring shows labels like "According to X, Y would say..."
    expect(screen.getByText('According to Bob, Alice would say...')).toBeInTheDocument();
  });

  it('uses SinglePlayerScoring when answerForBoth is false', () => {
    render(
      <ScoringInterface
        teamsSortedByResponseTime={[mockTeamWithTiming]}
        players={mockPlayers}
        currentRound={mockRound}
        currentTeamIndex={0}
        teamPointsAwarded={{}}
        revealedAnswers={new Set()}
        revealedResponseTimes={{}}
        showFinishBtn={false}
        onBackToAnswering={vi.fn()}
        onRevealAnswer={vi.fn()}
        onAwardPoints={vi.fn()}
        onReopenTeamScoring={vi.fn()}
        onFinishRound={vi.fn()}
      />
    );

    // SinglePlayerScoring shows labels like "X said..."
    expect(screen.getByText('Alice said...')).toBeInTheDocument();
    expect(screen.getByText('Bob said...')).toBeInTheDocument();
  });
});
