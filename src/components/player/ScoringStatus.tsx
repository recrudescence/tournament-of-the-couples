interface ScoringStatusProps {
  pointsAwarded?: number | null;
}

export function ScoringStatus({ pointsAwarded }: ScoringStatusProps) {
  // Show points feedback if team has been scored
  if (pointsAwarded !== null && pointsAwarded !== undefined) {
    if (pointsAwarded > 0) {
      return (
        <div className="box has-text-centered">
          <h2 className="title is-3 has-text-success mb-3">o nice you got points! 🎉</h2>
          <p className="subtitle is-4">+{pointsAwarded} {pointsAwarded === 1 ? 'point' : 'points'} received that round</p>
        </div>
      );
    } else {
      return (
        <div className="box has-text-centered">
          <h2 className="title is-4 has-text-grey mb-3">No points this round</h2>
          <p className="subtitle is-5 has-text-grey">dang 😔</p>
        </div>
      );
    }
  }

  // Default: waiting for host to score
  return (
    <div
      className="box has-text-centered"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--theme-success) 15%, var(--theme-bg))',
        color: 'var(--theme-text-body)'
      }}
    >
      <h2 className="subtitle is-4 mb-3" style={{ color: 'var(--theme-success)' }}>All answers are in!</h2>
      <p>The host is reviewing answers and awarding points on the big screen. Look that way!</p>
    </div>
  );
}
