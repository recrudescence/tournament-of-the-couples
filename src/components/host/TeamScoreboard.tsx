import { type Team, type Player } from '../../types/game';
import { findPlayerBySocketId } from '../../utils/playerUtils';

interface TeamScoreboardProps {
  teams: Team[];
  players: Player[];
}

export function TeamScoreboard({ teams, players }: TeamScoreboardProps) {
  const sortedTeams = [...teams].sort((a, b) => b.score - a.score);

  return (
    <div className="box">
      <h3 className="subtitle is-5 mb-3">📊 Scoreboard</h3>
      {sortedTeams.length === 0 ? (
        <p className="has-text-centered has-text-grey">No teams yet</p>
      ) : (
        <div>
          {sortedTeams.map((team) => {
            const player1 = findPlayerBySocketId(players, team.player1Id);
            const player2 = findPlayerBySocketId(players, team.player2Id);

            return (
              <div key={team.teamId} className="box has-background-white-ter mb-2 is-flex is-justify-content-space-between is-align-items-center">
                <span className="has-text-weight-semibold">
                  {player1?.name ?? '?'} & {player2?.name ?? '?'}
                </span>
                <span className="tag is-info is-medium">{team.score} pts</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
