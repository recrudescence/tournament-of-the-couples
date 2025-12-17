// Load session data
const playerData = JSON.parse(sessionStorage.getItem('playerInfo'));
if (!playerData || playerData.isHost) {
  alert('You must join as a player first!');
  window.location.href = '/';
}

// DOM Elements
const playerNameEl = document.getElementById('playerName');
const partnerNameEl = document.getElementById('partnerName');
const teamScoreEl = document.getElementById('teamScore');

const waitingSection = document.getElementById('waitingSection');
const answeringSection = document.getElementById('answeringSection');
const submittedSection = document.getElementById('submittedSection');
const scoringSection = document.getElementById('scoringSection');

const roundNumberEl = document.getElementById('roundNumber');
const questionTextEl = document.getElementById('questionText');
const answerForm = document.getElementById('answerForm');
const answerInput = document.getElementById('answerInput');
const submittedAnswerText = document.getElementById('submittedAnswerText');

// Game State
let gameState = {
  mySocketId: null,
  myTeamId: null,
  partnerId: null,
  currentRoundNumber: 0,
  hasSubmitted: false
};

// Initialize
playerNameEl.textContent = playerData.name;

// Connect to Socket.io
const socket = io();

// Join as player
socket.emit('joinGame', { 
  name: playerData.name, 
  isHost: false 
});

// Socket Listeners

socket.on('joinSuccess', (data) => {
  console.log('Player joined successfully:', data);

  // Extract gameState (might be nested or direct)
  const state = data.gameState || data;
  const mySocketId = data.socketId || data.player?.socketId;
  gameState.mySocketId = mySocketId;

  // Find my player data
  if (state.players) {
    const me = state.players.find(p => p.socketId === mySocketId);
    if (me && me.teamId) {
      gameState.myTeamId = me.teamId;

      // Find my team
      const myTeam = state.teams.find(t => t.teamId === me.teamId);
      if (myTeam) {
        // Find partner
        gameState.partnerId = myTeam.player1Id === mySocketId
          ? myTeam.player2Id
          : myTeam.player1Id;

        const partner = state.players.find(p => p.socketId === gameState.partnerId);
        if (partner) {
          partnerNameEl.textContent = partner.name;
        }

        // Update score
        teamScoreEl.textContent = myTeam.score;
      }
    }
  }

  // Restore round state if there's an active round
  if (state.currentRound) {
    gameState.currentRoundNumber = state.currentRound.roundNumber;
    roundNumberEl.textContent = state.currentRound.roundNumber;
    questionTextEl.textContent = state.currentRound.question;

    // Check for answer by player name (stable across reconnections)
    const previousAnswer = state.currentRound.answers && state.currentRound.answers[playerData.name];

    // Restore to correct section based on round status
    if (state.status === 'scoring' || state.currentRound.status === 'complete') {
      // Host is scoring
      if (previousAnswer) {
        submittedAnswerText.textContent = previousAnswer;
      }
      showSection('scoring');
    } else if (state.currentRound.status === 'answering') {
      // Round is active, show answering section with pre-filled answer (if exists)
      if (previousAnswer) {
        answerInput.value = previousAnswer;
        console.log('Pre-filled previous answer on reconnect:', previousAnswer);
      } else {
        answerInput.value = '';
      }
      gameState.hasSubmitted = false; // Allow (re)submission during answering phase
      showSection('answering');
    } else {
      showSection('waiting');
    }
  } else {
    // No active round, show waiting section
    showSection('waiting');
  }
});

socket.on('roundStarted', (data) => {
  console.log('Round started:', data);
  gameState.currentRoundNumber = data.roundNumber;
  gameState.hasSubmitted = false;
  
  roundNumberEl.textContent = data.roundNumber;
  questionTextEl.textContent = data.question;
  answerInput.value = '';
  
  showSection('answering');
});

socket.on('answerSubmitted', (data) => {
  console.log('Answer confirmed:', data);
  // Check by player name (stable across reconnections)
  if (data.playerName === playerData.name) {
    gameState.hasSubmitted = true;
    submittedAnswerText.textContent = data.answer;
    showSection('submitted');
  }
});

socket.on('allAnswersIn', () => {
  console.log('All answers in!');
  showSection('scoring');
});

socket.on('scoreUpdated', (data) => {
  console.log('Score updated:', data);
  if (data.teamId === gameState.myTeamId) {
    teamScoreEl.textContent = data.newScore;
    
    // Show brief celebration
    teamScoreEl.style.transform = 'scale(1.3)';
    teamScoreEl.style.color = '#28a745';
    setTimeout(() => {
      teamScoreEl.style.transform = 'scale(1)';
      teamScoreEl.style.color = '';
    }, 500);
  }
});

socket.on('readyForNextRound', (data) => {
  console.log('Ready for next round');
  showSection('waiting');
});

socket.on('returnedToAnswering', (data) => {
  console.log('Returned to answering phase', data);

  // Pre-fill answer input if player had previously submitted
  // Check by player name (stable across reconnections)
  if (data && data.currentRound && data.currentRound.answers) {
    const previousAnswer = data.currentRound.answers[playerData.name];
    if (previousAnswer) {
      answerInput.value = previousAnswer;
      gameState.hasSubmitted = false; // Allow re-submission
      console.log('Pre-filled previous answer:', previousAnswer);
    } else {
      answerInput.value = '';
      gameState.hasSubmitted = false;
    }
  } else {
    answerInput.value = '';
    gameState.hasSubmitted = false;
  }

  showSection('answering');
});

socket.on('error', (data) => {
  alert('Error: ' + data.message);
  
  // If submission error, go back to answering
  if (gameState.hasSubmitted) {
    gameState.hasSubmitted = false;
    showSection('answering');
  }
});

// Event Handlers

answerForm.addEventListener('submit', (e) => {
  e.preventDefault();
  
  if (gameState.hasSubmitted) {
    alert('You have already submitted an answer for this round!');
    return;
  }
  
  const answer = answerInput.value.trim();
  if (answer) {
    socket.emit('submitAnswer', { answer });
  }
});

// Helper Functions

function showSection(section) {
  waitingSection.classList.add('hidden');
  answeringSection.classList.add('hidden');
  submittedSection.classList.add('hidden');
  scoringSection.classList.add('hidden');
  
  if (section === 'waiting') {
    waitingSection.classList.remove('hidden');
  } else if (section === 'answering') {
    answeringSection.classList.remove('hidden');
  } else if (section === 'submitted') {
    submittedSection.classList.remove('hidden');
  } else if (section === 'scoring') {
    scoringSection.classList.remove('hidden');
  }
}
