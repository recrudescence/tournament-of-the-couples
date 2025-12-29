import { type Player } from '../types/game';

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
