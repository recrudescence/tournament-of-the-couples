import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayerInfo } from '../hooks/usePlayerInfo';
import { useGameContext } from '../context/GameContext';
import { useCelebrationConfetti } from '../hooks/useConfetti';
import { ExitButton } from '../components/common/ExitButton';
import { TeamName } from '../components/common/TeamName';
import type { Team } from '../types/game';
import { findPlayerBySocketId } from '../utils/playerUtils';

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

  // Sort teams by score (descending)
  const sortedTeams = useMemo(
    () => [...gameState.teams].sort((a, b) => b.score - a.score),
    [gameState.teams]
  );

  const winningTeam = sortedTeams[0];

  const getTeamPlayers = (team: Team) => {
    const player1 = findPlayerBySocketId(gameState.players, team.player1Id);
    const player2 = findPlayerBySocketId(gameState.players, team.player2Id);
    return { player1, player2 };
  };

  const handleReturnHome = () => {
    clearPlayerInfo();
    navigate('/');
  };

  // Determine if confetti should be shown
  const shouldShowConfetti = useMemo(
    () =>
      playerInfo?.isHost || // Host always gets confetti
      (playerInfo && gameState.players.find(p => p.name === playerInfo.name)?.teamId === winningTeam?.teamId), // Player is on winning team
    [playerInfo, gameState.players, winningTeam?.teamId]
  );

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
              {sortedTeams.map((team, index) => {
                const { player1, player2 } = getTeamPlayers(team);
                const totalTime = gameState.teamTotalResponseTimes?.[team.teamId] ?? 0;
                return (
                  <div
                    key={team.teamId}
                    className={`box mb-3 is-flex is-justify-content-space-between is-align-items-center ${
                      index === 0 ? 'has-background-link-light winning-team-border' : ''
                    }`}
                  >
                    <div className="is-flex is-align-items-center">
                      <span className="has-text-weight-bold is-size-5 mr-3">
                        #{index + 1}
                      </span>
                      <TeamName player1={player1} player2={player2} />
                    </div>
                    <div className="has-text-right">
                      <div className={`title is-4 mb-0 ${index === 0 ? 'has-text-link' : 'has-text-grey'}`}>
                        {team.score} {team.score === 1 ? 'pt' : 'pts'}
                      </div>
                      {totalTime > 0 && (
                        <div className="is-size-6 has-text-grey is-italic">
                          {formatTotalTime(totalTime)} thinking time!
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="box has-background-light">
            <p className="mb-4 has-text-grey-dark has-text-centered">
              Thanks for playing! Click below to return to the home page.
            </p>
            <button className="button is-primary is-fullwidth is-large" onClick={handleReturnHome}>
              Return to Home
            </button>
          </div>
        </div>
      </div>
    </section>
    </>
  );
}
