import {useEffect, useState} from 'react';
import {motion} from 'framer-motion';
import type {Player} from '../../types/game';
import {usePrevious} from '../../hooks/usePrevious';
import {PlayerAvatar} from './PlayerAvatar';
import {
  bubbleFloat,
  bubbleFloatTransition,
  bubbleHover,
  bubbleTap,
} from '../../styles/motion';

type BubbleSize = 'normal' | 'large';

interface PlayerCardProps {
  player: Player;
  isCurrentPlayer: boolean;
  canPair: boolean;
  isHost: boolean;
  index: number;
  size?: BubbleSize;
  onPair: (socketId: string) => void;
  onKick: (socketId: string, playerName: string) => void;
  onRandomizeAvatar?: () => void;
}

export function PlayerCard({
  player,
  isCurrentPlayer,
  canPair,
  isHost,
  index,
  size = 'normal',
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
      !isBumping
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

  // Pill bubble style - scales based on size prop
  const isLarge = size === 'large';
  const bubbleStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: isLarge ? '0.75rem' : '0.5rem',
    padding: isLarge ? '0.75rem 1.25rem 0.75rem 0.75rem' : '0.5rem 1rem 0.5rem 0.5rem',
    borderRadius: '2rem',
    backgroundColor: isCurrentPlayer ? 'hsl(217, 71%, 95%)' : 'white',
    cursor: canPair ? 'pointer' : 'default',
    border: isCurrentPlayer ? '2px solid hsl(217, 71%, 53%)' : '2px solid transparent',
    fontSize: isLarge ? '1.1rem' : undefined,
  };

  return (
    <motion.div
      className="mb-3 mr-1 ml-1"
      style={{ display: 'inline-block' }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        style={bubbleStyle}
        animate={bubbleFloat(index)}
        transition={bubbleFloatTransition(index)}
        whileHover={canPair ? bubbleHover : undefined}
        whileTap={canPair ? bubbleTap : undefined}
        onClick={canPair ? () => onPair(player.socketId) : undefined}
      >
        <PlayerAvatar
          avatar={player.avatar}
          size={isLarge ? 'large' : 'medium'}
          isBumping={isBumping}
          onClick={canRandomize ? handleAvatarClick : undefined}
          title={canRandomize ? 'Tap to randomize' : undefined}
        />
        <div>
          <div className={`has-text-weight-semibold ${isCurrentPlayer ? 'has-text-primary' : ''}`}>
            {player.name}
            {isCurrentPlayer && ' (You)'}
          </div>
          {canPair && <div className="has-text-grey is-size-7">Tap to pair</div>}
        </div>
        {isHost && !isCurrentPlayer && (
          <button
            className="button is-small is-danger ml-2"
            onClick={(e) => {
              e.stopPropagation();
              onKick(player.socketId, player.name);
            }}
          >
            Kick
          </button>
        )}
      </motion.div>
    </motion.div>
  );
}
