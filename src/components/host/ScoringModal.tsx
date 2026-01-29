import {useEffect, useState} from 'react';
import {type CurrentRound, type Player, type Team} from '../../types/game';
import {TeamName} from '../common/TeamName';
import {BothPlayersScoring} from './BothPlayersScoring';
import {SinglePlayerScoring} from './SinglePlayerScoring';

interface PlayerWithTime {
  player: Player | undefined;
  time: number;
}

interface ScoringModalProps {
  team: Team;
  player1: Player | undefined;
  player2: Player | undefined;
  currentRound: CurrentRound;
  totalResponseTime: number;
  sortedPlayers: PlayerWithTime[];
  revealedAnswers: Set<string>;
  revealedResponseTimes: Record<string, number>;
  onRevealAnswer: (playerName: string) => void;
  onAwardPoints: (points: number) => void;
  onClose: () => void;
}

const CLOSE_ANIMATION_MS = 200;

export function ScoringModal({
                               player1,
                               player2,
                               currentRound,
                               totalResponseTime,
                               sortedPlayers,
                               revealedAnswers,
                               revealedResponseTimes,
                               onRevealAnswer,
                               onAwardPoints,
                               onClose
                             }: ScoringModalProps) {
  const [isClosing, setIsClosing] = useState(false);
  // Random spin between -10 and 10 degrees
  const [spinDeg] = useState(() => (Math.random() - 0.5) * 20);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, CLOSE_ANIMATION_MS);
  };

  const handleAwardPoints = (points: number) => {
    setIsClosing(true);
    setTimeout(() => onAwardPoints(points), CLOSE_ANIMATION_MS);
  };

  // Calculate if both answers are revealed for showing total time
  const bothRevealed = player1?.name && player2?.name &&
    revealedAnswers.has(player1.name) && revealedAnswers.has(player2.name);

  return (
    <div className={`modal is-active scoring-modal ${isClosing ? 'modal-closing' : 'modal-opening'}`}>
      <div className="modal-background" onClick={handleClose}></div>
      <div className="modal-card" style={{'--spin-deg': `${spinDeg}deg`} as React.CSSProperties}>
        <header className="modal-card-head">
          <div className="modal-card-title is-flex is-align-items-center" style={{gap: '0.5rem'}}>
            <TeamName player1={player1} player2={player2} size="large"/>
            {bothRevealed && totalResponseTime < Infinity && (
              <span className="has-text-grey is-size-6 ml-2">
                took {(totalResponseTime / 1000).toFixed(1)} seconds!
              </span>
            )}
          </div>
          <button className="delete" aria-label="close" onClick={handleClose}></button>
        </header>
        <section className="modal-card-body">
          {currentRound.answerForBoth ? (
            <BothPlayersScoring
              player1={player1}
              player2={player2}
              currentRound={currentRound}
              revealedAnswers={revealedAnswers}
              onRevealAnswer={onRevealAnswer}
            />
          ) : (
            <SinglePlayerScoring
              sortedPlayers={sortedPlayers}
              currentRound={currentRound}
              revealedAnswers={revealedAnswers}
              revealedResponseTimes={revealedResponseTimes}
              onRevealAnswer={onRevealAnswer}
            />
          )}
        </section>
        <footer className="modal-card-foot is-justify-content-center">
          <button
            className="button is-family-secondary is-large ml-1 mr-1"
            onClick={() => handleAwardPoints(0)}
          >
            zero pts 😔
          </button>
          <button
            className="button is-success is-large ml-1 mr-1"
            onClick={() => handleAwardPoints(1)}
          >
            one point ⭐
          </button>
          <button
            className="button is-warning is-large ml-1 mr-1"
            onClick={() => handleAwardPoints(2)}
          >
            🌟 two! ptz! 🌟
          </button>
        </footer>
      </div>
    </div>
  );
}
