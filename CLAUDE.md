# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tournament of the Couples is a real-time multiplayer party game where pairs of players (teams) answer questions about each other. A host manages the game flow, asks questions, and awards points based on how well partners' answers match.

**Gameplay Flow:**
1. Players join and form pairs (teams) in the lobby
2. Host asks questions (e.g., "What's your partner's favorite movie?")
3. Each player answers independently without seeing their partner's answer
4. Host reveals both partners' answers one team at a time
5. Host decides if answers match well enough to award a point
6. Process repeats for multiple rounds until host ends the game

**Tech Stack:** Node.js, Express, Socket.io, SQLite, vanilla HTML/CSS/JavaScript (no frontend frameworks)

## Commands

### Development
```bash
npm run dev      # Start server with auto-reload (--watch flag)
npm start        # Start production server
```

The server runs on port 3000 by default (configurable via PORT environment variable).

### Database
The SQLite database (`game.db`) is automatically initialized on server startup using the schema in `server/schema.sql`. No manual setup required.

## Architecture

### Server Structure

**Four-layer architecture:**

1. **HTTP/WebSocket Layer** (`server/index.js`)
   - Express server serving static files from `public/`
   - Socket.io server handling real-time connections
   - Routes: `/` (join), `/lobby`, `/host`, `/player`

2. **Socket Event Handlers** (`server/socketHandlers.js`)
   - Central event router for all Socket.io events
   - Uses Socket.io rooms to isolate games by room code
   - All broadcasts scoped to room: `io.to(roomCode).emit()`
   - Stores `socket.roomCode` on socket object for tracking
   - Coordinates between gameState and database modules
   - Handles player join/reconnect logic, round lifecycle, scoring

3. **Room Code Generator** (`server/roomCodeGenerator.js`)
   - Generates unique 4-letter room codes using `random-words` package
   - Generates 4-letter team codes for team IDs
   - Tracks active rooms to prevent collisions
   - Validates room code format (4 lowercase letters)

4. **State Management** (`server/gameState.js`)
   - **In-memory only** - game states stored in Map: `roomCode → gameState`
   - **Multi-game support** - multiple concurrent games with different room codes
   - No state persistence beyond database logging
   - All functions accept `roomCode` as first parameter
   - Manages players, teams, rounds, and answers per room

5. **Database Layer** (`server/database.js`)
   - SQLite for game history/analytics (not for state restoration)
   - Persists games (using room code as game_id), rounds, and answers
   - Uses promisified wrappers around sqlite3 callbacks

### Client Structure

**Three separate client apps** sharing the Socket.io connection pattern:

1. **Join Flow** (`public/index.html`, `public/js/join.js`)
   - Entry point for all users
   - Two-path interface: "Create Game" or "Join Game"
   - **Create Game**: Host enters name, gets 4-letter room code (e.g., "GAME")
   - **Join Game**: Player enters room code + name to join existing game
   - Stores player info in `sessionStorage.playerInfo` as `{name: "...", isHost: true|false, roomCode: "..."}`
   - This sessionStorage data persists across page navigations within the same tab

2. **Lobby** (`public/lobby.html`, `public/js/lobby.js`)
   - Team formation interface
   - **Displays room code prominently** in header for sharing
   - Players can pair/unpair before game starts
   - Host can start game when teams are formed

3. **Host UI** (`public/host.html`, `public/js/host.js`)
   - Three-phase flow: Round Setup → Answering → Scoring
   - **Displays room code in header**
   - Manages question entry, answer tracking, and point awarding
   - Can return to answering phase via "Back to Answering" button

4. **Player UI** (`public/player.html`, `public/js/player.js`)
   - Four-section flow: Waiting → Answering → Submitted → Scoring
   - **Displays room code in header**
   - Players see partner name and team score
   - Auto-advances through phases based on server events

### Data Flow

**Critical Socket.io events:**

- **Create Game**: `createGame` → `gameCreated` (with roomCode)
- **Join/Reconnect**: `joinGame` (includes roomCode) → `joinSuccess` or `error`
- **Lobby**: `requestPair`, `unpair` → `lobbyUpdate`
- **Game Start**: `startGame` → `gameStarted`
- **Round Lifecycle**: `startRound` → `roundStarted` → `submitAnswer` → `answerSubmitted` → `allAnswersIn`
- **Scoring**: `revealAnswer` → `answerRevealed`, `awardPoint` → `scoreUpdated`
- **Phase Transitions**: `nextRound` → `readyForNextRound`, `backToAnswering` → `returnedToAnswering`

**State synchronization:**
- Server is source of truth
- Clients rebuild local state from server events
- Reconnection restores state via `joinSuccess` with full `gameState` and `roomCode`
- **All socket events broadcast to room only** via `io.to(roomCode).emit()`
- Games are completely isolated by Socket.io rooms

### Key Architectural Decisions

1. **Multi-Game Support**: Multiple concurrent games supported via room codes. Each game is isolated in its own Socket.io room. Games persist in memory until server restart.

2. **Room Code System**: 4-letter words (e.g., "GAME", "PLAY") generated using `random-words` package. Used as game identifiers instead of UUIDs. Team IDs also use 4-letter codes for consistency.

3. **Socket ID as Player Identity**: Players are identified by `socket.id` for real-time connections (teams, partnerships), but reconnect by name. On reconnect, `gameState.reconnectPlayer(roomCode, name, newSocketId)` updates all socket ID references. **Answers are keyed by player name** to avoid migration issues on reconnect.

4. **Phase Management**: Game has distinct phases (lobby → playing → scoring) controlled by `gameState.status` and `currentRound.status`. Clients show/hide sections based on phase.

5. **Two-step Answer Reopening**:
   - When all answers are in, both "Begin Scoring" and "Re-open Answering" buttons appear
   - **"Begin Scoring" button**: Navigate to scoring view (no server state change)
   - **"Back to Answering" button** (in scoring): Host-only UI navigation back to answering view, like browser back button. Server state unchanged, players unaffected. Both buttons remain visible.
   - **"Re-open Answering" button**: Emits `backToAnswering` event to server, which calls `returnToAnswering()`. This preserves existing answers in `gameState.currentRound.answers` (for pre-filling), clears `submittedInCurrentPhase` tracking, and notifies all players to return to answering phase. Hides both buttons and notification. Players must actively submit again for the round to complete.

6. **Team References**: Teams store `player1Id` and `player2Id` (socket IDs), players store `partnerId` and `teamId`. On reconnect, both must be updated (see `gameState.reconnectPlayer()`).

7. **Disconnection vs Removal**: During gameplay, disconnected players are marked `connected: false` rather than removed, enabling seamless reconnection. Only in lobby phase can players be fully removed.

8. **Page Navigation = New Socket Connection**: Each page transition (join → lobby → host/player) creates a new socket connection with a new socket ID. The client automatically re-joins with stored name and roomCode from sessionStorage, and server updates all references to the new socket ID. This is by design, not a bug.

9. **Host vs Player Roles**: Host is stored separately in `gameState.host` but may also appear in the `players` array. Host does not answer questions or score points. When filtering for active players (e.g., checking if round is complete), exclude the host.

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

## Database Schema

```sql
games (game_id, started_at, ended_at)
rounds (round_id, game_id, round_number, question, created_at)
answers (answer_id, round_id, player_name, team_id, answer_text)
```

Database is append-only logging, not used for state restoration.

## Game State Structure

Understanding the in-memory game state structure is critical for working with this codebase:

**Storage:** `Map<roomCode, gameState>` in `server/gameState.js`

**Per-room game state:**
```javascript
{
  roomCode: "game",                  // 4-letter room code (e.g., "game", "play")
  gameId: "game",                    // Same as roomCode, for DB compatibility
  status: "lobby" | "playing" | "scoring" | "ended",

  host: {
    socketId: "...",
    name: "..."
  },

  players: [                          // Includes ALL players (may include host)
    {
      socketId: "...",                // Changes on page navigation/reconnect
      name: "...",                    // Stable identifier for reconnection
      partnerId: "..." | null,        // Socket ID of partner (if paired)
      teamId: "..." | null,           // 4-letter team code (e.g., "team")
      connected: true | false         // Disconnection tracking
    }
  ],

  teams: [                            // Created when two players pair
    {
      teamId: "team",                 // 4-letter team code (not UUID)
      player1Id: "socketId",          // Must update on reconnect
      player2Id: "socketId",          // Must update on reconnect
      score: 0
    }
  ],

  currentRound: {                     // null when no active round
    roundNumber: 1,
    roundId: null,                    // Database ID (set after persistence)
    question: "What's your partner's favorite color?",
    status: "answering" | "complete",
    answers: {                        // Map of PLAYER NAME → answer text (stable across reconnections)
      "Alice": "Blue",
      "Bob": "Red"
    },
    submittedInCurrentPhase: []       // Array of player names who submitted in THIS answering session
                                      // Cleared when returning to answering from scoring
                                      // Used to determine round completion
  }
}
```

**Key relationships:**
- `player.partnerId` ↔ other `player.socketId`
- `player.teamId` ↔ `team.teamId`
- `team.player1Id` & `team.player2Id` ↔ `player.socketId`
- `currentRound.answers[playerName]` ↔ `player.name`

**Important:** Socket ID references (`partnerId`, `player1Id`, `player2Id`) must be updated when a player reconnects. However, `currentRound.answers` is keyed by player name (not socket ID), so answers automatically persist across reconnections without migration.

**All gameState functions accept roomCode as first parameter:**
- `gameState.initializeGame(roomCode)`
- `gameState.addPlayer(roomCode, socketId, name, isHost)`
- `gameState.getGameState(roomCode)`
- `gameState.pairPlayers(roomCode, socketId1, socketId2)`
- etc.
