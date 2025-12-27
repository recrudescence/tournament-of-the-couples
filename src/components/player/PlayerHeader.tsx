interface PlayerHeaderProps {
  hostName: string;
  playerName: string;
  partnerName: string;
  teamScore: number;
  isCelebrating: boolean;
}

export function PlayerHeader({
  hostName,
  playerName,
  partnerName,
  teamScore,
  isCelebrating
}: PlayerHeaderProps) {
  return (
    <div className="box">
      <div className="columns is-mobile is-multiline has-text-centered">
        <div className="column is-half-mobile is-one-quarter-tablet">
          <p className="heading">Host</p>
          <p className="title is-6">{hostName}</p>
        </div>
        <div className="column is-half-mobile is-one-quarter-tablet">
          <p className="heading">You</p>
          <p className="title is-6 has-text-primary">{playerName}</p>
        </div>
        <div className="column is-half-mobile is-one-quarter-tablet">
          <p className="heading">Partner</p>
          <p className="title is-6">{partnerName}</p>
        </div>
        <div className="column is-half-mobile is-one-quarter-tablet">
          <p className="heading">Team Score</p>
          <p className={`title is-6 ${isCelebrating ? 'has-text-success' : ''}`}>
            {teamScore}
          </p>
        </div>
      </div>
    </div>
  );
}
