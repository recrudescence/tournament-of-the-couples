import type { GameState, Player, GameStatus, ImportedQuestion, ImportedChapter } from './game';

export interface ClientToServerEvents {
  // common
  joinGame: (data: {
    name: string;
    isHost: boolean;
    isReconnect: boolean;
    roomCode: string;
  }) => void;
  checkRoomStatus: (data: { roomCode: string }) => void;
  leaveGame: () => void;

  // player
  requestPair: (data: { targetSocketId: string }) => void;
  unpair: () => void;
  randomizeAvatar: () => void;

  // host
  createGame: (data: { name: string }) => void;
  kickPlayer: (data: { targetSocketId: string }) => void;
  startGame: () => void;
  startRound: (data: { question: string; variant: string; options?: string[]; answerForBoth?: boolean }) => void;
  submitAnswer: (data: { answer: string; responseTime: number }) => void;
  submitPick: (data: { pickedAnswer: string }) => void;
  revealPickers: (data: { answerText: string }) => void;
  revealAuthor: (data: { answerText: string }) => void;
  startScoring: () => void;
  revealAnswer: (data: { playerName: string }) => void;
  awardPoint: (data: { teamId: string; points: number }) => void;
  removePoint: (data: { teamId: string; points: number }) => void;
  skipPoint: (data: { teamId: string }) => void;
  nextRound: () => void;
  backToAnswering: () => void;
  endGame: () => void;
  resetGame: () => void;
  addBots: (data: { count: number }) => void;
  removeBots: () => void;

  // Question import
  advanceCursor: () => void;
  sendRevealUpdate: (data: { stage: string; chapterTitle?: string; variant?: string }) => void;

  // Host controls: Question management
  resetQuestion: () => void;
  restartQuestion: () => void;
  previousQuestion: () => void;
  skipQuestion: () => void;
}

export interface ServerToClientEvents {
  // game state
  gameCreated: (data: {
    roomCode: string;
    name: string;
    isHost: boolean;
    gameState: GameState;
  }) => void;
  gameStarted: (data: GameState) => void;
  gameCancelled: (data: { reason: string }) => void;
  gameEnded: (data: GameState) => void;
  gameReset: (data: GameState) => void;

  // player state
  joinSuccess: (data: {
    roomCode: string;
    name: string;
    isHost: boolean;
    socketId: string;
    gameState: GameState;
  }) => void;
  playerDisconnected: (data: { socketId: string; name: string }) => void;
  playerReconnected: (data: { name: string; newSocketId: string; gameState: GameState }) => void;
  playerKicked: () => void;

  // gameplay state
  lobbyUpdate: (data: GameState) => void;
  roomStatus: (data: {
    found: boolean;
    error?: string;
    roomCode: string;
    status: GameStatus;
    inProgress: boolean;
    disconnectedPlayers: Player[];
    canJoinAsNew: boolean;
  }) => void;
  roundStarted: (data: {
    roundNumber: number;
    question: string;
    variant: string;
    options: string[] | null;
    answerForBoth: boolean;
    questionCreatedAt: number;
    gameState: GameState;
  }) => void;

  // round state
  answerSubmitted: (data: {
    playerName: string;
    answer: string;
    responseTime: number;
    submittedInCurrentPhase: string[];
    gameState: GameState;
  }) => void;
  allAnswersIn: () => void;
  poolReady: (data: { answers: string[]; gameState: GameState }) => void;
  pickSubmitted: (data: { playerName: string; picksSubmitted: string[]; gameState: GameState }) => void;
  allPicksIn: () => void;
  scoringStarted: (data: GameState) => void;
  returnedToAnswering: (data: GameState) => void;
  answerRevealed: (data: { playerName: string; responderName?: string; answer: string; responseTime: number }) => void;
  pickersRevealed: (data: { answerText: string; pickers: Player[] }) => void;
  authorRevealed: (data: { answerText: string; author: Player; authors?: Player[]; correctPickers: Player[]; teamId?: string | null; teamIds?: string[]; isEmptyAnswer?: boolean }) => void;
  scoreUpdated: (data: { teamId: string; newScore: number; pointsAwarded: number }) => void;
  readyForNextRound: (data: GameState) => void;

  // error
  error: (data: { message: string }) => void;

  // Question import
  questionsImported: (data: { questionCount: number; chapterCount: number; title: string }) => void;
  questionsCleared: () => void;
  cursorAdvanced: (data: {
    chapterIndex: number;
    questionIndex: number;
    question: ImportedQuestion;
    chapter: ImportedChapter;
    isNewChapter: boolean;
    isLastQuestion: boolean;
    gameState: GameState;
  }) => void;
  revealUpdate: (data: { stage: string; chapterTitle?: string; variant?: string }) => void;
  allQuestionsCompleted: () => void;

  // Host controls: Question management
  questionReset: (data: { gameState: GameState }) => void;
  questionRestarted: (data: {
    cursorData: {
      chapterIndex: number;
      questionIndex: number;
      question: ImportedQuestion;
      chapter: ImportedChapter;
      isNewChapter: boolean;
      isLastQuestion: boolean;
    } | null;
    gameState: GameState;
  }) => void;
  cursorChanged: (data: {
    action: 'previous' | 'skip';
    cursorData: {
      chapterIndex: number;
      questionIndex: number;
      question: ImportedQuestion;
      chapter: ImportedChapter;
      isNewChapter: boolean;
      isLastQuestion: boolean;
    } | null;
    gameState: GameState;
  }) => void;
}
