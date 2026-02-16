import {useCallback, useMemo, useRef, useState} from 'react';
import {type CurrentRound, type Player, type Team} from '../../types/game';
import {findPlayerBySocketId} from '../../utils/playerUtils';
import {TeamName} from '../common/TeamName';
import {Question} from '../common/Question.tsx';
import {type NavDirection} from '../../styles/motion';
import {ScoringModal} from './ScoringModal';
import {fireScoringBurst} from '../../hooks/useConfetti';
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
// Constants
// =============================================================================

const SCORE_TAG_POP_MS = 400;

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

function getScoreTagClassName(points: number, isRecentlyScored: boolean): string {
  const classes = ['tag', 'is-medium'];

  if (points > 1) {
    classes.push('is-warning');
  } else if (points > 0) {
    classes.push('is-primary');
  } else {
    classes.push('is-light');
  }

  if (isRecentlyScored) {
    classes.push('score-tag-pop');
  }

  return classes.join(' ');
}

// =============================================================================
// Sub-components
// =============================================================================

function TeamRow({
  teamData,
  isScored,
  points,
  isRecentlyScored,
  scoreTagRef,
  onOpenModal,
  onReopenScoring
}: {
  teamData: TeamSortedData;
  isScored: boolean;
  points: number;
  isRecentlyScored: boolean;
  scoreTagRef: (el: HTMLSpanElement | null) => void;
  onOpenModal: () => void;
  onReopenScoring: () => void;
}) {
  const { totalResponseTime, player1, player2 } = teamData;

  return (
    <div
      className="box mb-3 is-clickable"
      onClick={isScored ? onReopenScoring : onOpenModal}
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
              <span
                ref={scoreTagRef}
                className={getScoreTagClassName(points, isRecentlyScored)}
              >
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

function FinishRoundButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <div className="has-text-centered mt-6 mb-2">
      <button className="button is-primary is-large" onClick={onClick} disabled={disabled}>
        Finish Round
      </button>
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
  const [recentlyScored, setRecentlyScored] = useState<string | null>(null);
  const scoreTagRefs = useRef<Record<string, HTMLSpanElement | null>>({});

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

  const handleReopenScoring = useCallback((teamId: string, originalIndex: number, sortedIndex: number) => {
    onReopenTeamScoring(teamId, originalIndex);
    setNavDirection(null);
    setSelectedSortedIndex(sortedIndex);
  }, [onReopenTeamScoring]);

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
    // Close modal first
    setSelectedSortedIndex(null);
    setNavDirection(null);

    // Track which team was just scored for animation
    setRecentlyScored(teamId);

    // Award points (this updates parent state)
    onAwardPoints(teamId, originalIndex, points);

    // Fire confetti after tag pop animation completes (only for points > 0)
    if (points > 0) {
      setTimeout(() => {
        const tagEl = scoreTagRefs.current[teamId];
        if (tagEl) {
          const rect = tagEl.getBoundingClientRect();
          const originX = rect.right / window.innerWidth;
          const originY = rect.top / window.innerHeight + (rect.height / 2 / window.innerHeight);
          fireScoringBurst(originX, originY, points);
        }
        setRecentlyScored(null);
      }, SCORE_TAG_POP_MS);
    } else {
      setTimeout(() => setRecentlyScored(null), SCORE_TAG_POP_MS);
    }
  }, [onAwardPoints]);

  return (
    <div className="box">
      <Question question={currentRound?.question} />
      <h2 className="subtitle is-4 mb-4">Review Team Answers</h2>

      <div className="mb-4">
        {teamsSortedByResponseTime.map((teamData, sortedIndex) => {
          const { team, originalIndex } = teamData;
          const isScored = team.teamId in teamPointsAwarded;
          const points = teamPointsAwarded[team.teamId] ?? 0;
          const isRecentlyScored = recentlyScored === team.teamId;

          return (
            <TeamRow
              key={team.teamId}
              teamData={teamData}
              isScored={isScored}
              points={points}
              isRecentlyScored={isRecentlyScored}
              scoreTagRef={(el) => { scoreTagRefs.current[team.teamId] = el; }}
              onOpenModal={() => handleOpenModal(sortedIndex)}
              onReopenScoring={() => handleReopenScoring(team.teamId, originalIndex, sortedIndex)}
            />
          );
        })}
      </div>

      <FinishRoundButton
        onClick={onFinishRound}
        disabled={teams.some(t => !(t.teamId in teamPointsAwarded))}
      />

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
          onPrev={handlePrev}
          onNext={handleNext}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}
