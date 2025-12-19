const socket = io();

// Get DOM elements
const loading = document.getElementById('loading');
const mainMenu = document.getElementById('mainMenu');
const gameCreatedSection = document.getElementById('gameCreatedSection');
const errorDiv = document.getElementById('error');

// Create game elements
const hostNameInput = document.getElementById('hostName');
const createGameBtn = document.getElementById('createGameBtn');

// Join game elements - Step 1: Room code
const roomCodeStep = document.getElementById('roomCodeStep');
const joinRoomCodeInput = document.getElementById('joinRoomCode');
const checkRoomBtn = document.getElementById('checkRoomBtn');

// Join game elements - Step 2a: Name input (for lobby)
const nameInputStep = document.getElementById('nameInputStep');
const joinPlayerNameInput = document.getElementById('joinPlayerName');
const joinGameBtn = document.getElementById('joinGameBtn');
const backToRoomCodeBtn = document.getElementById('backToRoomCodeBtn');

// Join game elements - Step 2b: Reconnect (for game in progress)
const reconnectStep = document.getElementById('reconnectStep');
const disconnectedPlayersList = document.getElementById('disconnectedPlayersList');
const backToRoomCodeBtn2 = document.getElementById('backToRoomCodeBtn2');

// Game created elements
const displayRoomCodeEl = document.getElementById('displayRoomCode');
const continueToLobbyBtn = document.getElementById('continueToLobbyBtn');

// State for join flow
let currentRoomCode = null;

// On connection, show main menu
socket.on('connect', () => {
  console.log('Connected to server');
  loading.classList.add('hidden');
  mainMenu.classList.remove('hidden');
});

// Create Game Flow
createGameBtn.onclick = () => {
  const name = hostNameInput.value.trim();

  if (!name) {
    showError('Please enter your name');
    return;
  }

  createGameBtn.disabled = true;
  socket.emit('createGame', { name });
};

// Handle game created event
socket.on('gameCreated', ({ roomCode, name, isHost, gameState }) => {
  console.log('Game created:', roomCode);

  // Store player info in sessionStorage
  sessionStorage.setItem('playerInfo', JSON.stringify({
    name,
    isHost: true,
    roomCode
  }));

  // Show room code to user
  displayRoomCodeEl.textContent = roomCode.toUpperCase();
  mainMenu.classList.add('hidden');
  gameCreatedSection.classList.remove('hidden');
});

// Continue to lobby button
continueToLobbyBtn.onclick = () => {
  window.location.href = '/lobby';
};

// Join Game Flow - Step 1: Check room code
checkRoomBtn.onclick = () => {
  const roomCode = joinRoomCodeInput.value.trim().toLowerCase();

  if (!roomCode) {
    showError('Please enter a room code');
    return;
  }

  if (!validateRoomCode(roomCode)) {
    showError('Room code must be 4 letters');
    return;
  }

  currentRoomCode = roomCode;
  checkRoomBtn.disabled = true;
  socket.emit('checkRoomStatus', { roomCode });
};

// Handle room status response
socket.on('roomStatus', ({ found, error, roomCode, status, inProgress, disconnectedPlayers, canJoinAsNew }) => {
  checkRoomBtn.disabled = false;

  if (!found) {
    showError(error || 'Room not found');
    return;
  }

  currentRoomCode = roomCode;

  // Hide room code step
  roomCodeStep.classList.add('hidden');

  if (inProgress) {
    // Game in progress - show disconnected players for reconnection
    if (disconnectedPlayers.length === 0) {
      showError('Cannot join game in progress. No disconnected players available.');
      roomCodeStep.classList.remove('hidden');
      return;
    }

    // Show reconnect step with disconnected players
    reconnectStep.classList.remove('hidden');
    renderDisconnectedPlayers(disconnectedPlayers);
  } else {
    // Game in lobby - show name input
    nameInputStep.classList.remove('hidden');
    joinPlayerNameInput.value = '';
    joinPlayerNameInput.focus();
  }
});

// Render disconnected players list
function renderDisconnectedPlayers(players) {
  disconnectedPlayersList.innerHTML = '';

  players.forEach(player => {
    const button = document.createElement('button');
    button.className = 'player-button';
    button.textContent = player.name;
    button.onclick = () => reconnectAsPlayer(player.name);
    disconnectedPlayersList.appendChild(button);
  });
}

// Reconnect as a disconnected player
function reconnectAsPlayer(name) {
  if (!currentRoomCode) {
    showError('Room code not set');
    return;
  }

  // Disable all player buttons
  const buttons = disconnectedPlayersList.querySelectorAll('.player-button');
  buttons.forEach(btn => btn.disabled = true);

  socket.emit('joinGame', {
    name,
    isHost: false,
    isReconnect: true,
    roomCode: currentRoomCode
  });
}

// Join as new player in lobby
joinGameBtn.onclick = () => {
  const name = joinPlayerNameInput.value.trim();

  if (!name) {
    showError('Please enter your name');
    return;
  }

  if (!currentRoomCode) {
    showError('Room code not set');
    return;
  }

  joinGameBtn.disabled = true;
  socket.emit('joinGame', {
    name,
    isHost: false,
    isReconnect: false,
    roomCode: currentRoomCode
  });
};

// Back buttons
backToRoomCodeBtn.onclick = () => {
  nameInputStep.classList.add('hidden');
  roomCodeStep.classList.remove('hidden');
  currentRoomCode = null;
};

backToRoomCodeBtn2.onclick = () => {
  reconnectStep.classList.add('hidden');
  roomCodeStep.classList.remove('hidden');
  currentRoomCode = null;
};

// Handle successful join
socket.on('joinSuccess', ({ roomCode, name, isHost }) => {
  console.log('Join successful:', { roomCode, name, isHost });

  // Store player info in sessionStorage
  sessionStorage.setItem('playerInfo', JSON.stringify({
    name,
    isHost,
    roomCode
  }));

  // Redirect to lobby or appropriate page
  if (isHost) {
    window.location.href = '/lobby';
  } else {
    // Check if game is in progress
    window.location.href = '/lobby'; // Will auto-redirect to /player if needed
  }
});

// Handle errors
socket.on('error', ({ message }) => {
  console.error('Socket error:', message);
  showError(message);

  // Re-enable buttons
  createGameBtn.disabled = false;
  joinGameBtn.disabled = false;
  checkRoomBtn.disabled = false;

  // Re-enable reconnect buttons if any
  const buttons = disconnectedPlayersList.querySelectorAll('.player-button');
  buttons.forEach(btn => btn.disabled = false);
});

// Utility: Validate room code format
function validateRoomCode(code) {
  return code.length === 4 && /^[a-z]+$/.test(code);
}

// Utility: Show error message
function showError(message) {
  errorDiv.textContent = message;
  errorDiv.classList.remove('hidden');

  setTimeout(() => {
    errorDiv.classList.add('hidden');
  }, 5000);
}

// Allow Enter key in create game
hostNameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    createGameBtn.click();
  }
});

// Allow Enter key in room code field
joinRoomCodeInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    checkRoomBtn.click();
  }
});

// Allow Enter key in name field
joinPlayerNameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    joinGameBtn.click();
  }
});
