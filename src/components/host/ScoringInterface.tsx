import { type Player, type CurrentRound } from '../../types/game';
import { findPlayerBySocketId } from '../../utils/playerUtils';
import { PlayerAvatar } from '../common/PlayerAvatar';
import { TeamName } from '../common/TeamName';

// Helper to parse dual answer JSON
function parseDualAnswer(text: string): Record<string, string> | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Component for dual answer mode scoring
function DualAnswerScoring({
  player1,
  player2,
  currentRound,
  revealedAnswers,
  onRevealAnswer
}: {
  player1: Player | undefined;
  player2: Player | undefined;
  currentRound: CurrentRound;
  revealedAnswers: Set<string>;
  onRevealAnswer: (key: string) => void;
}) {
  if (!player1 || !player2) return null;

  const player1Answer = currentRound.answers[player1.name];
  const player2Answer = currentRound.answers[player2.name];

  // Parse JSON answers
  const player1Parsed = player1Answer ? parseDualAnswer(player1Answer.text) : null;
  const player2Parsed = player2Answer ? parseDualAnswer(player2Answer.text) : null;

  // Subjects are both players (we show "What about Alice?" and "What about Bob?")
  const subjects = [player1, player2];

  return (
    <div className="dual-answer-scoring">
      {subjects.map((subject) => {
        // Reveal keys: "Alice:Alice" means Alice's answer about Alice
        const p1RevealKey = `${player1.name}:${subject.name}`;
        const p2RevealKey = `${player2.name}:${subject.name}`;
        const p1Revealed = revealedAnswers.has(p1RevealKey);
        const p2Revealed = revealedAnswers.has(p2RevealKey);

        // Get answers about this subject
        const p1AnswerForSubject = player1Parsed?.[subject.name] ?? '(no answer)';
        const p2AnswerForSubject = player2Parsed?.[subject.name] ?? '(no answer)';

        return (
          <div key={subject.socketId} className="box has-background-white-ter mb-3">
            <div className="is-flex is-align-items-center mb-3" style={{ gap: '0.5rem' }}>
              <PlayerAvatar avatar={subject.avatar} size="medium" />
              <span className="subtitle is-5 mb-0">Responses for {subject.name}:</span>
            </div>

            <div className="columns">
              {/* Player 1's answer about this subject */}
              <div className="column">
                <div className="box mt-3">
                  <div className="is-flex is-align-items-center mb-2" style={{ gap: '0.25rem' }}>
                    <PlayerAvatar avatar={player1.avatar} size="small" />
                    <span className="is-size-7 has-text-grey">{player1.name} said:</span>
                  </div>
                  {!p1Revealed ? (
                    <button
                      className="button is-link is-small"
                      onClick={() => {
                        onRevealAnswer(p1RevealKey);
                      }}
                    >
                      Reveal
                    </button>
                  ) : (
                    <div className="notification is-light is-small py-2 px-3">
                      <strong>{p1AnswerForSubject}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Player 2's answer about this subject */}
              <div className="column">
                <div className="box mt-3">
                  <div className="is-flex is-align-items-center mb-2" style={{ gap: '0.25rem' }}>
                    <PlayerAvatar avatar={player2.avatar} size="small" />
                    <span className="is-size-7 has-text-grey">{player2.name} said:</span>
                  </div>
                  {!p2Revealed ? (
                    <button
                      className="button is-link is-small"
                      onClick={() => {
                        onRevealAnswer(p2RevealKey);
                      }}
                    >
                      Reveal
                    </button>
                  ) : (
                    <div className="notification is-light is-small py-2 px-3">
                      <strong>{p2AnswerForSubject}</strong>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface TeamWithTiming {
  team: {
    teamId: string;
    player1Id: string;
    player2Id: string;
    score: number;
  };
  originalIndex: number;
  totalResponseTime: number;
  player1Time: number;
  player2Time: number;
}

interface ScoringInterfaceProps {
  teamsSortedByResponseTime: TeamWithTiming[];
  players: Player[];
  currentRound: CurrentRound | null;
  currentTeamIndex: number;
  teamPointsAwarded: Record<string, number>;
  revealedAnswers: Set<string>;
  revealedResponseTimes: Record<string, number>;
  showFinishBtn: boolean;
  onBackToAnswering: () => void;
  onRevealAnswer: (playerName: string) => void;
  onAwardPoints: (teamId: string, teamIndex: number, points: number) => void;
  onReopenTeamScoring: (teamId: string, teamIndex: number) => void;
  onFinishRound: () => void;
}

export function ScoringInterface({
  teamsSortedByResponseTime,
  players,
  currentRound,
  currentTeamIndex,
  teamPointsAwarded,
  revealedAnswers,
  revealedResponseTimes,
  showFinishBtn,
  onBackToAnswering,
  onRevealAnswer,
  onAwardPoints,
  onReopenTeamScoring,
  onFinishRound
}: ScoringInterfaceProps) {
  return (
    <div className="box">
      <button className="button is-info is-small mb-3" onClick={onBackToAnswering}>
        ← Back to Answering
      </button>
      <h2 className="subtitle is-4 mb-4">Review Team Answers</h2>

      <div className="mb-4">
        {teamsSortedByResponseTime.map(({ team, originalIndex, totalResponseTime, player1Time, player2Time }) => {
          const player1 = findPlayerBySocketId(players, team.player1Id);
          const player2 = findPlayerBySocketId(players, team.player2Id);
          const isScored = team.teamId in teamPointsAwarded;
          const isExpanded = originalIndex === currentTeamIndex && !isScored;

          // Sort players by response time (ascending)
          const sortedPlayers = [
            { player: player1, time: player1Time },
            { player: player2, time: player2Time }
          ].sort((a, b) => a.time - b.time);

          // Only show total time after both individual times are revealed
          const bothRevealed = player1?.name && player2?.name &&
            revealedAnswers.has(player1.name) && revealedAnswers.has(player2.name);

          return (
            <div
              key={team.teamId}
              className={`box mb-3 ${isExpanded ? 'has-background-link-light' : ''}`}
            >
              <div className="is-flex is-justify-content-space-between is-align-items-center mb-2">
                <div className="is-flex is-align-items-center" style={{ gap: '0.5rem' }}>
                  <TeamName player1={player1} player2={player2} size='large' />
                  {bothRevealed && totalResponseTime < Infinity && (
                    <span className="has-text-grey is-size-6 ml-2">
                      took {(totalResponseTime / 1000).toFixed(1)} seconds!
                    </span>
                  )}
                </div>
                <div className="is-flex is-align-items-center">
                  {isScored && (
                    <span
                      className={`tag is-medium mr-2 ${
                        (teamPointsAwarded[team.teamId] ?? 0) > 0
                          ? 'is-success'
                          : 'is-light'
                      }`}
                    >
                      {(teamPointsAwarded[team.teamId] ?? 0) > 0
                        ? `+${teamPointsAwarded[team.teamId]} ${teamPointsAwarded[team.teamId] === 1 ? 'point' : 'points'}! 🎉`
                        : '0 points 😔'}
                    </span>
                  )}
                  {!isExpanded && isScored && (
                    <button
                      className="button is-info is-small"
                      onClick={() => onReopenTeamScoring(team.teamId, originalIndex)}
                    >
                      ↪️
                    </button>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="content">
                  {currentRound?.answerForBoth ? (
                    // Dual answer mode: group by subject (who the answer is about)
                    <DualAnswerScoring
                      player1={player1}
                      player2={player2}
                      currentRound={currentRound}
                      revealedAnswers={revealedAnswers}
                      onRevealAnswer={onRevealAnswer}
                    />
                  ) : (
                    // Single answer mode: show each player's answer
                    <div className="columns">
                      {sortedPlayers.map(({ player }) =>
                        player ? (
                          <div key={player.socketId} className="column">
                            <div className="box has-background-white-ter">
                              <div className="is-flex is-align-items-center mb-3" style={{ gap: '0.5rem' }}>
                                <PlayerAvatar avatar={player.avatar} size="medium" />
                                <span className="subtitle is-6 mb-0">{player.name} said...</span>
                              </div>
                              {!revealedAnswers.has(player.name) ? (
                                <button
                                  className="button is-link"
                                  onClick={() => {
                                    onRevealAnswer(player.name);
                                  }}
                                >
                                  Reveal Answer
                                </button>
                              ) : (
                                <div className="notification is-light">
                                  <strong>{currentRound?.answers[player.name]?.text || 'No answer'}</strong>
                                  {revealedResponseTimes[player.name] !== undefined && (
                                    <span className="has-text-grey ml-2">
                                      (took {(revealedResponseTimes[player.name]! / 1000).toFixed(2)}s)
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : null
                      )}
                    </div>
                  )}

                  <div className="field is-grouped is-grouped-centered mt-4">
                    <div className="control">
                      <button
                        className="button is-light is-large"
                        onClick={() => onAwardPoints(team.teamId, originalIndex, 0)}
                      >
                        zero pts 😔
                      </button>
                    </div>
                    <div className="control">
                      <button
                        className="button is-success is-large"
                        onClick={() => onAwardPoints(team.teamId, originalIndex, 1)}
                      >
                        one point ⭐
                      </button>
                    </div>
                    <div className="control">
                      <button
                        className="button is-warning is-large"
                        onClick={() => onAwardPoints(team.teamId, originalIndex, 2)}
                      >
                        🌟 two! ptz! 🌟
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showFinishBtn && (
        <div className="has-text-centered mt-4">
          <button className="button is-primary is-large" onClick={onFinishRound}>
            Finish Round
          </button>
        </div>
      )}
    </div>
  );
}
