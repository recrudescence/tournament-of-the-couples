import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PlayerCard } from '../common/PlayerCard';
import { TeamCard } from '../common/TeamCard';
import { PlayerHeader } from '../player/PlayerHeader';
import { WaitingStatus } from '../player/WaitingStatus';
import { ScoringStatus } from '../player/ScoringStatus';
import { TeamScoreboard } from '../host/TeamScoreboard';
import { RoundControls } from '../host/RoundControls';
import type { Player, Team } from '../../types/game';

describe('Component Smoke Tests', () => {
  describe('Shared Components', () => {
    describe('PlayerCard', () => {
      const mockPlayer: Player = {
        socketId: 'socket1',
        name: 'Alice',
        connected: true,
        partnerId: null,
        teamId: null
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

        expect(screen.getByText('Click to pair')).toBeInTheDocument();
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
        teamId: 'team1'
      };

      const mockPlayer2: Player = {
        socketId: 'socket2',
        name: 'Bob',
        connected: true,
        partnerId: 'socket1',
        teamId: 'team1'
      };

      it('renders both player names', () => {
        render(
          <TeamCard
            player1={mockPlayer1}
            player2={mockPlayer2}
            currentPlayerName={null}
            isHost={false}
            canUnpair={false}
            onUnpair={vi.fn()}
            onKick={vi.fn()}
          />
        );

        // When not host and not current player, shows player2 first
        expect(screen.getByText('Bob 🤝🏼 Alice')).toBeInTheDocument();
      });

      it('shows unpair button when canUnpair is true', () => {
        render(
          <TeamCard
            player1={mockPlayer1}
            player2={mockPlayer2}
            currentPlayerName="Alice"
            isHost={false}
            canUnpair={true}
            onUnpair={vi.fn()}
            onKick={vi.fn()}
          />
        );

        expect(screen.getByRole('button', { name: 'Unpair' })).toBeInTheDocument();
      });

      it('shows kick buttons for host', () => {
        render(
          <TeamCard
            player1={mockPlayer1}
            player2={mockPlayer2}
            currentPlayerName={null}
            isHost={true}
            canUnpair={false}
            onUnpair={vi.fn()}
            onKick={vi.fn()}
          />
        );

        expect(screen.getByRole('button', { name: 'Kick Alice' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Kick Bob' })).toBeInTheDocument();
      });
    });
  });

  describe('Player Components', () => {
    describe('PlayerHeader', () => {
      it('renders all player info', () => {
        render(
          <PlayerHeader
            hostName="GameHost"
            playerName="Alice"
            partnerName="Bob"
            teamScore={5}
            isCelebrating={false}
          />
        );

        expect(screen.getByText('GameHost')).toBeInTheDocument();
        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(screen.getByText('Bob')).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument();
      });

      it('applies celebration style when isCelebrating is true', () => {
        render(
          <PlayerHeader
            hostName="GameHost"
            playerName="Alice"
            partnerName="Bob"
            teamScore={5}
            isCelebrating={true}
          />
        );

        const scoreElement = screen.getByText('5');
        expect(scoreElement).toHaveClass('has-text-success');
      });
    });

    describe('WaitingStatus', () => {
      it('renders waiting message with host name', () => {
        render(<WaitingStatus hostName="GameHost" />);

        expect(screen.getByText(/Your host is setting up/)).toBeInTheDocument();
        expect(screen.getByText(/Waiting for GameHost/)).toBeInTheDocument();
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
        { socketId: 'socket1', name: 'Alice', connected: true, partnerId: 'socket2', teamId: 'team1' },
        { socketId: 'socket2', name: 'Bob', connected: true, partnerId: 'socket1', teamId: 'team1' }
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
      it('renders end game button', () => {
        render(<RoundControls onEndGame={vi.fn()} />);

        expect(screen.getByRole('button', { name: /End Game/ })).toBeInTheDocument();
      });
    });
  });
});
