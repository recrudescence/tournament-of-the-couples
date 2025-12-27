interface RoundControlsProps {
  onEndGame: () => void;
}

export function RoundControls({ onEndGame }: RoundControlsProps) {
  return (
    <div className="box has-background-light">
      <button
        className="button is-info is-fullwidth"
        onClick={onEndGame}
      >
        🏁 End Game
      </button>
    </div>
  );
}
