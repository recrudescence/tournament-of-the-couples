import { useEffect, useMemo, useRef } from 'react';
import { firePlaceBurst } from './useConfetti';
import type { Team } from '../types/game';

/**
 * Track podium positions (1st/2nd/3rd) and fire confetti bursts
 * when a team moves up into or within the podium.
 */
export function usePodiumConfetti(
  sortedTeams: Team[],
  places: Map<string, number>,
  hasAnyScores: boolean,
  rowRefs: React.RefObject<Map<string, HTMLDivElement>>,
) {
  const prevPodiumRef = useRef<Record<number, string>>({});

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
            const el = rowRefs.current?.get(teamId);
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
  }, [currentPodium, rowRefs]);
}
