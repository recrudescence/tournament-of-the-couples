import type { GameState, Player, CurrentRound, GameStatus } from './game';

export interface ClientToServerEvents {
  createGame: (data: { name: string }) => void;
  joinGame: (data: {
    name: string;
    isHost: boolean;
    isReconnect: boolean;
    roomCode: string;
  }) => void;
  checkRoomStatus: (data: { roomCode: string }) => void;
  requestPair: (data: { targetSocketId: string }) => void;
  unpair: () => void;
  startGame: () => void;
  startRound: (data: { question: string }) => void;
  submitAnswer: (data: { answer: string }) => void;
  revealAnswer: (data: { playerName: string }) => void;
  awardPoint: (data: { teamId: string }) => void;
  removePoint: (data: { teamId: string }) => void;
  skipPoint: (data: { teamId: string }) => void;
  nextRound: () => void;
  backToAnswering: () => void;
  endGame: () => void;
}

export interface ServerToClientEvents {
  gameCreated: (data: {
    roomCode: string;
    name: string;
    isHost: boolean;
    gameState: GameState;
  }) => void;
  joinSuccess: (data: {
    roomCode: string;
    name: string;
    isHost: boolean;
    socketId: string;
    gameState: GameState;
  }) => void;
  roomStatus: (data: {
    found: boolean;
    error?: string;
    roomCode: string;
    status: GameStatus;
    inProgress: boolean;
    disconnectedPlayers: Player[];
    canJoinAsNew: boolean;
  }) => void;
  lobbyUpdate: (data: GameState) => void;
  gameStarted: (data: GameState) => void;
  roundStarted: (data: {
    roundNumber: number;
    question: string;
    gameState: GameState;
  }) => void;
  answerSubmitted: (data: {
    playerName: string;
    answer: string;
    submittedInCurrentPhase: string[];
  }) => void;
  allAnswersIn: () => void;
  answerRevealed: (data: { playerName: string; answer: string }) => void;
  scoreUpdated: (data: { teamId: string; newScore: number }) => void;
  readyForNextRound: (data: { nextRoundNumber: number }) => void;
  returnedToAnswering: (data: { currentRound: CurrentRound }) => void;
  playerDisconnected: (data: { socketId: string; name: string }) => void;
  playerReconnected: (data: { name: string; newSocketId: string }) => void;
  gameEnded: (data: GameState) => void;
  error: (data: { message: string }) => void;
}
