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
const reopenAnsweringBtn = document.getElementById('reopenAnsweringBtn');
const backToAnsweringBtn = document.getElementById('backToAnsweringBtn');

const teamCardsContainer = document.getElementById('teamCardsContainer');
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
      // Create team cards once DOM is ready
      setTimeout(() => createTeamCards(), 0);
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

  // Hide reopen button at start of new round
  reopenAnsweringBtn.classList.add('hidden');

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
  // Hide reopen button when round first completes
  reopenAnsweringBtn.classList.add('hidden');
  gameStatusEl.textContent = 'All Answers In';
});

socket.on('answerRevealed', (data) => {
  console.log('Answer revealed:', data);
  gameState.revealedAnswers.add(data.playerName);
  displayRevealedAnswer(data.playerName, data.answer);
});

socket.on('scoreUpdated', (data) => {
  console.log('Score updated:', data);
  // Update the team in our local state
  const team = gameState.teams.find(t => t.teamId === data.teamId);
  if (team) {
    team.score = data.newScore;
  }

  // Don't update the team card score here - it shows round points, not total
  // The scoreboard below will show the updated total

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
  // Hide the reopen button since round is now open
  reopenAnsweringBtn.classList.add('hidden');
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
  // Hide reopen button when entering scoring
  reopenAnsweringBtn.classList.add('hidden');
  createTeamCards();
  showPhase('scoring');
});

finishRoundBtn.addEventListener('click', () => {
  socket.emit('nextRound');
});

// Back to Answering - just navigates HOST view, doesn't change server state
if (backToAnsweringBtn) {
  backToAnsweringBtn.addEventListener('click', () => {
    console.log('Back to answering view (host only)');
    gameStatusEl.textContent = 'Answering';
    updateAnswerStatus();
    showPhase('answering');
    // Show the reopen button so host can actually reopen the round if needed
    reopenAnsweringBtn.classList.remove('hidden');
  });
} else {
  console.error('backToAnsweringBtn not found!');
}

// Re-open Answering - emits to server to actually reopen the round for players
if (reopenAnsweringBtn) {
  reopenAnsweringBtn.addEventListener('click', () => {
    console.log('Re-opening answering round');
    socket.emit('backToAnswering');
    // Hide this button after clicking
    reopenAnsweringBtn.classList.add('hidden');
  });
} else {
  console.error('reopenAnsweringBtn not found!');
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

// Create all team cards when entering scoring phase
function createTeamCards() {
  teamCardsContainer.innerHTML = '';
  finishRoundBtn.classList.add('hidden');

  gameState.teams.forEach((team, index) => {
    const player1 = gameState.players.find(p => p.socketId === team.player1Id);
    const player2 = gameState.players.find(p => p.socketId === team.player2Id);

    const card = document.createElement('div');
    card.className = `team-card ${index === 0 ? 'expanded' : 'collapsed'}`;
    card.dataset.teamId = team.teamId;
    card.dataset.teamIndex = index;

    card.innerHTML = `
      <div class="team-card-header">
        <div class="team-card-title">${player1?.name || '?'} & ${player2?.name || '?'}</div>
        <div class="team-card-score"></div>
      </div>
      <div class="team-card-content">
        <div class="player-answer">
          <h4>${player1?.name || 'Player 1'}</h4>
          <button class="btn btn-secondary reveal-btn" data-player-name="${player1?.name}">Reveal Answer</button>
          <div class="answer-display hidden" data-player-name="${player1?.name}"></div>
        </div>
        <div class="player-answer">
          <h4>${player2?.name || 'Player 2'}</h4>
          <button class="btn btn-secondary reveal-btn" data-player-name="${player2?.name}">Reveal Answer</button>
          <div class="answer-display hidden" data-player-name="${player2?.name}"></div>
        </div>
        <div class="scoring-actions">
          <button class="btn btn-success award-btn" data-team-id="${team.teamId}">Award Point ⭐</button>
          <button class="btn btn-neutral skip-btn">No Point</button>
        </div>
      </div>
    `;

    teamCardsContainer.appendChild(card);

    // Add event listeners for this card
    const revealBtns = card.querySelectorAll('.reveal-btn');
    revealBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const playerName = btn.dataset.playerName;
        socket.emit('revealAnswer', { playerName });
      });
    });

    const awardBtn = card.querySelector('.award-btn');
    awardBtn.addEventListener('click', () => {
      socket.emit('awardPoint', { teamId: team.teamId });
      collapseCardAndMoveNext(card, index, 1); // Awarded 1 point
    });

    const skipBtn = card.querySelector('.skip-btn');
    skipBtn.addEventListener('click', () => {
      collapseCardAndMoveNext(card, index, 0); // Awarded 0 points
    });
  });
}

// Collapse current card and expand next one
function collapseCardAndMoveNext(card, currentIndex, pointsAwarded) {
  // Display round points in the score area
  const scoreEl = card.querySelector('.team-card-score');
  if (scoreEl) {
    if (pointsAwarded > 0) {
      scoreEl.textContent = `+${pointsAwarded} point${pointsAwarded > 1 ? 's' : ''}! 🎉`;
      scoreEl.className = 'team-card-score points-awarded';
    } else {
      scoreEl.textContent = '0 points 😔';
      scoreEl.className = 'team-card-score points-none';
    }
  }

  card.classList.remove('expanded');
  card.classList.add('collapsed');

  const nextIndex = currentIndex + 1;
  if (nextIndex < gameState.teams.length) {
    // Expand next card
    const nextCard = teamCardsContainer.querySelector(`[data-team-index="${nextIndex}"]`);
    if (nextCard) {
      nextCard.classList.remove('collapsed');
      nextCard.classList.add('expanded');
    }
  } else {
    // All teams done - show finish button
    finishRoundBtn.classList.remove('hidden');
    console.log('All teams scored - showing finish round button');
  }
}

// Handle answer reveal from server
function displayRevealedAnswer(playerName, answer) {
  console.log('displayRevealedAnswer called:', { playerName, answer });

  // Find the answer display for this player across all cards
  const answerDisplay = teamCardsContainer.querySelector(`.answer-display[data-player-name="${playerName}"]`);
  const revealBtn = teamCardsContainer.querySelector(`.reveal-btn[data-player-name="${playerName}"]`);

  if (answerDisplay && revealBtn) {
    revealBtn.classList.add('hidden');
    answerDisplay.textContent = answer;
    answerDisplay.classList.remove('hidden');
    console.log('Revealed answer for', playerName);
  } else {
    console.error('Could not find answer display for player:', playerName);
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
