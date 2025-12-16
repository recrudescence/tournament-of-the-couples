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

// On connection, check game state
socket.on('connect', () => {
  console.log('Connected to server');
  socket.emit('getDisconnectedPlayers');
});

// Handle disconnected players response
socket.on('disconnectedPlayers', ({ players, canJoinAsNew }) => {
  loading.classList.add('hidden');
  
  if (canJoinAsNew) {
    // Show new player form (lobby state)
    newPlayerForm.classList.remove('hidden');
    reconnectForm.classList.add('hidden');
  } else if (players.length > 0) {
    // Show reconnect form (game in progress with disconnected players)
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
    // Game in progress, no disconnected players
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
  
  if (isHost) {
    window.location.href = '/host';
  } else {
    window.location.href = '/lobby';
  }
});

// Handle errors
socket.on('error', ({ message }) => {
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
