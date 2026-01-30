import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { Player } from '../../types/game';
import { usePrevious } from '../../hooks/usePrevious';
import { PlayerAvatar } from './PlayerAvatar';
import {
  cardEntrance,
  scalePop,
  flipInLeft,
  flipInRight,
  emojiSpin,
  fadeIn,
  springDefault,
  springGentle,
  springBouncy,
  cardHover,
  cardTap,
  buttonHover,
  buttonTap,
  nervousHover,
} from '../../styles/motion';

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

  const renderPlayerMiniCard = (player: Player, side: 'left' | 'right') => {
    const isCurrent = player.name === currentPlayerName;
    const canRandomize = isCurrent && onRandomizeAvatar;
    const isThisPlayerBumping = bumpingPlayer === player.socketId;

    return (
      <motion.div
        className="box mb-0 p-3 has-text-centered"
        style={{ flex: '1 1 0', minWidth: 0, transformStyle: 'preserve-3d', perspective: 1000 }}
        variants={side === 'left' ? flipInLeft : flipInRight}
        initial="hidden"
        animate="visible"
        transition={{ ...springGentle, delay: side === 'left' ? 0 : 0.1 }}
        whileHover={cardHover}
        whileTap={cardTap}
      >
        <div className="is-flex is-justify-content-center">
          <PlayerAvatar
            avatar={player.avatar}
            size="medium"
            isBumping={isThisPlayerBumping}
            onClick={canRandomize ? () => handleAvatarClick(player.socketId) : undefined}
            title={canRandomize ? 'Tap to randomize' : undefined}
          />
        </div>
        <div
          className={`has-text-weight-semibold mt-2 ${isCurrent ? 'has-text-primary' : ''}`}
          style={{ wordBreak: 'break-word' }}
        >
          {player.name}
          {isCurrent && <span className="has-text-grey-light"> (you)</span>}
        </div>
        {isHost && (
          <motion.button
            className="button is-small is-danger mt-2"
            onClick={() => onKick(player.socketId, player.name)}
            whileHover={buttonHover}
            whileTap={buttonTap}
          >
            Kick
          </motion.button>
        )}
      </motion.div>
    );
  };

  const cardBackground = isViewerTeam ? 'has-background-link-light' : 'has-background-white-ter';

  return (
    <motion.div
      className={`box ${cardBackground}`}
      style={{ transformStyle: 'preserve-3d', perspective: 1200 }}
      variants={cardEntrance}
      initial="hidden"
      animate="visible"
      transition={springGentle}
    >
      <motion.div
        className="is-flex is-align-items-center"
        style={{ gap: '0.5rem', perspective: 1000 }}
        variants={scalePop}
        initial="hidden"
        animate="visible"
        transition={springDefault}
      >
        {renderPlayerMiniCard(leftPlayer, 'left')}
        <motion.span
          className="is-size-4"
          variants={emojiSpin}
          initial="hidden"
          animate="visible"
          transition={{ ...springBouncy, delay: 0.2 }}
        >
          🤝🏼
        </motion.span>
        {renderPlayerMiniCard(rightPlayer, 'right')}
      </motion.div>
      {canUnpair && (
        <motion.div
          className="mt-3"
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.3 }}
        >
          <motion.button
            className="button is-small is-danger is-light"
            onClick={onUnpair}
            whileHover={nervousHover}
            whileTap={{ scale: 0.9 }}
          >
            {"Break up </3"}
          </motion.button>
        </motion.div>
      )}
    </motion.div>
  );
}
