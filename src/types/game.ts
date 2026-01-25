export enum GameStatus {
  LOBBY = 'lobby',
  PLAYING = 'playing',
  SCORING = 'scoring',
  ENDED = 'ended',
}

export enum RoundStatus {
  ANSWERING = 'answering',
  COMPLETE = 'complete',
}

export enum RoundPhase {
  INITIAL = 'initial',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
}

export enum RoundVariant {
  OPEN_ENDED = 'open_ended',
  MULTIPLE_CHOICE = 'multiple_choice',
  BINARY = 'binary',
}

export interface Host {
  socketId: string;
  name: string;
}

export interface PlayerAvatar {
  color: string;
  emoji: string;
}

export interface Player {
  socketId: string;
  name: string;
  partnerId: string | null;
  teamId: string | null;
  connected: boolean;
  avatar: PlayerAvatar;
}

export interface Team {
  teamId: string;
  player1Id: string;
  player2Id: string;
  score: number;
}

export interface Answer {
  text: string;
  responseTime: number; // milliseconds
}

export interface CurrentRound {
  roundNumber: number;
  roundId: string | null;
  question: string;
  variant: RoundVariant;
  options: string[] | null;
  answerForBoth: boolean; // When true, players answer for both themselves and their partner
  status: RoundStatus;
  answers: Record<string, Answer>; // When answerForBoth, text is JSON: { [playerName]: answer }
  submittedInCurrentPhase: string[];
}

export interface GameState {
  roomCode: string;
  gameId: string;
  status: GameStatus;
  host: Host;
  players: Player[];
  teams: Team[];
  currentRound: CurrentRound | null;
}

export interface PlayerInfo {
  name: string;
  isHost: boolean;
  roomCode: string;
}
