// Get player info from sessionStorage
const playerInfo = JSON.parse(sessionStorage.getItem('playerInfo') || '{}');
console.log('Found player info: ', playerInfo);

// Guard: Redirect to join page if no player info or room code exists
if (!playerInfo || !playerInfo.name || !playerInfo.roomCode) {
  console.log('No player info or room code found, redirecting to join page');
  window.location.href = '/';
}

const socket = io();

let currentPlayer = playerInfo;
let gameState = null;

// Initialize debug sidebar if host
initDebugSidebar(playerInfo.isHost);

const playersList = document.getElementById('playersList');
const startGameBtn = document.getElementById('startGameBtn');
const hostControls = document.getElementById('hostControls');
const hostMessage = document.getElementById('hostMessage');
const errorDiv = document.getElementById('error');
const statusMessage = document.getElementById('statusMessage');

// Request initial lobby state and rejoin if needed
socket.on('connect', () => {
  console.log('Connected to lobby');

  // If we have player info, rejoin the game
  if (playerInfo.name && playerInfo.roomCode) {
    console.log('Rejoining room', playerInfo.roomCode, 'as:', playerInfo.name);
    socket.emit('joinGame', {
      name: playerInfo.name,
      isHost: playerInfo.isHost || false,
      isReconnect: false,  // Use false to let server's smart logic handle it
      roomCode: playerInfo.roomCode
    });
  }
});

// Handle rejoin success
socket.on('joinSuccess', ({ roomCode, gameState: state }) => {
  console.log('Rejoined successfully to room:', roomCode);
  gameState = state;

  // Display room code
  document.getElementById('roomCodeDisplay').textContent = roomCode.toUpperCase();
  document.getElementById('hostDisplay').textContent = state.host.name;

  // Update current player reference
  if (playerInfo.name) {
    if (playerInfo.isHost && state.host && state.host.name === playerInfo.name) {
      currentPlayer = { ...state.host, isHost: true };
    } else {
      const player = state.players.find(p => p.name === playerInfo.name);
      if (player) {
        currentPlayer = { ...player, isHost: false };
      }
    }
  }

  renderLobby();
});

// Handle lobby updates
socket.on('lobbyUpdate', (state) => {
  console.log('Lobby update:', state);
  gameState = state;

  // Update current player reference from game state
  if (playerInfo.name) {
    if (playerInfo.isHost && state.host && state.host.name === playerInfo.name) {
      currentPlayer = { ...state.host, isHost: true };
    } else {
      const player = state.players.find(p => p.name === playerInfo.name);
      if (player) {
        currentPlayer = { ...player, isHost: false };
      }
    }
  }
  
  renderLobby();
});

// Handle game started
socket.on('gameStarted', (state) => {
  console.log('Game started!');
  
  if (currentPlayer && currentPlayer.isHost) {
    window.location.href = '/host';
  } else {
    window.location.href = '/player';
  }
});

// Render lobby
function renderLobby() {
  updateDebugSidebar(gameState);
  if (!gameState) return;
  
  // Update status message (only count connected players)
  const connectedPlayers = gameState.players.filter(p => p.connected);
  const playerCount = connectedPlayers.length;
  const teamCount = gameState.teams.length;
  statusMessage.textContent = `${playerCount} player${playerCount !== 1 ? 's' : ''} connected, ${teamCount} team${teamCount !== 1 ? 's' : ''} formed`;
  
  // Clear players list
  playersList.innerHTML = '';
  
  // Track which players we've already rendered (to avoid duplicates in teams)
  const renderedPlayers = new Set();
  
  // Render teams first
  gameState.teams.forEach(team => {
    const player1 = gameState.players.find(p => p.socketId === team.player1Id);
    const player2 = gameState.players.find(p => p.socketId === team.player2Id);
    
    if (!player1 || !player2) return;
    
    const teamCard = document.createElement('div');
    teamCard.className = 'player-card paired';

    const isCurrentPlayerInTeam = currentPlayer && (
        player1.name === currentPlayer.name || 
        player2.name === currentPlayer.name
    );
    
    teamCard.innerHTML = `
      <div class="player-name ${currentPlayer && player1.name === currentPlayer.name ? 'you' : ''}">
        ${player1.name}${currentPlayer && player1.name === currentPlayer.name ? ' (You)' : ''}
        ${!player1.connected ? '<span class="disconnected-label"> - Disconnected</span>' : ''}
      </div>
      <div class="partner-info">↔ ${player2.name}${player2.name === currentPlayer.name ? ' (You)' : ''}
        ${!player2.connected ? '<span class="disconnected-label"> - Disconnected</span>' : ''}
      </div>
      ${isCurrentPlayerInTeam && !currentPlayer.isHost ? '<button class="unpair-btn">Unpair</button>' : ''}
    `;
    
    // Add unpair handler
    if (isCurrentPlayerInTeam && !currentPlayer.isHost) {
      const unpairBtn = teamCard.querySelector('.unpair-btn');
      unpairBtn.onclick = () => {
        socket.emit('unpair');
      };
    }
    
    playersList.appendChild(teamCard);
    
    renderedPlayers.add(player1.socketId);
    renderedPlayers.add(player2.socketId);
  });
  
  // Render unpaired players (excluding disconnected players)
  gameState.players.forEach(player => {
    if (renderedPlayers.has(player.socketId)) return;

    // Skip disconnected players - they can't be paired with
    if (!player.connected) return;
    
    const playerCard = document.createElement('div');
    const isCurrentPlayer = currentPlayer && player.name === currentPlayer.name;
    const canPair = !isCurrentPlayer && currentPlayer && !currentPlayer.isHost && !currentPlayer.partnerId;
    
    playerCard.className = `player-card ${canPair ? 'clickable' : ''} ${!player.connected ? 'disconnected' : ''}`;
    
    playerCard.innerHTML = `
      <div class="player-name ${isCurrentPlayer ? 'you' : ''}">
        ${player.name}${isCurrentPlayer ? ' (You)' : ''}
        ${!player.connected ? '<span class="disconnected-label"> - Disconnected</span>' : ''}
      </div>
      ${canPair ? '<div class="partner-info">Click to pair</div>' : ''}
    `;
    
    // Add click handler for pairing
    if (canPair) {
      playerCard.onclick = () => {
        socket.emit('requestPair', { targetSocketId: player.socketId });
      };
    }
    
    playersList.appendChild(playerCard);
  });
  
  // Show host controls if user is host
  if (currentPlayer && currentPlayer.isHost) {
    hostControls.classList.remove('hidden');

    // Enable start button only if all CONNECTED non-host players are paired
    const connectedNonHostPlayers = gameState.players.filter(p =>
      p.name !== gameState.host?.name && p.connected
    );
    const allPaired = connectedNonHostPlayers.length > 0 &&
                      connectedNonHostPlayers.length === gameState.teams.length * 2;

    startGameBtn.disabled = !allPaired;

    if (!allPaired) {
      hostMessage.textContent = 'All connected players must be paired before starting the game.';
    } else {
      hostMessage.textContent = 'Ready to start!';
    }
  }
}

// Start game (host only)
if (startGameBtn) {
  startGameBtn.onclick = () => {
    socket.emit('startGame');
  };
}

// Handle errors
socket.on('error', ({ message }) => {
  showError(message);
});

function showError(message) {
  errorDiv.textContent = message;
  errorDiv.classList.remove('hidden');
  
  setTimeout(() => {
    errorDiv.classList.add('hidden');
  }, 5000);
}
