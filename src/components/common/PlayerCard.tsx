import { useState, useEffect } from 'react';
import type { Player } from '../../types/game';
import { usePrevious } from '../../hooks/usePrevious';
import { PlayerAvatar } from './PlayerAvatar';

interface PlayerCardProps {
  player: Player;
  isCurrentPlayer: boolean;
  canPair: boolean;
  isHost: boolean;
  onPair: (socketId: string) => void;
  onKick: (socketId: string, playerName: string) => void;
  onRandomizeAvatar?: () => void;
}

export function PlayerCard({
  player,
  isCurrentPlayer,
  canPair,
  isHost,
  onPair,
  onKick,
  onRandomizeAvatar
}: PlayerCardProps) {
  const [isBumping, setIsBumping] = useState(false);
  const canRandomize = isCurrentPlayer && onRandomizeAvatar;

  // Track previous avatar to detect changes from other players
  const prevAvatar = usePrevious(player.avatar);

  // Trigger bump when avatar changes (from server update)
  useEffect(() => {
    if (
      prevAvatar &&
      (prevAvatar.color !== player.avatar.color || prevAvatar.emoji !== player.avatar.emoji) &&
      !isBumping // Don't double-bump if already animating from local click
    ) {
      setIsBumping(true);
      setTimeout(() => setIsBumping(false), 200);
    }
  }, [player.avatar, prevAvatar, isBumping]);

  const handleAvatarClick = () => {
    if (canRandomize) {
      setIsBumping(true);
      onRandomizeAvatar();
      setTimeout(() => setIsBumping(false), 200);
    }
  };

  return (
    <div
      className={`box ${canPair ? 'is-clickable has-background-white-ter' : ''}`}
      onClick={canPair ? () => onPair(player.socketId) : undefined}
      style={canPair ? { cursor: 'pointer' } : {}}
    >
      <div className="is-flex is-align-items-center" style={{ gap: '0.75rem' }}>
        <PlayerAvatar
          avatar={player.avatar}
          size="large"
          isBumping={isBumping}
          onClick={canRandomize ? handleAvatarClick : undefined}
          title={canRandomize ? 'Tap to randomize' : undefined}
        />
        <div className="is-flex-grow-1">
          <div className={`has-text-weight-semibold ${isCurrentPlayer ? 'has-text-primary' : ''}`}>
            {player.name}
            {isCurrentPlayer && ' (You)'}
          </div>
          {canPair && <div className="has-text-grey is-size-7">Tap to pair</div>}
        </div>
        {isHost && !isCurrentPlayer && (
          <button
            className="button is-small is-danger"
            onClick={(e) => {
              e.stopPropagation();
              onKick(player.socketId, player.name);
            }}
          >
            Kick
          </button>
        )}
      </div>
    </div>
  );
}
