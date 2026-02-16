import {useEffect, useState} from 'react';
import {motion} from 'framer-motion';
import type {Player} from '../../types/game';
import {usePrevious} from '../../hooks/usePrevious';
import {PlayerAvatar} from './PlayerAvatar';
import {bubbleFloat, bubbleFloatTransition, fadeIn, nervousHover} from '../../styles/motion';

// =============================================================================
// Types
// =============================================================================

type BubbleSize = 'normal' | 'large';

interface TeamCardProps {
  player1: Player;
  player2: Player;
  currentPlayerName: string | null;
  isHost: boolean;
  isViewerTeam: boolean;
  canUnpair: boolean;
  index: number;
  size?: BubbleSize;
  onUnpair: () => void;
  onKick: (socketId: string, playerName: string) => void;
  onRandomizeAvatar?: () => void;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getBubbleClassName(
  isCurrent: boolean,
  isLarge: boolean,
  side: 'left' | 'right'
): string {
  const classes = ['team-bubble', `team-bubble--${side}`];

  if (isLarge) classes.push('team-bubble--large');
  if (isCurrent) classes.push('team-bubble--current');
  if (isLarge) classes.push('gap-md');
  else classes.push('gap-sm');

  return classes.join(' ');
}

// =============================================================================
// Sub-components
// =============================================================================

function PlayerBubble({
  player,
  side,
  isLarge,
  isCurrent,
  isBumping,
  canRandomize,
  onAvatarClick
}: {
  player: Player;
  side: 'left' | 'right';
  isLarge: boolean;
  isCurrent: boolean;
  isBumping: boolean;
  canRandomize: boolean;
  onAvatarClick: () => void;
}) {
  const avatarElement = (
    <PlayerAvatar
      avatar={player.avatar}
      size={isLarge ? 'large' : 'medium'}
      isBumping={isBumping}
      onClick={canRandomize ? onAvatarClick : undefined}
      title={canRandomize ? 'Tap to randomize' : undefined}
    />
  );

  const textSizeClass = isLarge ? 'is-size-6' : 'is-size-7';
  const nameElement = (
    <span className={`has-text-weight-semibold ${textSizeClass} ${isCurrent ? 'has-text-primary' : ''}`}>
      {player.name}
      {player.isBot && ' \u{1F916}'}
      {isCurrent && <span className="has-text-grey-light"> (you)</span>}
    </span>
  );

  return (
    <div className={getBubbleClassName(isCurrent, isLarge, side)}>
      {side === 'left' ? (
        <>
          {avatarElement}
          {nameElement}
        </>
      ) : (
        <>
          {nameElement}
          {avatarElement}
        </>
      )}
    </div>
  );
}

function ActionButtons({
  canUnpair,
  isHost,
  leftPlayer,
  rightPlayer,
  onUnpair,
  onKick
}: {
  canUnpair: boolean;
  isHost: boolean;
  leftPlayer: Player;
  rightPlayer: Player;
  onUnpair: () => void;
  onKick: (socketId: string, playerName: string) => void;
}) {
  if (!canUnpair && !isHost) return null;

  return (
    <motion.div
      className="mt-2 is-flex is-justify-content-center is-align-items-center gap-sm"
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      transition={{ delay: 0.3 }}
    >
      {canUnpair && (
        <motion.button
          className="button is-small is-danger is-light"
          onClick={onUnpair}
          whileHover={nervousHover}
          whileTap={{ scale: 0.9 }}
        >
          {"Break up </3"}
        </motion.button>
      )}
      {isHost && (
        <>
          <button
            className="button is-small is-danger is-outlined"
            onClick={() => onKick(leftPlayer.socketId, leftPlayer.name)}
          >
            Kick {leftPlayer.name}
          </button>
          <button
            className="button is-small is-danger is-outlined"
            onClick={() => onKick(rightPlayer.socketId, rightPlayer.name)}
          >
            Kick {rightPlayer.name}
          </button>
        </>
      )}
    </motion.div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function TeamCard({
  player1,
  player2,
  currentPlayerName,
  isHost,
  isViewerTeam: _isViewerTeam,
  canUnpair,
  index,
  size = 'normal',
  onUnpair,
  onKick,
  onRandomizeAvatar
}: TeamCardProps) {
  const isLarge = size === 'large';
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

  const isLeftCurrent = leftPlayer.name === currentPlayerName;
  const isRightCurrent = rightPlayer.name === currentPlayerName;

  return (
    <motion.div
      className="mb-4"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.2 }}
    >
      {/* Floating container for the paired bubbles */}
      <motion.div
        className="is-inline-flex is-align-items-center"
        style={{ position: 'relative' }}
        animate={bubbleFloat(index + 10)}
        transition={bubbleFloatTransition(index + 10)}
      >
        <PlayerBubble
          player={leftPlayer}
          side="left"
          isLarge={isLarge}
          isCurrent={isLeftCurrent}
          isBumping={bumpingPlayer === leftPlayer.socketId}
          canRandomize={isLeftCurrent && !!onRandomizeAvatar}
          onAvatarClick={() => handleAvatarClick(leftPlayer.socketId)}
        />
        <PlayerBubble
          player={rightPlayer}
          side="right"
          isLarge={isLarge}
          isCurrent={isRightCurrent}
          isBumping={bumpingPlayer === rightPlayer.socketId}
          canRandomize={isRightCurrent && !!onRandomizeAvatar}
          onAvatarClick={() => handleAvatarClick(rightPlayer.socketId)}
        />
      </motion.div>

      <ActionButtons
        canUnpair={canUnpair}
        isHost={isHost}
        leftPlayer={leftPlayer}
        rightPlayer={rightPlayer}
        onUnpair={onUnpair}
        onKick={onKick}
      />
    </motion.div>
  );
}
