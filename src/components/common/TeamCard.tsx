import { useState, useEffect } from 'react';
import type { Player } from '../../types/game';
import { usePrevious } from '../../hooks/usePrevious';

interface TeamCardProps {
  player1: Player;
  player2: Player;
  currentPlayerName: string | null;
  isHost: boolean;
  isViewerTeam: boolean;
  canUnpair: boolean;
  onUnpair: () => void;
  onKick: (socketId: string, playerName: string) => void;
  onRandomizeAvatar?: () => void;
}

export function TeamCard({
  player1,
  player2,
  currentPlayerName,
  isHost,
  isViewerTeam,
  canUnpair,
  onUnpair,
  onKick,
  onRandomizeAvatar
}: TeamCardProps) {
  const [bumpingPlayer, setBumpingPlayer] = useState<string | null>(null);
  const isPlayer1Current = player1.name === currentPlayerName;

  // Track previous avatars for both players
  const prevAvatar1 = usePrevious(player1.avatar);
  const prevAvatar2 = usePrevious(player2.avatar);

  // Detect avatar changes and trigger bump
  useEffect(() => {
    if (
      prevAvatar1 &&
      (prevAvatar1.color !== player1.avatar.color || prevAvatar1.emoji !== player1.avatar.emoji) &&
      bumpingPlayer !== player1.socketId
    ) {
      setBumpingPlayer(player1.socketId);
      setTimeout(() => setBumpingPlayer(null), 200);
    }
  }, [player1.avatar, prevAvatar1, player1.socketId, bumpingPlayer]);

  useEffect(() => {
    if (
      prevAvatar2 &&
      (prevAvatar2.color !== player2.avatar.color || prevAvatar2.emoji !== player2.avatar.emoji) &&
      bumpingPlayer !== player2.socketId
    ) {
      setBumpingPlayer(player2.socketId);
      setTimeout(() => setBumpingPlayer(null), 200);
    }
  }, [player2.avatar, prevAvatar2, player2.socketId, bumpingPlayer]);

  // Show current player on the left
  const [leftPlayer, rightPlayer] = (isPlayer1Current || isHost)
    ? [player1, player2]
    : [player2, player1];

  const handleAvatarClick = (playerSocketId: string) => {
    if (onRandomizeAvatar) {
      setBumpingPlayer(playerSocketId);
      onRandomizeAvatar();
      setTimeout(() => setBumpingPlayer(null), 200);
    }
  };

  const renderPlayerMiniCard = (player: Player) => {
    const isCurrent = player.name === currentPlayerName;
    const canRandomize = isCurrent && onRandomizeAvatar;
    const isThisPlayerBumping = bumpingPlayer === player.socketId;

    return (
      <div className="box mb-0 p-3 has-text-centered" style={{ flex: '1 1 0', minWidth: 0 }}>
        <div
          className={`is-flex is-align-items-center is-justify-content-center mx-auto ${isThisPlayerBumping ? 'avatar-bump' : ''}`}
          onClick={canRandomize ? () => handleAvatarClick(player.socketId) : undefined}
          style={{
            width: '2.5rem',
            height: '2.5rem',
            borderRadius: '50%',
            backgroundColor: player.avatar.color,
            fontSize: '1.25rem',
            cursor: canRandomize ? 'pointer' : undefined,
          }}
          title={canRandomize ? 'Tap to randomize' : undefined}
        >
          {player.avatar.emoji}
        </div>
        <div
          className={`has-text-weight-semibold mt-2 ${isCurrent ? 'has-text-primary' : ''}`}
          style={{ wordBreak: 'break-word' }}
        >
          {player.name}
          {isCurrent && <span className="has-text-grey-light"> (you)</span>}
        </div>
        {isHost && (
          <button
            className="button is-small is-danger mt-2"
            onClick={() => onKick(player.socketId, player.name)}
          >
            Kick
          </button>
        )}
      </div>
    );
  };

  const cardBackground = isViewerTeam ? 'has-background-link-light' : 'has-background-white-ter';

  return (
    <div className={`box ${cardBackground}`}>
      <div className="is-flex is-align-items-center" style={{ gap: '0.5rem' }}>
        {renderPlayerMiniCard(leftPlayer)}
        <span className="is-size-4">🤝🏼</span>
        {renderPlayerMiniCard(rightPlayer)}
      </div>
      {canUnpair && (
        <div className="mt-3">
          <button className="button is-small is-danger is-light" onClick={onUnpair}>
            {"Break up </3"}
          </button>
        </div>
      )}
    </div>
  );
}
