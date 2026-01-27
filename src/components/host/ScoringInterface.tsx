import { type Player, type CurrentRound } from '../../types/game';
import { findPlayerBySocketId } from '../../utils/playerUtils';
import { TeamName } from '../common/TeamName';
import { Question } from '../common/Question.tsx';
import { BothPlayersScoring } from './BothPlayersScoring';
import { SinglePlayerScoring } from './SinglePlayerScoring';

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
      <Question question={currentRound?.question}/>
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

              {isExpanded && currentRound && (
                <div className="content">
                  {currentRound.answerForBoth ? (
                    <BothPlayersScoring
                      player1={player1}
                      player2={player2}
                      currentRound={currentRound}
                      revealedAnswers={revealedAnswers}
                      onRevealAnswer={onRevealAnswer}
                    />
                  ) : (
                    <SinglePlayerScoring
                      sortedPlayers={sortedPlayers}
                      currentRound={currentRound}
                      revealedAnswers={revealedAnswers}
                      revealedResponseTimes={revealedResponseTimes}
                      onRevealAnswer={onRevealAnswer}
                    />
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
