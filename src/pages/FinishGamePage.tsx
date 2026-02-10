import {useEffect, useMemo, useRef, useState} from 'react';
import {LayoutGroup, motion} from 'framer-motion';
import {usePlayerInfo} from '../hooks/usePlayerInfo';
import {useSocket} from '../hooks/useSocket';
import {useGameContext} from '../context/GameContext';
import {useCelebrationConfetti} from '../hooks/useConfetti';
import {usePodiumConfetti} from '../hooks/usePodiumConfetti';
import {ExitButton} from '../components/common/ExitButton';
import {TeamName} from '../components/common/TeamName';
import {PlaceBadge} from '../components/common/PlaceBadge';
import {ScoreDisplay} from '../components/common/ScoreDisplay';
import type {Player, Team} from '../types/game';
import {findPlayerBySocketId} from '../utils/playerUtils';
import {calculateAllPlaces, sortTeamsWithTiebreaker} from '../utils/rankingUtils';
import {springGentle} from '../styles/motion';

function formatTotalTime(ms: number): string {
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
}

interface StandingsRowProps {
  team: Team;
  player1: Player | undefined;
  player2: Player | undefined;
  place: number;
  totalTime: number;
  hasAnyScores: boolean;
  isHost: boolean;
  onAwardPoint: (teamId: string) => void;
  rowRef: (el: HTMLDivElement | null) => void;
}

function StandingsRow({
  team, player1, player2, place, totalTime,
  hasAnyScores, isHost, onAwardPoint, rowRef,
}: StandingsRowProps) {
  const [hovered, setHovered] = useState(false);
  const isWinner = place === 1 && hasAnyScores;
  const showBadge = hasAnyScores && place <= 3;

  return (
    <motion.div
      ref={rowRef}
      layout
      layoutId={team.teamId}
      key={team.teamId}
      className="mb-3"
      style={{
        position: 'relative',
        ...(isHost ? { paddingRight: 280, marginRight: -280 } : {}),
      }}
      onMouseEnter={isHost ? () => setHovered(true) : undefined}
      onMouseLeave={isHost ? () => setHovered(false) : undefined}
    >
      <div
        className={`box has-background-white ${isWinner ? 'winning-team-border' : ''}`}
        style={{
          position: 'relative',
          zIndex: 1,
          backgroundColor: isWinner ? '#fff' : '#f5f5f5',
        }}
      >
        <div className="is-flex is-justify-content-space-between is-align-items-center">
          <div className="is-flex is-align-items-center" style={{ gap: '0.75rem' }}>
            {showBadge ? (
              <PlaceBadge place={place} size={isWinner ? 'large' : 'medium'} />
            ) : (
              <span className="has-text-weight-bold is-size-5" style={{ color: 'var(--theme-text-muted)' }}>
                #{place}
              </span>
            )}
            <TeamName player1={player1} player2={player2} />
          </div>
          <div className="has-text-right">
            <ScoreDisplay
              score={team.score}
              size="large"
              suffix={team.score === 1 ? 'pt' : 'pts'}
              highlighted={showBadge}
            />
            {totalTime > 0 && (
              <div className="is-size-6 has-text-grey is-italic">
                {formatTotalTime(totalTime)} thinking time!
              </div>
            )}
          </div>
        </div>
      </div>
      {isHost && (
        <motion.div
          initial={false}
          animate={{ x: hovered ? -30 : '-100%' }}
          transition={springGentle}
          style={{
            position: 'absolute',
            left: '75%',
            top: 0,
            bottom: 0,
            zIndex: 0,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <button
            className="button is-medium is-rounded is-warning"
            style={{ whiteSpace: 'nowrap' }}
            onClick={() => onAwardPoint(team.teamId)}
          >
            cheeky bonus point
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}

export function FinishGamePage() {
  const { playerInfo } = usePlayerInfo();
  const { gameState, dispatch } = useGameContext();
  const { emit, on } = useSocket();
  const isHost = !!playerInfo?.isHost;
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // --- All hooks called unconditionally (null-safe) ---

  const responseTimes = gameState?.teamTotalResponseTimes ?? {};
  const sortedTeams = useMemo(
    () => gameState ? sortTeamsWithTiebreaker(gameState.teams, responseTimes) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gameState?.teams, responseTimes]
  );
  const places = useMemo(
    () => gameState ? calculateAllPlaces(gameState.teams, responseTimes) : new Map<string, number>(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gameState?.teams, responseTimes]
  );

  const hasAnyScores = sortedTeams.some(t => t.score > 0);
  const finalists = sortedTeams.length > 1 ? sortedTeams.slice(0, 2) : sortedTeams.slice(0, 1);

  const shouldShowConfetti = useMemo(() => {
    if (!gameState || !playerInfo) return false;
    if (playerInfo.isHost) return true;
    if (finalists.length === 0) return false;
    const playerTeamId = gameState.players.find(p => p.name === playerInfo.name)?.teamId;
    return finalists.some(t => t.teamId === playerTeamId);
  }, [playerInfo, gameState, finalists]);

  usePodiumConfetti(sortedTeams, places, hasAnyScores, rowRefs);
  useCelebrationConfetti(shouldShowConfetti);

  useEffect(() => {
    return on('scoreUpdated', ({ teamId, newScore }) => {
      dispatch({ type: 'UPDATE_TEAM_SCORE', payload: { teamId, newScore } });
    });
  }, [on, dispatch]);

  // --- Early return after all hooks ---

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

  const showTopTwo = finalists.length > 1;

  const handleAwardPoint = (teamId: string) => {
    emit('awardPoint', { teamId, points: 1 });
  };

  return (
    <>
      <ExitButton />
      <section className="hero is-fullheight-with-navbar">
      <div className="hero-body">
        <div className="container container-md">
          <h1 className="title is-2 has-text-centered mb-6">Game Over</h1>

          <div className="mb-6">
            <h2 className="subtitle is-4 has-text-centered mb-4">
              {showTopTwo ? '🏆 Top Two Finalists!' : '🏆 Winners!'}
            </h2>
            {showTopTwo && (
              <p className="has-text-centered has-text-grey mb-4">
                Time for a live tiebreaker round!
              </p>
            )}
            <div className={showTopTwo ? 'columns is-centered' : ''}>
              {finalists.map((team, i) => {
                const player1 = findPlayerBySocketId(gameState.players, team.player1Id);
                const player2 = findPlayerBySocketId(gameState.players, team.player2Id);
                const place = places.get(team.teamId) ?? i + 1;
                return (
                  <div key={team.teamId} className={showTopTwo ? 'column is-half' : ''}>
                    <div className={`box has-text-centered p-6 ${i === 0 ? 'has-background-primary has-text-white' : 'has-background-info-light'}`}>
                      {hasAnyScores && <PlaceBadge place={place} size="large" />}
                      <div className="is-flex is-justify-content-center mb-3 mt-2">
                        <TeamName player1={player1} player2={player2} size="medium" />
                      </div>
                      <ScoreDisplay
                        score={team.score}
                        size="xlarge"
                        color={i === 0 ? 'white' : 'auto'}
                        highlighted
                        className={i === 0 ? 'title is-1' : 'title is-3'}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mb-6">
            <h2 className="subtitle is-4 mb-4">Final Standings</h2>
            <LayoutGroup>
              {sortedTeams.map((team) => {
                const player1 = findPlayerBySocketId(gameState.players, team.player1Id);
                const player2 = findPlayerBySocketId(gameState.players, team.player2Id);
                return (
                  <StandingsRow
                    key={team.teamId}
                    team={team}
                    player1={player1}
                    player2={player2}
                    place={places.get(team.teamId) ?? 999}
                    totalTime={gameState.teamTotalResponseTimes?.[team.teamId] ?? 0}
                    hasAnyScores={hasAnyScores}
                    isHost={isHost}
                    onAwardPoint={handleAwardPoint}
                    rowRef={(el: HTMLDivElement | null) => {
                      if (el) rowRefs.current.set(team.teamId, el);
                      else rowRefs.current.delete(team.teamId);
                    }}
                  />
                );
              })}
            </LayoutGroup>
          </div>
        </div>
      </div>
    </section>
    </>
  );
}
