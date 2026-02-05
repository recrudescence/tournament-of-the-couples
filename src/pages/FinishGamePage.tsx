import {useEffect, useMemo, useRef, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {LayoutGroup, motion} from 'framer-motion';
import {usePlayerInfo} from '../hooks/usePlayerInfo';
import {useSocket} from '../hooks/useSocket';
import {useGameContext} from '../context/GameContext';
import {useCelebrationConfetti, firePlaceBurst} from '../hooks/useConfetti';
import {ExitButton} from '../components/common/ExitButton';
import {TeamName} from '../components/common/TeamName';
import {PlaceBadge} from '../components/common/PlaceBadge';
import type {Team} from '../types/game';
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

export function FinishGamePage() {
  const navigate = useNavigate();
  const { playerInfo, clearPlayerInfo } = usePlayerInfo();
  const { gameState, dispatch } = useGameContext();
  const { emit, on } = useSocket();
  const [hoveredTeamId, setHoveredTeamId] = useState<string | null>(null);
  const isHost = !!playerInfo?.isHost;
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const prevPodiumRef = useRef<Record<number, string>>({});

  useEffect(() => {
    const unsub = on('scoreUpdated', ({ teamId, newScore }) => {
      dispatch({ type: 'UPDATE_TEAM_SCORE', payload: { teamId, newScore } });
    });
    return unsub;
  }, [on, dispatch]);

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

  // Sort teams by score (descending), using response time as tiebreaker
  const responseTimes = gameState.teamTotalResponseTimes ?? {};
  const sortedTeams = useMemo(
    () => sortTeamsWithTiebreaker(gameState.teams, responseTimes),
    [gameState.teams, responseTimes]
  );
  const places = useMemo(
    () => calculateAllPlaces(gameState.teams, responseTimes),
    [gameState.teams, responseTimes]
  );

  // Check if anyone has scored (hide badges if all teams have 0 points)
  const hasAnyScores = sortedTeams.some(t => t.score > 0);

  // Track podium positions and fire confetti when they change
  const currentPodium = useMemo(() => {
    if (!hasAnyScores) return {};
    const podium: Record<number, string> = {};
    for (const team of sortedTeams) {
      const place = places.get(team.teamId);
      if (place && place <= 3 && !podium[place]) podium[place] = team.teamId;
    }
    return podium;
  }, [sortedTeams, places, hasAnyScores]);

  useEffect(() => {
    const prev = prevPodiumRef.current;
    const timers: ReturnType<typeof setTimeout>[] = [];

    if (Object.keys(prev).length > 0) {
      const prevByTeam = Object.fromEntries(
        Object.entries(prev).map(([p, id]) => [id, Number(p)])
      );
      for (const place of [1, 2, 3]) {
        const teamId = currentPodium[place];
        const prevPlace = teamId ? prevByTeam[teamId] : undefined;
        if (teamId && prev[place] !== teamId && (!prevPlace || place < prevPlace)) {
          timers.push(setTimeout(() => {
            const el = rowRefs.current.get(teamId);
            if (el) {
              const rect = el.getBoundingClientRect();
              firePlaceBurst(
                { x: (rect.left + 50) / window.innerWidth, y: (rect.top + 40) / window.innerHeight },
                place,
              );
            }
          }, 400));
        }
      }
    }

    prevPodiumRef.current = currentPodium;
    return () => timers.forEach(clearTimeout);
  }, [currentPodium]);

  // Top finalists: show top 2 if more than 1 team, otherwise just the winner
  const finalists = sortedTeams.length > 1 ? sortedTeams.slice(0, 2) : sortedTeams.slice(0, 1);
  const showTopTwo = finalists.length > 1;

  const getTeamPlayers = (team: Team) => {
    const player1 = findPlayerBySocketId(gameState.players, team.player1Id);
    const player2 = findPlayerBySocketId(gameState.players, team.player2Id);
    return { player1, player2 };
  };

  // Determine if confetti should be shown (host or player on a finalist team)
  const shouldShowConfetti = useMemo(() => {
    if (playerInfo?.isHost) return true;
    if (!playerInfo || finalists.length === 0) return false;
    const playerTeamId = gameState.players.find(p => p.name === playerInfo.name)?.teamId;
    return finalists.some(t => t.teamId === playerTeamId);
  }, [playerInfo, gameState.players, finalists]);

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
                const { player1, player2 } = getTeamPlayers(team);
                const place = places.get(team.teamId) ?? i + 1;
                return (
                  <div key={team.teamId} className={showTopTwo ? 'column is-half' : ''}>
                    <div className={`box has-text-centered p-6 ${i === 0 ? 'has-background-primary has-text-white' : 'has-background-info-light'}`}>
                      {hasAnyScores && <PlaceBadge place={place} size="large" />}
                      <div className="is-flex is-justify-content-center mb-3 mt-2">
                        <TeamName player1={player1} player2={player2} size="medium" />
                      </div>
                      <p className={`title is-${i === 0 ? '1' : '3'} mb-0 ${i === 0 ? 'has-text-white' : ''} has-text-weight-bold`}>
                        {team.score} points
                      </p>
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
                const { player1, player2 } = getTeamPlayers(team);
                const totalTime = gameState.teamTotalResponseTimes?.[team.teamId] ?? 0;
                const place = places.get(team.teamId) ?? 999;
                const isWinner = place === 1 && hasAnyScores;
                const showBadge = hasAnyScores && place <= 3;
                const isHovered = hoveredTeamId === team.teamId;
                return (
                  <motion.div
                    ref={(el: HTMLDivElement | null) => {
                      if (el) rowRefs.current.set(team.teamId, el);
                      else rowRefs.current.delete(team.teamId);
                    }}
                    layout
                    layoutId={team.teamId}
                    key={team.teamId}
                    className="mb-3"
                    style={{
                      position: 'relative',
                      ...(isHost ? { paddingRight: 280, marginRight: -280 } : {}),
                    }}
                    onMouseEnter={isHost ? () => setHoveredTeamId(team.teamId) : undefined}
                    onMouseLeave={isHost ? () => setHoveredTeamId(null) : undefined}
                  >
                    <div
                      className={`box ${isWinner ? 'winning-team-border' : ''}`}
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
                          <div className={`title is-4 mb-0 ${showBadge ? 'has-text-link' : 'has-text-grey'}`}>
                            {team.score} {team.score === 1 ? 'pt' : 'pts'}
                          </div>
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
                        animate={{ x: isHovered ? -30 : '-100%' }}
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
                          onClick={() => emit('awardPoint', { teamId: team.teamId, points: 1 })}
                        >
                          cheeky bonus point
                        </button>
                      </motion.div>
                    )}
                  </motion.div>
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
