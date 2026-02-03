import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { PlayerCard } from '../common/PlayerCard';
import { TeamCard } from '../common/TeamCard';
import { PlayerHeader } from '../player/PlayerHeader';
import { WaitingStatus } from '../player/WaitingStatus';
import { ScoringStatus } from '../player/ScoringStatus';
import { SubmittedStatus } from '../player/SubmittedStatus';
import { TeamScoreboard } from '../host/TeamScoreboard';
import { RoundControls } from '../host/RoundControls';
import { AnsweringPhase } from '../host/AnsweringPhase';
import type { Player, Team, CurrentRound } from '../../types/game';
import { RoundStatus, RoundVariant } from '../../types/game';

const mockAvatar = { color: '#ff0000', emoji: '😀' };

describe('Component Smoke Tests', () => {
  describe('Shared Components', () => {
    describe('PlayerCard', () => {
      const mockPlayer: Player = {
        socketId: 'socket1',
        name: 'Alice',
        connected: true,
        partnerId: null,
        teamId: null,
        avatar: mockAvatar
      };

      it('renders player name', () => {
        render(
          <PlayerCard
            player={mockPlayer}
            isCurrentPlayer={false}
            canPair={false}
            isHost={false}
            onPair={vi.fn()}
            onKick={vi.fn()}
          />
        );

        expect(screen.getByText('Alice')).toBeInTheDocument();
      });

      it('shows (You) indicator for current player', () => {
        render(
          <PlayerCard
            player={mockPlayer}
            isCurrentPlayer={true}
            canPair={false}
            isHost={false}
            onPair={vi.fn()}
            onKick={vi.fn()}
          />
        );

        expect(screen.getByText(/Alice.*\(You\)/)).toBeInTheDocument();
      });

      it('shows click to pair hint when canPair is true', () => {
        render(
          <PlayerCard
            player={mockPlayer}
            isCurrentPlayer={false}
            canPair={true}
            isHost={false}
            onPair={vi.fn()}
            onKick={vi.fn()}
          />
        );

        expect(screen.getByText('Tap to pair')).toBeInTheDocument();
      });

      it('shows kick button for host', () => {
        render(
          <PlayerCard
            player={mockPlayer}
            isCurrentPlayer={false}
            canPair={false}
            isHost={true}
            onPair={vi.fn()}
            onKick={vi.fn()}
          />
        );

        expect(screen.getByRole('button', { name: 'Kick' })).toBeInTheDocument();
      });
    });

    describe('TeamCard', () => {
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

      it('renders both player names', () => {
        render(
          <TeamCard
            player1={mockPlayer1}
            player2={mockPlayer2}
            currentPlayerName={null}
            isHost={false}
            isViewerTeam={false}
            canUnpair={false}
            onUnpair={vi.fn()}
            onKick={vi.fn()}
          />
        );

        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(screen.getByText('Bob')).toBeInTheDocument();
      });

      it('shows break up button when canUnpair is true', () => {
        render(
          <TeamCard
            player1={mockPlayer1}
            player2={mockPlayer2}
            currentPlayerName="Alice"
            isHost={false}
            isViewerTeam={false}
            canUnpair={true}
            onUnpair={vi.fn()}
            onKick={vi.fn()}
          />
        );

        expect(screen.getByRole('button', { name: /Break up/i })).toBeInTheDocument();
      });

      it('shows kick buttons for host', () => {
        render(
          <TeamCard
            player1={mockPlayer1}
            player2={mockPlayer2}
            currentPlayerName={null}
            isHost={true}
            isViewerTeam={false}
            canUnpair={false}
            onUnpair={vi.fn()}
            onKick={vi.fn()}
          />
        );

        const kickButtons = screen.getAllByRole('button', { name: /^Kick / });
        expect(kickButtons).toHaveLength(2);
      });
    });
  });

  describe('Player Components', () => {
    describe('PlayerHeader', () => {
      it('renders all player info', () => {
        render(
          <PlayerHeader
            player={{ name: 'Alice', avatar: null }}
            partner={{ name: 'Bob', avatar: null }}
          />
        );

        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(screen.getByText('Bob')).toBeInTheDocument();
      });

      it('renders player and partner with avatars', () => {
        render(
          <PlayerHeader
            player={{ name: 'Alice', avatar: mockAvatar }}
            partner={{ name: 'Bob', avatar: { color: '#0000ff', emoji: '🎉' } }}
          />
        );

        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(screen.getByText('Bob')).toBeInTheDocument();
      });
    });

    describe('WaitingStatus', () => {
      it('renders waiting message with host name', () => {
        const mockHost = {
          socketId: 'host-123',
          name: 'GameHost',
          avatar: { color: '#ff0000', emoji: '🎮' }
        };
        render(<WaitingStatus host={mockHost} />);

        expect(screen.getByText('GameHost')).toBeInTheDocument();
        expect(screen.getByText(/setting up the next round/)).toBeInTheDocument();
      });
    });

    describe('ScoringStatus', () => {
      it('renders scoring message', () => {
        render(<ScoringStatus />);

        expect(screen.getByText('All answers are in!')).toBeInTheDocument();
        expect(screen.getByText(/host is reviewing answers/)).toBeInTheDocument();
      });
    });
  });

  describe('Host Components', () => {
    describe('TeamScoreboard', () => {
      const mockPlayers: Player[] = [
        { socketId: 'socket1', name: 'Alice', connected: true, partnerId: 'socket2', teamId: 'team1', avatar: mockAvatar },
        { socketId: 'socket2', name: 'Bob', connected: true, partnerId: 'socket1', teamId: 'team1', avatar: { color: '#0000ff', emoji: '🎉' } }
      ];

      const mockTeams: Team[] = [
        { teamId: 'team1', player1Id: 'socket1', player2Id: 'socket2', score: 10 }
      ];

      it('renders team names and scores', () => {
        render(<TeamScoreboard teams={mockTeams} players={mockPlayers} />);

        expect(screen.getByText('Alice & Bob')).toBeInTheDocument();
        expect(screen.getByText('10 pts')).toBeInTheDocument();
      });

      it('shows empty state when no teams', () => {
        render(<TeamScoreboard teams={[]} players={[]} />);

        expect(screen.getByText('No teams yet')).toBeInTheDocument();
      });
    });

    describe('RoundControls', () => {
      it('renders end game button when expanded', async () => {
        render(
          <RoundControls
            players={[]}
            phase="roundSetup"
            allAnswersIn={false}
            onKickPlayer={vi.fn()}
            onReopenAnswering={vi.fn()}
            onStartScoring={vi.fn()}
            onResetGame={vi.fn()}
            onEndGame={vi.fn()}
          />
        );

        // Expand the controls
        await userEvent.click(screen.getByRole('button', { name: /Host Controls/ }));

        expect(screen.getByRole('button', { name: /End Game/ })).toBeInTheDocument();
      });
    });

    describe('AnsweringPhase', () => {
      const mockPlayers: Player[] = [
        { socketId: 'socket1', name: 'Alice', connected: true, partnerId: 'socket2', teamId: 'team1', avatar: mockAvatar },
        { socketId: 'socket2', name: 'Bob', connected: true, partnerId: 'socket1', teamId: 'team1', avatar: { color: '#0000ff', emoji: '🎉' } }
      ];

      const mockRound: CurrentRound = {
        roundNumber: 1,
        roundId: 'round1',
        question: 'What is your favorite color?',
        variant: RoundVariant.OPEN_ENDED,
        options: null,
        answerForBoth: false,
        status: RoundStatus.ANSWERING,
        answers: {},
        submittedInCurrentPhase: ['Alice'],
        createdAt: Date.now() - 1000,
      };

      it('renders question', () => {
        render(
          <AnsweringPhase
            question="What is your favorite color?"
            players={mockPlayers}
            currentRound={mockRound}
            submittedCount={1}
            allAnswersIn={false}
            onReopenAnswering={vi.fn()}
            onStartScoring={vi.fn()}
          />
        );

        expect(screen.getByText('What is your favorite color?')).toBeInTheDocument();
      });

      it('shows submitted status for players who answered', () => {
        render(
          <AnsweringPhase
            question="Test question"
            players={mockPlayers}
            currentRound={mockRound}
            submittedCount={1}
            allAnswersIn={false}
            onReopenAnswering={vi.fn()}
            onStartScoring={vi.fn()}
          />
        );

        expect(screen.getByText('✅ Submitted')).toBeInTheDocument();
        expect(screen.getByText('⏳ Waiting...')).toBeInTheDocument();
      });

      it('shows disconnected status for disconnected players', () => {
        const playersWithDisconnected: Player[] = [
          { ...mockPlayers[0]!, connected: false },
          mockPlayers[1]!
        ];

        // Use a round where Alice hasn't submitted yet, so only disconnected status shows
        const roundWithNoSubmissions: CurrentRound = {
          ...mockRound,
          submittedInCurrentPhase: [],
        };

        render(
          <AnsweringPhase
            question="Test question"
            players={playersWithDisconnected}
            currentRound={roundWithNoSubmissions}
            submittedCount={0}
            allAnswersIn={false}
            onReopenAnswering={vi.fn()}
            onStartScoring={vi.fn()}
          />
        );

        expect(screen.getByText('📱 Phone screen off')).toBeInTheDocument();
      });

      it('shows both submitted and disconnected status together', () => {
        const playersWithDisconnected: Player[] = [
          { ...mockPlayers[0]!, connected: false },
          mockPlayers[1]!
        ];

        render(
          <AnsweringPhase
            question="Test question"
            players={playersWithDisconnected}
            currentRound={mockRound}
            submittedCount={1}
            allAnswersIn={false}
            onReopenAnswering={vi.fn()}
            onStartScoring={vi.fn()}
          />
        );

        // Alice submitted then disconnected - should show both states
        expect(screen.getByText('✅ Submitted · 📱 Phone screen off')).toBeInTheDocument();
      });

      it('shows answer count when not all submitted', () => {
        render(
          <AnsweringPhase
            question="Test question"
            players={mockPlayers}
            currentRound={mockRound}
            submittedCount={1}
            allAnswersIn={false}
            onReopenAnswering={vi.fn()}
            onStartScoring={vi.fn()}
          />
        );

        expect(screen.getByText('1 / 2 answers submitted')).toBeInTheDocument();
      });

      it('shows all answers notification and buttons when allAnswersIn is true', () => {
        render(
          <AnsweringPhase
            question="Test question"
            players={mockPlayers}
            currentRound={mockRound}
            submittedCount={2}
            allAnswersIn={true}
            onReopenAnswering={vi.fn()}
            onStartScoring={vi.fn()}
          />
        );

        expect(screen.getByText(/All answers are in! Ready to score/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Begin Scoring' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Re-open Answering' })).toBeInTheDocument();
      });

      it('calls onStartScoring when Begin Scoring is clicked', () => {
        const onStartScoring = vi.fn();
        render(
          <AnsweringPhase
            question="Test question"
            players={mockPlayers}
            currentRound={mockRound}
            submittedCount={2}
            allAnswersIn={true}
            onReopenAnswering={vi.fn()}
            onStartScoring={onStartScoring}
          />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Begin Scoring' }));
        expect(onStartScoring).toHaveBeenCalledTimes(1);
      });

      it('calls onReopenAnswering when Re-open Answering is clicked', () => {
        const onReopenAnswering = vi.fn();
        render(
          <AnsweringPhase
            question="Test question"
            players={mockPlayers}
            currentRound={mockRound}
            submittedCount={2}
            allAnswersIn={true}
            onReopenAnswering={onReopenAnswering}
            onStartScoring={vi.fn()}
          />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Re-open Answering' }));
        expect(onReopenAnswering).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Player Components - SubmittedStatus', () => {
    const mockHost = { name: 'Host', avatar: { color: '#888888', emoji: '👑' } };
    const mockPlayer = { name: 'Alice', avatar: { color: '#ff0000', emoji: '🦊' } };
    const mockPartner = { name: 'Bob', avatar: { color: '#0000ff', emoji: '🎉' } };

    const defaultProps = {
      questionText: 'What is your favorite color?',
      submittedAnswer: 'Blue',
      host: mockHost,
      player: mockPlayer,
      playerResponseTime: 5000,
      partner: mockPartner,
      partnerSubmitted: false,
      partnerAnswer: null,
      partnerResponseTime: null,
      totalAnswersCount: 1,
      totalPlayersCount: 2,
    };

    it('renders submitted answer', () => {
      render(<SubmittedStatus {...defaultProps} />);

      expect(screen.getByText('Answer Submitted!')).toBeInTheDocument();
      expect(screen.getByText('Blue')).toBeInTheDocument();
    });

    it('shows host question in chat bubble', () => {
      render(<SubmittedStatus {...defaultProps} />);

      expect(screen.getByText('What is your favorite color?')).toBeInTheDocument();
      expect(screen.getByText('Host')).toBeInTheDocument();
    });

    it('shows typing indicator when partner has not submitted', () => {
      render(<SubmittedStatus {...defaultProps} />);

      // Typing indicator renders 3 dots
      const typingIndicator = document.querySelector('.typing-indicator');
      expect(typingIndicator).toBeInTheDocument();
    });

    it('shows blurred placeholder when partner has submitted but not yet revealed', () => {
      render(
        <SubmittedStatus
          {...defaultProps}
          partnerSubmitted={true}
          partnerAnswer={null}
          totalAnswersCount={2}
        />
      );

      // Should show blurred placeholder (not real text)
      const blurredText = document.querySelector('.chat-bubble__text--blurred');
      expect(blurredText).toBeInTheDocument();
      expect(blurredText?.textContent).toContain('●');
    });

    it('shows revealed partner answer after host reveals', () => {
      render(
        <SubmittedStatus
          {...defaultProps}
          partnerSubmitted={true}
          partnerAnswer="Red"
          totalAnswersCount={2}
        />
      );

      // Partner answer should be visible (not blurred)
      expect(screen.getByText('Red')).toBeInTheDocument();
      const blurredText = document.querySelector('.chat-bubble__text--blurred');
      expect(blurredText).not.toBeInTheDocument();
    });

    it('shows waiting message when not all players submitted', () => {
      render(
        <SubmittedStatus
          {...defaultProps}
          totalAnswersCount={1}
          totalPlayersCount={4}
        />
      );

      expect(screen.getByText('Waiting for other players to finish...')).toBeInTheDocument();
    });

    it('does not show waiting message when all players submitted', () => {
      render(
        <SubmittedStatus
          {...defaultProps}
          partnerSubmitted={true}
          partnerAnswer={null}
          totalAnswersCount={4}
          totalPlayersCount={4}
        />
      );

      expect(screen.queryByText('Waiting for other players to finish...')).not.toBeInTheDocument();
    });

    it('parses and displays dual answer JSON format', () => {
      const dualAnswer = JSON.stringify({ 'Alice': 'Pizza', 'Bob': 'Sushi' });
      render(
        <SubmittedStatus
          {...defaultProps}
          submittedAnswer={dualAnswer}
          partnerSubmitted={true}
          partnerAnswer={null}
          totalAnswersCount={2}
        />
      );

      // Check for the parsed answer content with "would say" format
      expect(screen.getByText(/I would say/i)).toBeInTheDocument();
      expect(screen.getByText(/Pizza/)).toBeInTheDocument();
    });

    it('handles null partner gracefully', () => {
      render(
        <SubmittedStatus
          {...defaultProps}
          partner={null}
          partnerSubmitted={false}
          partnerAnswer={null}
          totalAnswersCount={1}
          totalPlayersCount={2}
        />
      );

      expect(screen.getByText('Blue')).toBeInTheDocument();
      expect(screen.queryByText(/is thinking.../)).not.toBeInTheDocument();
    });
  });
});
