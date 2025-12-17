const socket = io();

const loading = document.getElementById('loading');
const newPlayerForm = document.getElementById('newPlayerForm');
const reconnectForm = document.getElementById('reconnectForm');
const playerNameInput = document.getElementById('playerName');
const joinPlayerBtn = document.getElementById('joinPlayerBtn');
const joinHostBtn = document.getElementById('joinHostBtn');
const errorDiv = document.getElementById('error');
const reconnectList = document.getElementById('reconnectList');
const reconnectError = document.getElementById('reconnectError');

// On connection, always check game state first
socket.on('connect', () => {
  console.log('Connected to server');

  // Always get game state before deciding whether to auto-rejoin
  // This allows smart detection based on whether game is in lobby or playing
  socket.emit('getDisconnectedPlayers');
});

// Handle disconnected players response with smart auto-rejoin logic
socket.on('disconnectedPlayers', ({ players, canJoinAsNew }) => {
  loading.classList.add('hidden');

  // Check if we have stored player info
  const storedInfo = sessionStorage.getItem('playerInfo');
  const hasStoredPlayer = storedInfo !== null;

  if (canJoinAsNew) {
    // Game in lobby state: ALWAYS show join form (ignore sessionStorage)
    // This allows fresh joins and testing even with stored credentials
    console.log('Game in lobby, showing join form');
    newPlayerForm.classList.remove('hidden');
    reconnectForm.classList.add('hidden');
  } else if (hasStoredPlayer) {
    // Game in progress + we have stored credentials: AUTO-REJOIN
    try {
      const { name, isHost } = JSON.parse(storedInfo);
      console.log('Game in progress, auto-rejoining as:', name);
      socket.emit('joinGame', { name, isHost, isReconnect: true });
      // Keep loading state visible while rejoining
      loading.classList.remove('hidden');
    } catch (e) {
      console.error('Failed to parse stored player info:', e);
      sessionStorage.removeItem('playerInfo');
      // Fall back to showing reconnect form
      if (players.length > 0) {
        reconnectForm.classList.remove('hidden');
        newPlayerForm.classList.add('hidden');
        reconnectList.innerHTML = '';
        players.forEach(player => {
          const li = document.createElement('li');
          li.textContent = player.name;
          li.onclick = () => reconnectAsPlayer(player.name);
          reconnectList.appendChild(li);
        });
      } else {
        reconnectError.textContent = 'Game in progress. No available players to reconnect as.';
        reconnectError.classList.remove('hidden');
        reconnectForm.classList.remove('hidden');
      }
    }
  } else if (players.length > 0) {
    // Game in progress, no stored credentials: Show reconnect form
    console.log('Game in progress, showing reconnect options');
    reconnectForm.classList.remove('hidden');
    newPlayerForm.classList.add('hidden');

    // Populate reconnect list
    reconnectList.innerHTML = '';
    players.forEach(player => {
      const li = document.createElement('li');
      li.textContent = player.name;
      li.onclick = () => reconnectAsPlayer(player.name);
      reconnectList.appendChild(li);
    });
  } else {
    // Game in progress, no available players to reconnect as
    console.log('Game in progress, no available players');
    reconnectError.textContent = 'Game in progress. No available players to reconnect as.';
    reconnectError.classList.remove('hidden');
    reconnectForm.classList.remove('hidden');
  }
});

// Join as new player
joinPlayerBtn.onclick = () => {
  const name = playerNameInput.value.trim();
  if (!name) {
    showError('Please enter your name');
    return;
  }
  
  joinPlayerBtn.disabled = true;
  joinHostBtn.disabled = true;
  
  socket.emit('joinGame', { name, isHost: false, isReconnect: false });
};

// Join as host
joinHostBtn.onclick = () => {
  const name = playerNameInput.value.trim();
  if (!name) {
    showError('Please enter your name');
    return;
  }
  
  joinPlayerBtn.disabled = true;
  joinHostBtn.disabled = true;
  
  socket.emit('joinGame', { name, isHost: true, isReconnect: false });
};

// Reconnect as existing player
function reconnectAsPlayer(name) {
  socket.emit('joinGame', { name, isHost: false, isReconnect: true });
}

// Handle successful join
socket.on('joinSuccess', ({ isHost, reconnected, name, socketId }) => {
  console.log('Join successful', { isHost, reconnected });

  // Store player info in sessionStorage so it persists across page loads
  sessionStorage.setItem('playerInfo', JSON.stringify({
    name: name || document.getElementById('playerName').value.trim(),
    isHost: isHost
  }));

  // IMPORTANT: Everyone goes to lobby first (including host)
  // Host will only go to /host.html after clicking "Start Game" in lobby
  window.location.href = '/lobby';
});

// Handle errors
socket.on('error', ({ message }) => {
  console.error('Socket error:', message);

  // If reconnection failed, clear stored info and show join form
  if (message.includes('Player not found')) {
    console.log('Player not found in game state, clearing sessionStorage');
    sessionStorage.removeItem('playerInfo');

    // Show the join form
    loading.classList.add('hidden');
    newPlayerForm.classList.remove('hidden');
    reconnectForm.classList.add('hidden');
  }

  showError(message);
  joinPlayerBtn.disabled = false;
  joinHostBtn.disabled = false;
});

function showError(message) {
  errorDiv.textContent = message;
  errorDiv.classList.remove('hidden');
  
  setTimeout(() => {
    errorDiv.classList.add('hidden');
  }, 5000);
}

// Allow Enter key to submit
playerNameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    joinPlayerBtn.click();
  }
});
