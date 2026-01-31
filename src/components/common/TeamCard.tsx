import {useEffect, useState} from 'react';
import {motion} from 'framer-motion';
import type {Player} from '../../types/game';
import {usePrevious} from '../../hooks/usePrevious';
import {PlayerAvatar} from './PlayerAvatar';
import {
  bubbleFloat,
  bubbleFloatTransition,
  fadeIn,
  nervousHover,
} from '../../styles/motion';

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

export function TeamCard({
  player1,
  player2,
  currentPlayerName,
  isHost,
  isViewerTeam,
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

  const bubbleStyle = (player: Player, side: 'left' | 'right'): React.CSSProperties => {
    const isCurrent = player.name === currentPlayerName;
    const paddingLeft = isLarge ? '0.75rem 1rem 0.75rem 0.75rem' : '0.5rem 0.75rem 0.5rem 0.5rem';
    const paddingRight = isLarge ? '0.75rem 0.75rem 0.75rem 1rem' : '0.5rem 0.5rem 0.5rem 0.75rem';
    return {
      display: 'inline-flex',
      alignItems: 'center',
      gap: isLarge ? '0.75rem' : '0.5rem',
      padding: side === 'left' ? paddingLeft : paddingRight,
      borderRadius: '2rem',
      backgroundColor: isCurrent ? 'hsl(217, 71%, 95%)' : 'white',
      border: isCurrent ? '2px solid hsl(217, 71%, 53%)' : '2px solid transparent',
      // Overlap: negative margin pulls bubbles together
      marginRight: side === 'left' ? '-0.25rem' : 0,
      marginLeft: side === 'right' ? '-0.25rem' : 0,
      position: 'relative' as const,
      zIndex: side === 'left' ? 1 : 2,
    };
  };

  const renderBubble = (player: Player, side: 'left' | 'right') => {
    const isCurrent = player.name === currentPlayerName;
    const canRandomize = isCurrent && onRandomizeAvatar;
    const isThisPlayerBumping = bumpingPlayer === player.socketId;

    // Arrange content based on side (avatar on outside, name on inside)
    const avatarElement = (
      <PlayerAvatar
        avatar={player.avatar}
        size={isLarge ? 'large' : 'medium'}
        isBumping={isThisPlayerBumping}
        onClick={canRandomize ? () => handleAvatarClick(player.socketId) : undefined}
        title={canRandomize ? 'Tap to randomize' : undefined}
      />
    );

    const textSizeClass = isLarge ? 'is-size-6' : 'is-size-7';
    const nameElement = (
      <span className={`has-text-weight-semibold ${textSizeClass} ${isCurrent ? 'has-text-primary' : ''}`}>
        {player.name}
        {isCurrent && <span className="has-text-grey-light"> (you)</span>}
      </span>
    );

    return (
      <div style={bubbleStyle(player, side)}>
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
  };

  // Merge blob style - creates the "bulge" effect at overlap
  const mergeBlobStyle: React.CSSProperties = {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: '1.5rem',
    height: '2.5rem',
    background: 'linear-gradient(90deg, rgba(255,255,255,0.9) 0%, rgba(255,182,193,0.6) 50%, rgba(255,255,255,0.9) 100%)',
    borderRadius: '50%',
    zIndex: 0,
    filter: 'blur(2px)',
  };

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
        style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
        animate={bubbleFloat(index + 10)} // offset index for different float pattern
        transition={bubbleFloatTransition(index + 10)}
      >
        {renderBubble(leftPlayer, 'left')}
        {/* Merge blob for bulge effect */}
        <div style={mergeBlobStyle} />
        {renderBubble(rightPlayer, 'right')}
      </motion.div>

      {/* Action buttons below the bubbles - centered */}
      {(canUnpair || isHost) && (
        <motion.div
          className="mt-2 is-flex is-justify-content-center is-align-items-center"
          style={{ gap: '0.5rem' }}
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
      )}
    </motion.div>
  );
}
