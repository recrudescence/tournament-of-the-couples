// Load session data
const hostData = JSON.parse(sessionStorage.getItem('playerInfo'));
if (!hostData || !hostData.isHost) {
  alert('You must join as host first!');
  window.location.href = '/';
}

// DOM Elements
const hostNameEl = document.getElementById('hostName');
const roundNumberEl = document.getElementById('roundNumber');
const gameStatusEl = document.getElementById('gameStatus');

const roundSetupSection = document.getElementById('roundSetupSection');
const answeringSection = document.getElementById('answeringSection');
const scoringSection = document.getElementById('scoringSection');

const startRoundForm = document.getElementById('startRoundForm');
const questionInput = document.getElementById('questionInput');
const currentQuestionEl = document.getElementById('currentQuestion');

const answersCountEl = document.getElementById('answersCount');
const totalPlayersEl = document.getElementById('totalPlayers');
const playerStatusList = document.getElementById('playerStatusList');
const allAnswersNotification = document.getElementById('allAnswersNotification');
const startScoringBtn = document.getElementById('startScoringBtn');
const backToAnsweringBtn = document.getElementById('backToAnsweringBtn');

const currentTeamNumEl = document.getElementById('currentTeamNum');
const totalTeamsEl = document.getElementById('totalTeams');
const teamNameEl = document.getElementById('teamName');
const player1NameEl = document.getElementById('player1Name');
const player2NameEl = document.getElementById('player2Name');
const revealAnswer1Btn = document.getElementById('revealAnswer1Btn');
const revealAnswer2Btn = document.getElementById('revealAnswer2Btn');
const answer1Display = document.getElementById('answer1Display');
const answer2Display = document.getElementById('answer2Display');
const awardPointBtn = document.getElementById('awardPointBtn');
const skipPointBtn = document.getElementById('skipPointBtn');
const nextTeamBtn = document.getElementById('nextTeamBtn');
const finishRoundBtn = document.getElementById('finishRoundBtn');

const scoreboardList = document.getElementById('scoreboardList');

// Game State
let gameState = {
  roundNumber: 0,
  currentQuestion: '',
  teams: [],
  players: [],
  answers: {},
  submittedInCurrentPhase: new Set(), // Track who has submitted in current answering session
  currentTeamIndex: 0,
  revealedAnswers: new Set()
};

// Initialize
hostNameEl.textContent = hostData.name;

// Connect to Socket.io
const socket = io();

// Join as host
socket.emit('joinGame', { 
  name: hostData.name, 
  isHost: true 
});

// Socket Listeners

socket.on('joinSuccess', (data) => {
  console.log('Host joined successfully:', data);
  // Extract gameState (might be nested or direct)
  const state = data.gameState || data;
  gameState.players = state.players || [];
  gameState.teams = state.teams || [];
  updateScoreboard();

  // Restore round state if there's an active round
  if (state.currentRound) {
    gameState.roundNumber = state.currentRound.roundNumber;
    gameState.currentQuestion = state.currentRound.question;
    gameState.answers = state.currentRound.answers || {};

    roundNumberEl.textContent = gameState.roundNumber;
    currentQuestionEl.textContent = state.currentRound.question;
    gameStatusEl.textContent = state.status === 'scoring' ? 'Scoring' : 'Playing';

    // Restore to correct phase based on round status
    if (state.status === 'scoring' || state.currentRound.status === 'complete') {
      // Show scoring phase
      gameState.currentTeamIndex = 0;
      gameStatusEl.textContent = 'Scoring';
      showPhase('scoring');
      // Initialize team display once DOM is ready
      setTimeout(() => showTeam(0), 0);
    } else if (state.currentRound.status === 'answering') {
      // Show answering phase
      updateAnswerStatus();
      showPhase('answering');
    }
  } else if (state.status === 'playing') {
    // Game started but no round yet
    gameStatusEl.textContent = 'Playing';
    showPhase('roundSetup');
  }
});

socket.on('gameStarted', (data) => {
  console.log('Game started:', data);
  gameStatusEl.textContent = 'Playing';
  gameState.roundNumber = 1;
  roundNumberEl.textContent = gameState.roundNumber;
  showPhase('roundSetup');
});

socket.on('roundStarted', (data) => {
  console.log('Round started:', data);
  gameState.roundNumber = data.roundNumber;
  gameState.currentQuestion = data.question;
  gameState.answers = {};
  gameState.submittedInCurrentPhase.clear();
  gameState.revealedAnswers.clear();

  roundNumberEl.textContent = gameState.roundNumber;
  currentQuestionEl.textContent = data.question;
  gameStatusEl.textContent = 'Answering';

  updateAnswerStatus();
  showPhase('answering');
});

socket.on('answerSubmitted', (data) => {
  console.log('Answer submitted:', data);
  console.log('Current answers before update:', Object.keys(gameState.answers));
  // Track answers by player name (stable across reconnections)
  gameState.answers[data.playerName] = data.answer;
  // Mark player as submitted in current phase
  gameState.submittedInCurrentPhase.add(data.playerName);
  console.log('Current answers after update:', Object.keys(gameState.answers));
  console.log('Submitted in current phase:', Array.from(gameState.submittedInCurrentPhase));
  console.log('Calling updateAnswerStatus');
  updateAnswerStatus();
});

socket.on('allAnswersIn', () => {
  console.log('All answers in!');
  allAnswersNotification.classList.remove('hidden');
  startScoringBtn.classList.remove('hidden');
  gameStatusEl.textContent = 'All Answers In';
});

socket.on('answerRevealed', (data) => {
  console.log('Answer revealed:', data);
  gameState.revealedAnswers.add(data.socketId);
  displayRevealedAnswer(data.socketId, data.answer);
});

socket.on('scoreUpdated', (data) => {
  console.log('Score updated:', data);
  // Update the team in our local state
  const team = gameState.teams.find(t => t.teamId === data.teamId);
  if (team) {
    team.score = data.newScore;
  }
  updateScoreboard();
});

socket.on('readyForNextRound', (data) => {
  console.log('Ready for next round');
  gameState.roundNumber = data.nextRoundNumber;
  roundNumberEl.textContent = gameState.roundNumber;
  gameStatusEl.textContent = 'Setting Up';
  questionInput.value = '';
  showPhase('roundSetup');
});

socket.on('returnedToAnswering', (data) => {
  console.log('Returned to answering phase', data);
  // Restore answers from server state (for pre-filling)
  if (data && data.currentRound && data.currentRound.answers) {
    gameState.answers = data.currentRound.answers;
    console.log('Restored answers from server:', gameState.answers);
  }
  // Clear submission tracking - players must submit again
  gameState.submittedInCurrentPhase.clear();
  console.log('Cleared submission tracking - waiting for new submissions');
  gameStatusEl.textContent = 'Answering';
  updateAnswerStatus();
  showPhase('answering');
});

socket.on('error', (data) => {
  alert('Error: ' + data.message);
});

// Event Handlers

startRoundForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const question = questionInput.value.trim();
  if (question) {
    socket.emit('startRound', { question });
  }
});

startScoringBtn.addEventListener('click', () => {
  gameState.currentTeamIndex = 0;
  gameStatusEl.textContent = 'Scoring';
  showTeam(0);
  showPhase('scoring');
});

revealAnswer1Btn.addEventListener('click', () => {
  const team = gameState.teams[gameState.currentTeamIndex];
  const player1 = gameState.players.find(p => p.socketId === team.player1Id);
  socket.emit('revealAnswer', { playerName: player1.name });
});

revealAnswer2Btn.addEventListener('click', () => {
  const team = gameState.teams[gameState.currentTeamIndex];
  const player2 = gameState.players.find(p => p.socketId === team.player2Id);
  socket.emit('revealAnswer', { playerName: player2.name });
});

awardPointBtn.addEventListener('click', () => {
  const team = gameState.teams[gameState.currentTeamIndex];
  socket.emit('awardPoint', { teamId: team.teamId });
  moveToNextTeam();
});

skipPointBtn.addEventListener('click', () => {
  moveToNextTeam();
});

nextTeamBtn.addEventListener('click', () => {
  moveToNextTeam();
});

finishRoundBtn.addEventListener('click', () => {
  socket.emit('nextRound');
});

if (backToAnsweringBtn) {
  backToAnsweringBtn.addEventListener('click', () => {
    console.log('Back to answering clicked');
    console.log('Socket connected:', socket.connected);
    console.log('Socket ID:', socket.id);
    socket.emit('backToAnswering');
    console.log('backToAnswering event emitted');
  });
} else {
  console.error('backToAnsweringBtn not found!');
}

// Helper Functions

function showPhase(phase) {
  roundSetupSection.classList.add('hidden');
  answeringSection.classList.add('hidden');
  scoringSection.classList.add('hidden');
  
  if (phase === 'roundSetup') {
    roundSetupSection.classList.remove('hidden');
  } else if (phase === 'answering') {
    answeringSection.classList.remove('hidden');
    allAnswersNotification.classList.add('hidden');
    startScoringBtn.classList.add('hidden');
  } else if (phase === 'scoring') {
    scoringSection.classList.remove('hidden');
  }
}

function updateAnswerStatus() {
  // Count only players who have submitted in the CURRENT answering phase
  const submittedCount = gameState.submittedInCurrentPhase.size;
  const totalCount = gameState.players.length;

  console.log('updateAnswerStatus called:', {
    submittedCount,
    totalCount,
    answers: gameState.answers,
    submittedInPhase: Array.from(gameState.submittedInCurrentPhase)
  });

  answersCountEl.textContent = submittedCount;
  totalPlayersEl.textContent = totalCount;

  // Update player status list
  playerStatusList.innerHTML = '';
  gameState.players.forEach(player => {
    const li = document.createElement('li');
    // Check if player has submitted in current phase (not just if answer exists)
    const hasSubmitted = gameState.submittedInCurrentPhase.has(player.name);
    console.log(`Player ${player.name}: hasSubmitted=${hasSubmitted}`);
    li.textContent = `${player.name} ${hasSubmitted ? '✅' : '⏳'}`;
    li.className = hasSubmitted ? 'answered' : 'waiting';
    playerStatusList.appendChild(li);
  });
}

function showTeam(teamIndex) {
  gameState.currentTeamIndex = teamIndex;
  const team = gameState.teams[teamIndex];
  
  if (!team) return;
  
  const player1 = gameState.players.find(p => p.socketId === team.player1Id);
  const player2 = gameState.players.find(p => p.socketId === team.player2Id);
  
  currentTeamNumEl.textContent = teamIndex + 1;
  totalTeamsEl.textContent = gameState.teams.length;
  teamNameEl.textContent = `${player1?.name || 'Player 1'} & ${player2?.name || 'Player 2'}`;
  player1NameEl.textContent = player1?.name || 'Player 1';
  player2NameEl.textContent = player2?.name || 'Player 2';
  
  // Reset reveal state
  revealAnswer1Btn.classList.remove('hidden');
  revealAnswer2Btn.classList.remove('hidden');
  answer1Display.classList.add('hidden');
  answer2Display.classList.add('hidden');
  answer1Display.textContent = '';
  answer2Display.textContent = '';
  
  // Hide next team button initially
  nextTeamBtn.classList.add('hidden');
  finishRoundBtn.classList.add('hidden');
}

function displayRevealedAnswer(socketId, answer) {
  const team = gameState.teams[gameState.currentTeamIndex];
  
  if (socketId === team.player1Id) {
    revealAnswer1Btn.classList.add('hidden');
    answer1Display.textContent = answer;
    answer1Display.classList.remove('hidden');
  } else if (socketId === team.player2Id) {
    revealAnswer2Btn.classList.add('hidden');
    answer2Display.textContent = answer;
    answer2Display.classList.remove('hidden');
  }
}

function moveToNextTeam() {
  const nextIndex = gameState.currentTeamIndex + 1;
  
  if (nextIndex < gameState.teams.length) {
    // More teams to review
    showTeam(nextIndex);
  } else {
    // All teams reviewed - show finish button
    nextTeamBtn.classList.add('hidden');
    finishRoundBtn.classList.remove('hidden');
  }
}

function updateScoreboard() {
  scoreboardList.innerHTML = '';
  
  if (gameState.teams.length === 0) {
    scoreboardList.innerHTML = '<p>No teams yet</p>';
    return;
  }
  
  // Sort teams by score (descending)
  const sortedTeams = [...gameState.teams].sort((a, b) => b.score - a.score);
  
  sortedTeams.forEach(team => {
    const player1 = gameState.players.find(p => p.socketId === team.player1Id);
    const player2 = gameState.players.find(p => p.socketId === team.player2Id);
    
    const teamDiv = document.createElement('div');
    teamDiv.className = 'team-score';
    teamDiv.innerHTML = `
      <span class="team-names">${player1?.name || '?'} & ${player2?.name || '?'}</span>
      <span class="score">${team.score} pts</span>
    `;
    scoreboardList.appendChild(teamDiv);
  });
}
