import { useNavigate } from 'react-router-dom';
import { usePlayerInfo } from '../hooks/usePlayerInfo';
import { useGameContext } from '../context/GameContext';
import { ExitButton } from '../components/common/ExitButton';
import type { Team } from '../types/game';

export function FinishGamePage() {
  const navigate = useNavigate();
  const { clearPlayerInfo } = usePlayerInfo();
  const { gameState } = useGameContext();

  if (!gameState) {
    return (
      <section className="section">
        <div className="container" style={{ maxWidth: '800px' }}>
          <h1 className="title has-text-centered">Game Over</h1>
          <p className="has-text-centered">Loading results...</p>
        </div>
      </section>
    );
  }

  // Sort teams by score (descending)
  const sortedTeams = [...gameState.teams].sort((a, b) => b.score - a.score);
  const winningTeam = sortedTeams[0];

  const getPlayerName = (socketId: string) => {
    const player = gameState.players.find((p) => p.socketId === socketId);
    return player?.name || 'Unknown';
  };

  const getTeamNames = (team: Team) => {
    const player1 = getPlayerName(team.player1Id);
    const player2 = getPlayerName(team.player2Id);
    return `${player1} & ${player2}`;
  };

  const handleReturnHome = () => {
    clearPlayerInfo();
    navigate('/');
  };

  return (
    <>
      <ExitButton />
      <section className="hero is-fullheight-with-navbar">
      <div className="hero-body">
        <div className="container" style={{ maxWidth: '800px' }}>
          <h1 className="title is-2 has-text-centered mb-6">Game Over</h1>

          <div className="mb-6">
            <h2 className="subtitle is-4 has-text-centered mb-4">🏆 Winners!</h2>
            <div className="box has-background-primary has-text-white has-text-centered p-6">
              <h3 className="title is-3 has-text-white mb-3">
                {winningTeam ? getTeamNames(winningTeam) : '???'}
              </h3>
              <p className="title is-1 has-text-white has-text-weight-bold">
                {winningTeam ? winningTeam.score : '???'} points
              </p>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="subtitle is-4 mb-4">Final Standings</h2>
            <div>
              {sortedTeams.map((team, index) => (
                <div
                  key={team.teamId}
                  className={`box mb-3 is-flex is-justify-content-space-between is-align-items-center ${
                    index === 0 ? 'has-background-link-light' : ''
                  }`}
                  style={index === 0 ? { borderLeft: '4px solid hsl(229, 53%, 53%)' } : {}}
                >
                  <div>
                    <span className="has-text-weight-bold is-size-5 mr-3">
                      #{index + 1}
                    </span>
                    <span className="is-size-5">
                      {getTeamNames(team)}
                    </span>
                  </div>
                  <div className={`title is-4 mb-0 ${index === 0 ? 'has-text-link' : 'has-text-grey'}`}>
                    {team.score}
                  </div>
                </div>
              ))}
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
