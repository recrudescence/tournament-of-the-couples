import {useCallback, useMemo, useRef, useState} from 'react';
import {type CurrentRound, type Player, type Team} from '../../types/game';
import {findPlayerBySocketId} from '../../utils/playerUtils';
import {TeamName} from '../common/TeamName';
import {Question} from '../common/Question.tsx';
import {ScoringModal} from './ScoringModal';
import {fireScoringBurst} from '../../hooks/useConfetti';
import {formatResponseTime} from '../../utils/formatUtils';

interface ScoringInterfaceProps {
  teams: Team[];
  players: Player[];
  currentRound: CurrentRound | null;
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

const SCORE_TAG_POP_MS = 400;

export function ScoringInterface({
  teams,
  players,
  currentRound,
  teamPointsAwarded,
  revealedAnswers,
  revealedResponseTimes,
  showFinishBtn,
  onRevealAnswer,
  onAwardPoints,
  onReopenTeamScoring,
  onFinishRound
}: ScoringInterfaceProps) {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [recentlyScored, setRecentlyScored] = useState<string | null>(null);
  const scoreTagRefs = useRef<Record<string, HTMLSpanElement | null>>({});

  // Sort teams by total response time (ascending) for scoring display
  const teamsSortedByResponseTime = useMemo(() => {
    if (!teams || !currentRound) return [];

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
  }, [teams, currentRound, players]);

  // Get selected team data
  const selectedTeamData = useMemo(() => {
    if (!selectedTeamId) return null;
    return teamsSortedByResponseTime.find(t => t.team.teamId === selectedTeamId) ?? null;
  }, [selectedTeamId, teamsSortedByResponseTime]);

  const handleOpenModal = useCallback((teamId: string) => {
    setSelectedTeamId(teamId);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedTeamId(null);
  }, []);

  const handleReopenScoring = useCallback((teamId: string, originalIndex: number) => {
    onReopenTeamScoring(teamId, originalIndex);
    setSelectedTeamId(teamId);
  }, [onReopenTeamScoring]);

  const handleAwardPoints = useCallback((teamId: string, originalIndex: number, points: number) => {
    // Close modal first
    setSelectedTeamId(null);

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
      <Question question={currentRound?.question}/>
      <h2 className="subtitle is-4 mb-4">Review Team Answers</h2>

      <div className="mb-4">
        {teamsSortedByResponseTime.map(({ team, originalIndex, totalResponseTime, player1, player2 }) => {
          const isScored = team.teamId in teamPointsAwarded;
          const points = teamPointsAwarded[team.teamId] ?? 0;
          const isRecentlyScored = recentlyScored === team.teamId;

          return (
            <div
              key={team.teamId}
              className="box mb-3"
            >
              <div className="is-flex is-justify-content-space-between is-align-items-center">
                <div className="is-flex is-align-items-center" style={{ gap: '0.5rem' }}>
                  <TeamName player1={player1} player2={player2} size='large' />
                </div>
                <div className="is-flex is-align-items-center" style={{ gap: '0.5rem' }}>
                  {isScored ? (
                    <>
                      <button
                        className="button is-light is-small"
                        onClick={() => handleReopenScoring(team.teamId, originalIndex)}
                        data-tooltip-id="tooltip"
                        data-tooltip-content="Re-score"
                      >
                        ↪️
                      </button>
                      {totalResponseTime < Infinity && (
                        <span className="tag is-family-secondary is-medium">
                          ⏱️ {formatResponseTime(totalResponseTime)}
                        </span>
                      )}
                      <span
                        ref={el => { scoreTagRefs.current[team.teamId] = el; }}
                        className={`tag is-medium ${points > 0 ? (points > 1 ? 'is-warning' : 'is-success') : 'is-light'} ${isRecentlyScored ? 'score-tag-pop' : ''}`}
                      >
                        {points > 0 ? `+${points} pts` : '0 pts'}
                      </span>
                    </>
                  ) : (
                    <button
                      className="button is-link"
                      onClick={() => handleOpenModal(team.teamId)}
                    >
                      Score
                    </button>
                  )}
                </div>
              </div>
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

      {/* Scoring Modal */}
      {selectedTeamData && currentRound && (
        <ScoringModal
          team={selectedTeamData.team}
          player1={selectedTeamData.player1}
          player2={selectedTeamData.player2}
          currentRound={currentRound}
          totalResponseTime={selectedTeamData.totalResponseTime}
          sortedPlayers={[
            { player: selectedTeamData.player1, time: selectedTeamData.player1Time },
            { player: selectedTeamData.player2, time: selectedTeamData.player2Time }
          ].sort((a, b) => a.time - b.time)}
          revealedAnswers={revealedAnswers}
          revealedResponseTimes={revealedResponseTimes}
          onRevealAnswer={onRevealAnswer}
          onAwardPoints={(points) => handleAwardPoints(selectedTeamData.team.teamId, selectedTeamData.originalIndex, points)}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}
