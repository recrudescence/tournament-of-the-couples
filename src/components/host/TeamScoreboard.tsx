import { useMemo } from 'react';
import { type Team, type Player } from '../../types/game';
import { findPlayerBySocketId } from '../../utils/playerUtils';
import { sortTeamsWithTiebreaker, calculateAllPlaces } from '../../utils/rankingUtils';
import { TeamName } from '../common/TeamName';
import { PlaceBadge } from '../common/PlaceBadge';

interface TeamScoreboardProps {
  teams: Team[];
  players: Player[];
  responseTimes?: Record<string, number>;
}

export function TeamScoreboard({ teams, players, responseTimes = {} }: TeamScoreboardProps) {
  const sortedTeams = useMemo(
    () => sortTeamsWithTiebreaker(teams, responseTimes),
    [teams, responseTimes]
  );
  const places = useMemo(
    () => calculateAllPlaces(teams, responseTimes),
    [teams, responseTimes]
  );

  // Hide badges when no one has scored yet
  const hasAnyScores = sortedTeams.some(t => t.score > 0);

  return (
    <div className="box">
      <h3 className="subtitle is-5 mb-3">Scoreboard</h3>
      {sortedTeams.length === 0 ? (
        <p className="has-text-centered has-text-grey">No teams yet</p>
      ) : (
        <div>
          {sortedTeams.map((team) => {
            const player1 = findPlayerBySocketId(players, team.player1Id);
            const player2 = findPlayerBySocketId(players, team.player2Id);
            const place = places.get(team.teamId) ?? 999;
            const showBadge = hasAnyScores && place <= 3;

            return (
              <div
                key={team.teamId}
                className="box has-background-white-ter mb-2 p-3"
                style={{ overflow: 'visible' }}
              >
                <div className="is-flex is-justify-content-space-between is-align-items-center">
                  <div className="is-flex is-align-items-center" style={{ gap: '0.75rem' }}>
                    {showBadge && <PlaceBadge place={place} size="medium" />}
                    {hasAnyScores && !showBadge && (
                      <span className="has-text-weight-bold is-size-5" style={{ color: 'var(--theme-text-muted)' }}>
                        #{place}
                      </span>
                    )}
                    <TeamName player1={player1} player2={player2} />
                  </div>
                  <span className={`tag is-medium ${showBadge ? 'is-light' : 'is-info'}`}>
                    {team.score} pts
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
