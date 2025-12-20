
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
    useGameState.ts   # Socket event bindings
  pages/
    JoinPage.tsx      # Route: /
    LobbyPage.tsx     # Route: /lobby
    HostPage.tsx      # Route: /host
    PlayerPage.tsx    # Route: /player
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
   - Entry point for all users (route: `/`)
   - Two-path interface: "Create Game" or "Join Game"
   - **Create Game**: Host enters name, gets 4-letter room code (e.g., "GAME")
   - **Join Game**: Player enters room code + name to join existing game
   - Stores player info in `sessionStorage.playerInfo` via `usePlayerInfo` hook
   - Navigates to `/lobby` on successful join

2. **LobbyPage** (`src/pages/LobbyPage.tsx`)
   - Team formation interface (route: `/lobby`)
   - Route guard: redirects to `/` if no playerInfo
   - **Displays room code prominently** in header for sharing
   - Players can pair/unpair before game starts
   - Host can start game when teams are formed
   - Navigates to `/host` or `/player` on game start

3. **HostPage** (`src/pages/HostPage.tsx`)
   - Host control center (route: `/host`)
   - Route guard: redirects to `/` if not host
   - Three-phase flow: Round Setup → Answering → Scoring
   - Uses conditional rendering for phase management
   - **Displays room code in header**
   - Manages question entry, answer tracking, and point awarding
   - Can return to answering phase via "Back to Answering" button

4. **PlayerPage** (`src/pages/PlayerPage.tsx`)
   - Player game interface (route: `/player`)
   - Route guard: redirects to `/` if host or no playerInfo
   - Four-section flow: Waiting → Answering → Submitted → Scoring
   - Uses conditional rendering for section management
   - **Displays room code in header**
   - Players see partner name and team score
   - Auto-advances through phases based on server events

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

8. **Single Socket Connection in SPA**: Unlike the legacy multi-page setup, the React SPA maintains a single Socket.io connection throughout navigation. The connection is established in `SocketContext` on app mount and persists across route changes. When navigating between pages (/, /lobby, /host, /player), the same socket connection is reused. Pages call `emit('joinGame', ...)` on mount to rejoin with stored sessionStorage data, but this does NOT create a new socket connection.

9. **Host vs Player Roles**: Host is stored separately in `gameState.host` but may also appear in the `players` array. Host does not answer questions or score points. When filtering for active players (e.g., checking if round is complete), exclude the host.
