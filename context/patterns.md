
## Common Patterns

### Adding a New Socket Event

1. Add handler in `server/socketHandlers.js` within `setupSocketHandlers()`
2. Extract roomCode from socket: `const roomCode = socket.roomCode;`
3. Add guard clause: `if (!roomCode) { socket.emit('error', { message: 'Not in a room' }); return; }`
4. Update `gameState.js` if state changes are needed (all functions accept roomCode as first parameter)
5. Emit response event: `socket.emit()` for sender, `io.to(roomCode).emit()` for all in room
6. Add listener in relevant client JS file(s)
7. Update UI based on event data

### Adding a New Game Phase

1. Add status value to `gameState.status` or `currentRound.status`
2. Create transition functions in `gameState.js`
3. Add socket events in `socketHandlers.js` to trigger transitions
4. Update client phase detection in `joinSuccess` handlers
5. Add new section to HTML and `showPhase()`/`showSection()` functions

### Testing Reconnection

Players can reconnect mid-game by name. Key areas to verify:
- Socket ID references updated in players, teams, and round answers
- Player UI restores to correct phase (answering/submitted/scoring)
- Host UI shows correct answer count and player status
