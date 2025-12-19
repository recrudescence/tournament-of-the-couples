
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
