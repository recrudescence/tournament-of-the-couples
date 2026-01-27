import { type Player, type Team } from '../types/game';

/**
 * Find a player by their socket ID
 */
export function findPlayerBySocketId(
  players: Player[],
  socketId: string
): Player | undefined {
  return players.find((p) => p.socketId === socketId);
}

/**
 * Find a player by their name
 */
export function findPlayerByName(
  players: Player[],
  name: string
): Player | undefined {
  return players.find((p) => p.name === name);
}

/**
 * Transform binary variant options by replacing "Player 1"/"Player 2" placeholders
 * with actual team member names.
 */
export function transformBinaryOptions(
  options: string[] | null,
  variant: string,
  players: Player[],
  team: Team | null
): string[] | null {
  if (variant !== 'binary' || !options || !team) {
    return options;
  }
  const player1 = findPlayerBySocketId(players, team.player1Id);
  const player2 = findPlayerBySocketId(players, team.player2Id);
  return [player1?.name ?? 'Player 1', player2?.name ?? 'Player 2'];
}
