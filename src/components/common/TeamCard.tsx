import type { Player } from '../../types/game';

interface TeamCardProps {
  player1: Player;
  player2: Player;
  currentPlayerName: string | null;
  isHost: boolean;
  canUnpair: boolean;
  onUnpair: () => void;
  onKick: (socketId: string, playerName: string) => void;
}

export function TeamCard({
  player1,
  player2,
  currentPlayerName,
  isHost,
  canUnpair,
  onUnpair,
  onKick
}: TeamCardProps) {
  const player1Display =
    player1.name === currentPlayerName
      ? player1.name + ' (you!)'
      : player1.name;
  const player2Display =
    player2.name === currentPlayerName
      ? player2.name + ' (you!)'
      : player2.name;
  const playerDisplay =
    player1.name === currentPlayerName || isHost
      ? player1Display + ' 🤝🏼 ' + player2Display
      : player2Display + ' 🤝🏼 ' + player1Display;

  const unpairBtn = canUnpair && (
    <button className="button is-small is-danger is-light" onClick={onUnpair}>
      Unpair
    </button>
  );

  const kickBtns = isHost && (
    <>
      <button
        className="button is-small is-danger"
        onClick={() => onKick(player1.socketId, player1.name)}
      >
        Kick {player1.name}
      </button>
      <button
        className="button is-small is-danger"
        onClick={() => onKick(player2.socketId, player2.name)}
      >
        Kick {player2.name}
      </button>
    </>
  );

  return (
    <div className="box has-background-link-light">
      <div className="has-text-weight-semibold has-text-primary">
        {playerDisplay}
      </div>
      <div className="is-flex is-flex-wrap-wrap mt-3" style={{ gap: '0.5rem' }}>
        {unpairBtn}
        {kickBtns}
      </div>
    </div>
  );
}
