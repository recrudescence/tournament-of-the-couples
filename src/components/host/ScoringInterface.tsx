import {useCallback, useMemo, useState} from 'react';
import {type CurrentRound, type Player, type Team} from '../../types/game';
import {findPlayerBySocketId} from '../../utils/playerUtils';
import {TeamName} from '../common/TeamName';
import {Question} from '../common/Question.tsx';
import {type NavDirection} from '../../styles/motion';
import {ScoringModal} from './ScoringModal';
import {formatResponseTime} from '../../utils/formatUtils';

// =============================================================================
// Types
// =============================================================================

interface ScoringInterfaceProps {
  teams: Team[];
  players: Player[];
  currentRound: CurrentRound | null;
  teamPointsAwarded: Record<string, number>;
  revealedAnswers: Set<string>;
  revealedResponseTimes: Record<string, number>;
  onBackToAnswering: () => void;
  onRevealAnswer: (playerName: string) => void;
  onAwardPoints: (teamId: string, teamIndex: number, points: number) => void;
  onReopenTeamScoring: (teamId: string, teamIndex: number) => void;
  onFinishRound: () => void;
}

interface TeamSortedData {
  team: Team;
  originalIndex: number;
  totalResponseTime: number;
  player1Time: number;
  player2Time: number;
  player1: Player | undefined;
  player2: Player | undefined;
}

// =============================================================================
// Helper Functions
// =============================================================================

function buildSortedTeamData(
  teams: Team[],
  players: Player[],
  currentRound: CurrentRound
): TeamSortedData[] {
  return teams.map((team, originalIndex) => {
    const player1 = findPlayerBySocketId(players, team.player1Id);
    const player2 = findPlayerBySocketId(players, team.player2Id);

    const player1Answer = player1 ? currentRound.answers[player1.name] : null;
    const player2Answer = player2 ? currentRound.answers[player2.name] : null;

    const player1Time = player1Answer?.responseTime ?? Infinity;
    const player2Time = player2Answer?.responseTime ?? Infinity;
    const totalResponseTime = player1Time + player2Time;

    return {
      team,
      originalIndex,
      totalResponseTime,
      player1Time,
      player2Time,
      player1,
      player2
    };
  }).sort((a, b) => a.totalResponseTime - b.totalResponseTime);
}

function getScoreTagClassName(points: number): string {
  const color = points > 1 ? 'is-warning' : points > 0 ? 'is-primary' : 'is-light';
  return `tag is-medium ${color}`;
}

// =============================================================================
// Sub-components
// =============================================================================

function TeamRow({
  teamData,
  isScored,
  points,
  onOpenModal
}: {
  teamData: TeamSortedData;
  isScored: boolean;
  points: number;
  onOpenModal: () => void;
}) {
  const { totalResponseTime, player1, player2 } = teamData;

  return (
    <div
      className="box mb-3 is-clickable"
      onClick={onOpenModal}
      style={{ cursor: 'pointer' }}
    >
      <div className="is-flex is-justify-content-space-between is-align-items-center">
        <div className="is-flex is-align-items-center gap-sm">
          <TeamName player1={player1} player2={player2} size="large" />
        </div>
        <div className="is-flex is-align-items-center gap-sm">
          {isScored ? (
            <>
              {totalResponseTime < Infinity && (
                <span className="tag is-family-secondary is-medium">
                  ⏱️ {formatResponseTime(totalResponseTime)}
                </span>
              )}
              <span className={getScoreTagClassName(points)}>
                {points > 0 ? `+${points} pts` : '0 pts'}
              </span>
            </>
          ) : (
            <span className="tag is-link is-medium">Score</span>
          )}
        </div>
      </div>
    </div>
  );
}


// =============================================================================
// Main Component
// =============================================================================

export function ScoringInterface({
  teams,
  players,
  currentRound,
  teamPointsAwarded,
  revealedAnswers,
  revealedResponseTimes,
  onRevealAnswer,
  onAwardPoints,
  onReopenTeamScoring,
  onFinishRound
}: ScoringInterfaceProps) {
  const [selectedSortedIndex, setSelectedSortedIndex] = useState<number | null>(null);
  const [navDirection, setNavDirection] = useState<NavDirection>(null);

  // Sort teams by total response time (ascending) for scoring display
  const teamsSortedByResponseTime = useMemo(() => {
    if (!teams || !currentRound) return [];
    return buildSortedTeamData(teams, players, currentRound);
  }, [teams, currentRound, players]);

  // Get selected team data
  const selectedTeamData = selectedSortedIndex !== null
    ? teamsSortedByResponseTime[selectedSortedIndex] ?? null
    : null;

  const handleOpenModal = useCallback((sortedIndex: number) => {
    setNavDirection(null);
    setSelectedSortedIndex(sortedIndex);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedSortedIndex(null);
    setNavDirection(null);
  }, []);

  const handlePrev = useCallback(() => {
    setNavDirection('prev');
    setSelectedSortedIndex(prev => prev !== null && prev > 0 ? prev - 1 : prev);
  }, []);

  const handleNext = useCallback(() => {
    setNavDirection('next');
    setSelectedSortedIndex(prev =>
      prev !== null && prev < teamsSortedByResponseTime.length - 1 ? prev + 1 : prev
    );
  }, [teamsSortedByResponseTime.length]);

  const handleAwardPoints = useCallback((teamId: string, originalIndex: number, points: number) => {
    // Award points (this updates parent state) — modal stays open
    onAwardPoints(teamId, originalIndex, points);
  }, [onAwardPoints]);

  const handleRescore = useCallback((teamId: string, originalIndex: number) => {
    onReopenTeamScoring(teamId, originalIndex);
  }, [onReopenTeamScoring]);

  const hasUnscoredTeams = teams.some(t => !(t.teamId in teamPointsAwarded));

  return (
    <div className="box">
      <Question question={currentRound?.question} />
      <h2 className="subtitle is-4 mb-4">Review Team Answers</h2>

      <div className="mb-4">
        {teamsSortedByResponseTime.map((teamData, sortedIndex) => {
          const { team } = teamData;
          const isScored = team.teamId in teamPointsAwarded;
          const points = teamPointsAwarded[team.teamId] ?? 0;

          return (
            <TeamRow
              key={team.teamId}
              teamData={teamData}
              isScored={isScored}
              points={points}
              onOpenModal={() => handleOpenModal(sortedIndex)}
            />
          );
        })}
      </div>

      <div className="has-text-centered mt-6 mb-2">
        <button className="button is-primary is-large" onClick={onFinishRound} disabled={hasUnscoredTeams}>
          Finish Round
        </button>
      </div>

      {/* Scoring Modal */}
      {selectedTeamData && currentRound && (
        <ScoringModal
          key={selectedTeamData.team.teamId}
          team={selectedTeamData.team}
          player1={selectedTeamData.player1}
          player2={selectedTeamData.player2}
          currentRound={currentRound}
          totalResponseTime={selectedTeamData.totalResponseTime}
          isFastestTeam={selectedSortedIndex === 0}
          isScored={selectedTeamData.team.teamId in teamPointsAwarded}
          scoredPoints={teamPointsAwarded[selectedTeamData.team.teamId] ?? 0}
          navDirection={navDirection}
          hasPrev={selectedSortedIndex! > 0}
          hasNext={selectedSortedIndex! < teamsSortedByResponseTime.length - 1}
          sortedPlayers={[
            { player: selectedTeamData.player1, time: selectedTeamData.player1Time },
            { player: selectedTeamData.player2, time: selectedTeamData.player2Time }
          ].sort((a, b) => a.time - b.time)}
          revealedAnswers={revealedAnswers}
          revealedResponseTimes={revealedResponseTimes}
          onRevealAnswer={onRevealAnswer}
          onAwardPoints={(points) => handleAwardPoints(selectedTeamData.team.teamId, selectedTeamData.originalIndex, points)}
          onRescore={() => handleRescore(selectedTeamData.team.teamId, selectedTeamData.originalIndex)}
          onPrev={handlePrev}
          onNext={handleNext}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}
