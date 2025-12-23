
## Architecture

### Server Structure

**Four-layer architecture:**

1. **HTTP/WebSocket Layer** (`server/index.js`)
   - Express server serving static files from `dist/` (Vite build) or `public/` (legacy)
   - Socket.io server handling real-time connections
   - REST API: `/api/games` - Lists all active (non-ended) games for the join page
   - SPA fallback route serves `index.html` for all non-API/socket paths
   - **Important**: API routes must be defined BEFORE static file serving to avoid being caught by SPA fallback

2. **Socket Event Handlers** (`server/socketHandlers.js`)
   - Central event router for all Socket.io events
   - Uses Socket.io rooms to isolate games by room code
   - All broadcasts scoped to room: `io.to(roomCode).emit()`
   - Stores `socket.roomCode` on socket object for tracking
   - Coordinates between gameState and database modules
   - Handles player join/reconnect logic, round lifecycle, scoring

3. **Room Code Generator** (`server/roomCodeGenerator.js`)
   - Generates unique room codes using `random-words` package
   - Generates team codes for team IDs
   - Tracks active rooms to prevent collisions
   - Validates room code format (text string)

4. **State Management** (`server/gameState.js`)
   - **In-memory only** - game states stored in Map: `roomCode → gameState`
   - **Multi-game support** - multiple concurrent games with different room codes
   - No state persistence beyond database logging
   - All functions accept `roomCode` as first parameter
   - Manages players, teams, rounds, and answers per room

5. **Database Layer** (`server/database.js`)
   - SQLite for game history/analytics (not for state restoration)
   - Persists games (using room code as game_code), rounds, and answers
   - Uses promisified wrappers around sqlite3 callbacks

### Client Structure

**React Single-Page Application (SPA)** with TypeScript and React Router:

**Architecture:**
- **Entry Point**: `index.html` → `src/main.tsx` → `src/App.tsx`
- **Build System**: Vite with HMR (dev) and optimized production builds
- **Routing**: React Router v7 with client-side navigation
- **State Management**: React Context API + useReducer
- **Socket Connection**: Single Socket.io instance managed via SocketContext

**Directory Structure:**
```
src/
  types/
    game.ts           # Game state types and enums
    socket-events.ts  # Typed socket event interfaces
  context/
    SocketContext.tsx # Socket.io connection lifecycle
    GameContext.tsx   # Global game state with reducer
  hooks/
    useSocket.ts      # Typed socket emit/on operations
    usePlayerInfo.ts  # SessionStorage management
    useGameError.ts   # Standardized error handling
  pages/
    JoinPage.tsx      # Routes: / and /join (with ?room=CODE support)
    GamePage.tsx      # Route: /game?room=CODE (router component)
    LobbyPage.tsx     # Rendered by GamePage when status='lobby'
    HostPage.tsx      # Rendered by GamePage when playing/scoring + isHost
    PlayerPage.tsx    # Rendered by GamePage when playing/scoring + !isHost
    FinishGamePage.tsx # Rendered by GamePage when status='ended'
  styles/
    global.css        # Base styles
    lobby.css         # Lobby-specific styles
    host.css          # Host-specific styles
    player.css        # Player-specific styles
  App.tsx             # Router setup with context providers
  main.tsx            # React root initialization
```

**Page Components:**

1. **JoinPage** (`src/pages/JoinPage.tsx`)
   - Entry point for all users (routes: `/` and `/join`)
   - **Room codes are hidden from the UI** - players never see or enter codes manually
   - Fetches available games from `/api/games` endpoint and displays as clickable list
   - Shows games as "Host's Game - Status" (e.g., "Alice's Game - In Lobby")
   - Two-path interface: "Join Existing Game" or "Create Room"
   - **Create Room**: Host enters name → server generates room code internally → navigates to game
   - **Join Existing Game**:
     - Click game from list → enter name → join game (for lobby games)
     - Click in-progress game → shows reconnect page if disconnected players exist (including host)
     - Shows name entry if no disconnected players (new player joining in-progress game)
   - **Reconnection**: Shows list of disconnected players to reconnect, with "(Host)" label for disconnected host
   - Stores player info in `sessionStorage.playerInfo` via `usePlayerInfo` hook
   - Navigates to `/game?room=CODE` on successful join

2. **GamePage** (`src/pages/GamePage.tsx`)
   - **Router component** for all game views (route: `/game?room=CODE`)
   - Validates room code format and playerInfo
   - Auto-rejoins on page refresh using sessionStorage data
   - Handles `joinSuccess` and `gameEnded` socket events
   - Conditionally renders child pages based on `gameState.status` and `playerInfo.isHost`:
     - `status='lobby'` → LobbyPage
     - `status='playing'|'scoring'` + `isHost=true` → HostPage
     - `status='playing'|'scoring'` + `isHost=false` → PlayerPage
     - `status='ended'` → FinishGamePage

3. **LobbyPage** (`src/pages/LobbyPage.tsx`)
   - Team formation interface (rendered by GamePage)
   - No route guards (GamePage handles this)
   - Shows host name in header (room codes hidden from UI)
   - Players can pair/unpair before game starts
   - Host can start game when teams are formed
   - Updates GameContext when game starts (no navigation)

4. **HostPage** (`src/pages/HostPage.tsx`)
   - Host control center (rendered by GamePage)
   - No route guards (GamePage handles this)
   - Three-phase flow: Round Setup → Answering → Scoring
   - Uses conditional rendering for phase management
   - Manages question entry, answer tracking, point awarding, return to answering phase, ending game

5. **PlayerPage** (`src/pages/PlayerPage.tsx`)
   - Player game interface (rendered by GamePage)
   - No route guards (GamePage handles this)
   - Four-section flow: Waiting → Answering → Submitted → Scoring
   - Uses conditional rendering for section management
   - Players see partner name and team score
   - Auto-advances through phases based on server events
   - Properly restores submission state on reconnection

6. **FinishGamePage** (`src/pages/FinishGamePage.tsx`)
   - Game completion interface (rendered by GamePage)
   - Shows winner with trophy/gradient card
   - Displays final standings sorted by score
   - "Return to Home" button clears session and navigates to `/`

**Key React Patterns:**
- **Route Guards**: Each page checks `playerInfo` in `useEffect`, redirects to `/` if invalid
- **Socket Management**: Single socket instance created in `SocketContext`, shared via context
- **Event Handling**: `useEffect` hooks with cleanup for socket listeners
- **State Synchronization**: Server events trigger `dispatch()` calls to update global state
- **SessionStorage**: Managed via `usePlayerInfo` hook, persists across page navigations
- **Conditional Rendering**: Replaces `.hidden` class toggling with `{condition && <Component />}`

### Data Flow

**Critical Socket.io events:**

- **Create Game**: `createGame` → `gameCreated` (with roomCode)
- **Join/Reconnect**: `joinGame` (includes roomCode) → `joinSuccess` or `error`
- **Lobby**: `requestPair`, `unpair` → `lobbyUpdate`
- **Game Start**: `startGame` → `gameStarted`
- **Round Lifecycle**: `startRound` (with variant and options) → `roundStarted` (includes gameState, variant, options) → `submitAnswer` → `answerSubmitted` → `allAnswersIn`
- **Scoring**: `revealAnswer` → `answerRevealed`, `awardPoint`/`removePoint`/`skipPoint` → `scoreUpdated`
- **Phase Transitions**: `nextRound` → `readyForNextRound`, `backToAnswering` → `returnedToAnswering`
- **Game End**: `endGame` → `gameEnded` (all clients receive final gameState)
- **Reconnection**: `playerReconnected` (notifies all clients when a player reconnects)

**State synchronization:**
- Server is source of truth
- Clients rebuild local state from server events
- Reconnection restores state via `joinSuccess` with full `gameState` and `roomCode`
- **All socket events broadcast to room only** via `io.to(roomCode).emit()`
- Games are completely isolated by Socket.io rooms

### Key Architectural Decisions

1. **Multi-Game Support**: Multiple concurrent games supported via room codes. Each game is isolated in its own Socket.io room. Games persist in memory until server restart.

2. **Room Code System**: words (e.g., "GAME", "PLAY") generated using `random-words` package. Used as game identifiers instead of UUIDs for socket.io room management. Team IDs also use codes for consistency. **Room codes are never displayed to users** - they're internal identifiers only. The join flow uses a game list fetched from `/api/games` showing "Host's Game" instead of codes.

3. **Socket ID as Player Identity**: Players are identified by `socket.id` for real-time connections (teams, partnerships), but reconnect by name. On reconnect, `gameState.reconnectPlayer(roomCode, name, newSocketId)` updates all socket ID references. **Answers are keyed by player name** to avoid migration issues on reconnect.

4. **Phase Management**: Game has distinct phases (lobby → playing → scoring) controlled by `gameState.status` and `currentRound.status`. Clients show/hide sections based on phase.

5. **Two-step Answer Reopening**:
   - When all answers are in, both "Begin Scoring" and "Re-open Answering" buttons appear
   - **"Begin Scoring" button**: Navigate to scoring view (no server state change)
   - **"Back to Answering" button** (in scoring): Host-only UI navigation back to answering view, like browser back button. Server state unchanged, players unaffected. Both buttons remain visible.
   - **"Re-open Answering" button**: Emits `backToAnswering` event to server, which calls `returnToAnswering()`. This preserves existing answers in `gameState.currentRound.answers` (for pre-filling), clears `submittedInCurrentPhase` tracking, and notifies all players to return to answering phase. Hides both buttons and notification. Players must actively submit again for the round to complete.

6. **Team References**: Teams store `player1Id` and `player2Id` (socket IDs), players store `partnerId` and `teamId`. On reconnect, both must be updated (see `gameState.reconnectPlayer()`).

7. **Disconnection vs Removal**: During gameplay, disconnected players AND the host are marked `connected: false` rather than removed, enabling seamless reconnection. The host object (`gameState.host`) has a `connected` flag just like players. When checking room status for reconnection, disconnected host is included in the reconnectable players list with `isHost: true` flag. Only in lobby phase can players be fully removed. Disconnected players shown in reconnection list are filtered to only include those in teams (`teamId` exists).

8. **Single Socket Connection in SPA**: Unlike the legacy multi-page setup, the React SPA maintains a single Socket.io connection throughout navigation. The connection is established in `SocketContext` on app mount and persists across route changes. When navigating between views (all rendered via GamePage at `/game?room=CODE`), the same socket connection is reused. GamePage calls `emit('joinGame', ...)` on mount to rejoin with stored sessionStorage data, but this does NOT create a new socket connection.

9. **Host vs Player Roles**: Host is stored separately in `gameState.host` but may also appear in the `players` array. Host does not answer questions or score points. When filtering for active players (e.g., checking if round is complete), exclude the host.

10. **RESTful URL Structure**: The app uses query parameters for room codes:
   - `/` or `/join` - Entry point (optional `?room=CODE` for pre-fill)
   - `/game?room=CODE` - All game views (lobby, playing, scoring, ended)
   - Room code in URL enables shareable links and proper page refresh handling
   - GamePage validates room code format and redirects if invalid

11. **View-Based Navigation**: Navigation between game phases (lobby → playing → ended) happens via React state changes, not route changes. GamePage stays at `/game?room=CODE` and conditionally renders different child pages based on `gameState.status`. This keeps the room code visible in the URL throughout the game lifecycle.

12. **State Initialization on Mount**: HostPage and PlayerPage initialize their UI state from GameContext when they mount. This ensures proper state restoration on page refresh or when transitioning from other views. The initialization happens via an effect that calls `updateFromGameState()` once on mount.

### Round Variants

The game supports three types of questions, each creating different answer interfaces:

**1. Open-Ended (`open_ended`)**
- Default question type
- Players type free-form text answers
- No predefined options
- Used for creative/opinion questions

**2. Multiple Choice (`multiple_choice`)**
- Host provides 2-4 answer options when starting the round
- Players select one option from a list
- Options stored in `currentRound.options` array
- Enforced at UI level - host must provide valid number of options

**3. Binary (`binary`)**
- Special case for couple-specific questions
- Automatically provides two options: "Player 1" and "Player 2"
- Players choose which partner matches the question
- Options hardcoded as `['Player 1', 'Player 2']`

**Implementation:**
- Variant and options passed in `startRound` socket event
- Stored in `currentRound.variant` and `currentRound.options`
- PlayerPage renders different input UI based on variant
- Answer text submitted is the same regardless of variant (selected option text for MC/binary)
