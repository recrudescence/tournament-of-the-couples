export enum GameStatus {
  LOBBY = 'lobby',
  PLAYING = 'playing',
  SCORING = 'scoring',
  ENDED = 'ended',
}

export enum RoundStatus {
  ANSWERING = 'answering',
  SELECTING = 'selecting', // Pool selection: all answers in, players picking from pool
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
  POOL_SELECTION = 'pool_selection',
}

export interface Host {
  socketId: string;
  name: string;
  avatar: PlayerAvatar;
}

export interface PlayerAvatar {
  color: string;
  emoji: string;
}

export interface PlayerIdentity {
  name: string;
  avatar: PlayerAvatar | null;
}

export interface Player {
  socketId: string;
  name: string;
  partnerId: string | null;
  teamId: string | null;
  connected: boolean;
  avatar: PlayerAvatar;
  isBot?: boolean;
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
  createdAt: number; // Server timestamp for response time calculation (survives reconnection)
  // Pool selection specific (undefined for other variants)
  picks?: Record<string, string>; // playerName -> picked answer text
  picksSubmitted?: string[]; // player names who submitted picks
  answerPool?: string[]; // shuffled answer texts (set when all answers are in)
}

export interface GameState {
  roomCode: string;
  gameId: string;
  status: GameStatus;
  host: Host;
  players: Player[];
  teams: Team[];
  currentRound: CurrentRound | null;
  lastRoundNumber: number; // Persists across rounds for reconnection
  teamTotalResponseTimes: Record<string, number>; // Cumulative response times per team (teamId -> total ms)
  importedQuestions: ImportedQuestionSet | null;
  questionCursor: QuestionCursor | null;
}

export interface PlayerInfo {
  name: string;
  isHost: boolean;
  roomCode: string;
}

// Question Import Types
export interface ImportedQuestion {
  question: string;
  variant: RoundVariant;
  options?: string[] | null;
  answerForBoth?: boolean;
}

export interface ImportedChapter {
  title: string;
  questions: ImportedQuestion[];
}

export interface ImportedQuestionSet {
  title: string;
  chapters: ImportedChapter[];
}

export interface QuestionCursor {
  chapterIndex: number;
  questionIndex: number;
}
