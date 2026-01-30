import {useMemo} from 'react';
import {useNavigate} from 'react-router-dom';
import {usePlayerInfo} from '../hooks/usePlayerInfo';
import {useGameContext} from '../context/GameContext';
import {useCelebrationConfetti} from '../hooks/useConfetti';
import {ExitButton} from '../components/common/ExitButton';
import {TeamName} from '../components/common/TeamName';
import {PlaceBadge} from '../components/common/PlaceBadge';
import type {Team} from '../types/game';
import {findPlayerBySocketId} from '../utils/playerUtils';
import {calculateAllPlaces, sortTeamsWithTiebreaker} from '../utils/rankingUtils';

function formatTotalTime(ms: number): string {
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
}

export function FinishGamePage() {
  const navigate = useNavigate();
  const { playerInfo, clearPlayerInfo } = usePlayerInfo();
  const { gameState } = useGameContext();

  if (!gameState) {
    return (
      <section className="section">
        <div className="container container-md">
          <h1 className="title has-text-centered">Game Over</h1>
          <p className="has-text-centered">Loading results...</p>
        </div>
      </section>
    );
  }

  // Sort teams by score (descending), using response time as tiebreaker
  const responseTimes = gameState.teamTotalResponseTimes ?? {};
  const sortedTeams = useMemo(
    () => sortTeamsWithTiebreaker(gameState.teams, responseTimes),
    [gameState.teams, responseTimes]
  );
  const places = useMemo(
    () => calculateAllPlaces(gameState.teams, responseTimes),
    [gameState.teams, responseTimes]
  );

  // Check if anyone has scored (hide badges if all teams have 0 points)
  const hasAnyScores = sortedTeams.some(t => t.score > 0);

  // Winner is the team in 1st place (ties broken by response time, so only one)
  const winningTeam = sortedTeams[0];

  const getTeamPlayers = (team: Team) => {
    const player1 = findPlayerBySocketId(gameState.players, team.player1Id);
    const player2 = findPlayerBySocketId(gameState.players, team.player2Id);
    return { player1, player2 };
  };

  // Determine if confetti should be shown (host or player on winning team)
  const shouldShowConfetti = useMemo(() => {
    if (playerInfo?.isHost) return true;
    if (!playerInfo || !winningTeam) return false;
    const playerTeamId = gameState.players.find(p => p.name === playerInfo.name)?.teamId;
    return playerTeamId === winningTeam.teamId;
  }, [playerInfo, gameState.players, winningTeam]);

  // Trigger confetti for host and winning team
  useCelebrationConfetti(!!shouldShowConfetti);

  return (
    <>
      <ExitButton />
      <section className="hero is-fullheight-with-navbar">
      <div className="hero-body">
        <div className="container container-md">
          <h1 className="title is-2 has-text-centered mb-6">Game Over</h1>

          <div className="mb-6">
            <h2 className="subtitle is-4 has-text-centered mb-4">🏆 Winners!</h2>
            <div className="box has-background-primary has-text-white has-text-centered p-6">
              <div className="is-flex is-justify-content-center mb-3">
                {winningTeam ? (
                  <TeamName
                    player1={getTeamPlayers(winningTeam).player1}
                    player2={getTeamPlayers(winningTeam).player2}
                    size="medium"
                  />
                ) : (
                  <span className="title is-3 has-text-white">???</span>
                )}
              </div>
              <p className="title is-1 has-text-white has-text-weight-bold">
                {winningTeam ? winningTeam.score : '???'} points
              </p>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="subtitle is-4 mb-4">Final Standings</h2>
            <div>
              {sortedTeams.map((team) => {
                const { player1, player2 } = getTeamPlayers(team);
                const totalTime = gameState.teamTotalResponseTimes?.[team.teamId] ?? 0;
                const place = places.get(team.teamId) ?? 999;
                const isWinner = place === 1 && hasAnyScores;
                const showBadge = hasAnyScores && place <= 3;
                return (
                  <div
                    key={team.teamId}
                    className={`box mb-3 ${
                      isWinner ? 'has-background-link-light winning-team-border' : ''
                    }`}
                    style={{ overflow: 'visible' }}
                  >
                    <div className="is-flex is-justify-content-space-between is-align-items-center">
                      <div className="is-flex is-align-items-center" style={{ gap: '0.75rem' }}>
                        {showBadge ? (
                          <PlaceBadge place={place} size={isWinner ? 'large' : 'medium'} />
                        ) : (
                          <span className="has-text-weight-bold is-size-5" style={{ color: '#666' }}>
                            #{place}
                          </span>
                        )}
                        <TeamName player1={player1} player2={player2} />
                      </div>
                      <div className="has-text-right">
                        <div className={`title is-4 mb-0 ${showBadge ? 'has-text-link' : 'has-text-grey'}`}>
                          {team.score} {team.score === 1 ? 'pt' : 'pts'}
                        </div>
                        {totalTime > 0 && (
                          <div className="is-size-6 has-text-grey is-italic">
                            {formatTotalTime(totalTime)} thinking time!
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
    </>
  );
}
