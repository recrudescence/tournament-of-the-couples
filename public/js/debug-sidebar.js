// Debug Sidebar Module
// Shows raw game state data for host debugging

let debugSidebarEl = null;

/**
 * Initialize the debug sidebar if user is host
 * @param {boolean} isHost - Whether the current user is the host
 */
function initDebugSidebar(isHost) {
  if (!isHost) {
    return;
  }

  // Create sidebar element if it doesn't exist
  if (!debugSidebarEl) {
    debugSidebarEl = document.createElement('div');
    debugSidebarEl.className = 'debug-sidebar';
    debugSidebarEl.innerHTML = `
      <h3>🔧 Debug Panel</h3>
      <div id="debugContent"></div>
    `;
    document.body.appendChild(debugSidebarEl);
  }

  // Show the sidebar
  debugSidebarEl.classList.add('visible');
}

/**
 * Update the debug sidebar with current game state
 * @param {object} gameState - The current game state object
 */
function updateDebugSidebar(gameState) {
  if (!debugSidebarEl) {
    return;
  }

  const contentEl = debugSidebarEl.querySelector('#debugContent');
  if (!contentEl) {
    return;
  }

  let html = '';

  // Game Status
  html += `<div class="debug-section">`;
  html += `<h4>Game Status</h4>`;
  html += `<div class="debug-item">`;
  html += `<span class="debug-label">Room Code:</span> <span class="debug-value">${gameState.roomCode || 'N/A'}</span><br>`;
  html += `<span class="debug-label">Status:</span> <span class="debug-value">${gameState.status || 'N/A'}</span><br>`;
  html += `<span class="debug-label">Round:</span> <span class="debug-value">${gameState.currentRound?.roundNumber || 0}</span>`;
  html += `</div>`;
  html += `</div>`;

  // Host
  if (gameState.host) {
    html += `<div class="debug-section">`;
    html += `<h4>Host</h4>`;
    html += `<div class="debug-item">`;
    html += `<span class="debug-label">Name:</span> <span class="debug-value">${gameState.host.name}</span><br>`;
    html += `<span class="debug-label">Socket ID:</span> <span class="debug-value">${gameState.host.socketId?.substring(0, 8) || 'N/A'}</span>`;
    html += `</div>`;
    html += `</div>`;
  }

  // Players
  html += `<div class="debug-section">`;
  html += `<h4>Players (${gameState.players?.length || 0})</h4>`;

  if (gameState.players && gameState.players.length > 0) {
    gameState.players.forEach((player, index) => {
      const connectedClass = player.connected ? 'debug-connected' : 'debug-disconnected';
      const connectedText = player.connected ? '✓ Connected' : '✗ Disconnected';

      html += `<div class="debug-item">`;
      html += `<span class="debug-label">#${index + 1}:</span> <strong>${player.name}</strong><br>`;
      html += `<span class="debug-label">Socket:</span> ${player.socketId?.substring(0, 8) || 'N/A'}<br>`;
      html += `<span class="debug-label">Status:</span> <span class="${connectedClass}">${connectedText}</span><br>`;
      html += `<span class="debug-label">Team ID:</span> ${player.teamId || '<span class="debug-null">null</span>'}<br>`;
      html += `<span class="debug-label">Partner ID:</span> ${player.partnerId?.substring(0, 8) || '<span class="debug-null">null</span>'}`;
      html += `</div>`;
    });
  } else {
    html += `<div class="debug-item">No players</div>`;
  }
  html += `</div>`;

  // Teams
  html += `<div class="debug-section">`;
  html += `<h4>Teams (${gameState.teams?.length || 0})</h4>`;

  if (gameState.teams && gameState.teams.length > 0) {
    gameState.teams.forEach((team, index) => {
      const player1 = gameState.players?.find(p => p.socketId === team.player1Id);
      const player2 = gameState.players?.find(p => p.socketId === team.player2Id);

      html += `<div class="debug-item">`;
      html += `<span class="debug-label">Team ID:</span> ${team.teamId}<br>`;
      html += `<span class="debug-label">Player 1:</span> ${player1?.name || 'Unknown'}<br>`;
      html += `<span class="debug-label">Player 2:</span> ${player2?.name || 'Unknown'}<br>`;
      html += `<span class="debug-label">Score:</span> <span class="debug-value">${team.score || 0}</span>`;
      html += `</div>`;
    });
  } else {
    html += `<div class="debug-item">No teams</div>`;
  }
  html += `</div>`;

  // Current Round
  if (gameState.currentRound) {
    html += `<div class="debug-section">`;
    html += `<h4>Current Round</h4>`;
    html += `<div class="debug-item">`;
    html += `<span class="debug-label">Number:</span> ${gameState.currentRound.roundNumber}<br>`;
    html += `<span class="debug-label">Status:</span> ${gameState.currentRound.status || 'N/A'}<br>`;
    html += `<span class="debug-label">Question:</span> ${gameState.currentRound.question || 'N/A'}<br>`;
    html += `<span class="debug-label">Answers:</span> ${Object.keys(gameState.currentRound.answers || {}).length}/${gameState.players?.length || 0}<br>`;

    if (gameState.currentRound.submittedInCurrentPhase) {
      html += `<span class="debug-label">Submitted:</span> ${gameState.currentRound.submittedInCurrentPhase.length}`;
    }
    html += `</div>`;
    html += `</div>`;
  }

  contentEl.innerHTML = html;
}
