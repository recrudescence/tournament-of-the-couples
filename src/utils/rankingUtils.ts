import type { Team } from '../types/game';

/**
 * Sort teams by score (descending), using total response time as tiebreaker (ascending).
 * Lower response time is better when scores are equal.
 */
export function sortTeamsWithTiebreaker(
  teams: Team[],
  responseTimes: Record<string, number> = {}
): Team[] {
  return [...teams].sort((a, b) => {
    // Primary sort: higher score is better
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    // Tiebreaker: lower response time is better
    const aTime = responseTimes[a.teamId] ?? Infinity;
    const bTime = responseTimes[b.teamId] ?? Infinity;
    return aTime - bTime;
  });
}

/**
 * Calculate place for a single team.
 * Since ties are broken by response time, each team gets a unique place.
 */
export function calculatePlace(
  teams: Team[],
  teamId: string,
  responseTimes: Record<string, number> = {}
): number | null {
  const sortedTeams = sortTeamsWithTiebreaker(teams, responseTimes);
  const index = sortedTeams.findIndex(t => t.teamId === teamId);
  return index >= 0 ? index + 1 : null;
}

/**
 * Calculate places for all teams at once.
 * Returns a Map of teamId → place.
 * Since ties are broken by response time, each team gets a unique place.
 */
export function calculateAllPlaces(
  teams: Team[],
  responseTimes: Record<string, number> = {}
): Map<string, number> {
  const sortedTeams = sortTeamsWithTiebreaker(teams, responseTimes);
  const places = new Map<string, number>();

  sortedTeams.forEach((team, index) => {
    places.set(team.teamId, index + 1);
  });

  return places;
}
