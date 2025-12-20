import { useGameContext } from '../../context/GameContext';
import './debug-sidebar.css';

export function DebugSidebar() {
  const { gameState, playerInfo, roundPhase } = useGameContext();

  return (
    <div className="debug-sidebar">
      <details>
        <summary>🐛 Debug Info</summary>
        <div className="debug-content">
          <section>
            <h4>Player Info</h4>
            <pre>{JSON.stringify(playerInfo, null, 2)}</pre>
          </section>

          <section>
            <h4>Round Phase</h4>
            <pre>{roundPhase}</pre>
          </section>

          <section>
            <h4>Game State</h4>
            <pre>
              {JSON.stringify(
                gameState,
                (_key, value) => {
                  // Don't stringify Sets in JSON
                  if (value instanceof Set) {
                    return Array.from(value);
                  }
                  return value;
                },
                2
              )}
            </pre>
          </section>
        </div>
      </details>
    </div>
  );
}