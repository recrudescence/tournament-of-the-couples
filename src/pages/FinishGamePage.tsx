import { useNavigate } from 'react-router-dom';
import { usePlayerInfo } from '../hooks/usePlayerInfo';
import { useGameContext } from '../context/GameContext';
import type { Team } from '../types/game';

export function FinishGamePage() {
  const navigate = useNavigate();
  const { clearPlayerInfo } = usePlayerInfo();
  const { gameState } = useGameContext();

  if (!gameState) {
    return (
      <div className="container">
        <h1>Game Over</h1>
        <p>Loading results...</p>
      </div>
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
    <div className="container">
      <h1>Game Over!</h1>

      <div className="form-section">
        <h2>🏆 Winners!</h2>
        <div className="winner-card" style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          padding: '30px',
          borderRadius: '12px',
          marginBottom: '30px',
          textAlign: 'center'
        }}>
          <h3 style={{ fontSize: '2em', margin: '10px 0' }}>
            {winningTeam ? getTeamNames(winningTeam) : '???'}
          </h3>
          <p style={{ fontSize: '3em', margin: '10px 0', fontWeight: 'bold' }}>
            {winningTeam ? winningTeam.score : '???'} points
          </p>
        </div>

        <h2>Final Standings</h2>
        <div style={{ marginBottom: '30px' }}>
          {sortedTeams.map((team, index) => (
            <div
              key={team.teamId}
              style={{
                padding: '15px',
                marginBottom: '10px',
                borderRadius: '8px',
                background: index === 0 ? '#f0f9ff' : '#f9fafb',
                border: index === 0 ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <span style={{
                  fontWeight: 'bold',
                  fontSize: '1.2em',
                  marginRight: '10px'
                }}>
                  #{index + 1}
                </span>
                <span style={{ fontSize: '1.1em' }}>
                  {getTeamNames(team)}
                </span>
              </div>
              <div style={{
                fontSize: '1.5em',
                fontWeight: 'bold',
                color: index === 0 ? '#3b82f6' : '#6b7280'
              }}>
                {team.score}
              </div>
            </div>
          ))}
        </div>

        <div>
          <p style={{ marginBottom: '15px', color: '#6b7280' }}>
            Thanks for playing! Click below to return to the home page.
          </p>
          <button className="primary" onClick={handleReturnHome}>
            Return to Home
          </button>
        </div>
      </div>
    </div>
  );
}
