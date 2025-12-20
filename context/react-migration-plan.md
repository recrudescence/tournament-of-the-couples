 Here is Claude's plan:
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
 React + TypeScript Migration Plan

 Overview

 Migrate the vanilla JavaScript multi-page app to a Vite-powered React SPA with
  TypeScript. Preserve existing server-side logic, Socket.io event contracts,
 and CSS styling.

 User choices: Vite, Context API + Hooks, TypeScript

 ---
 Phase 1: Project Setup

 1.1 Install Dependencies

 npm install -D vite @vitejs/plugin-react typescript @types/react
 @types/react-dom
 npm install react-router-dom socket.io-client

 1.2 Create Configuration Files

 /vite.config.ts
 - React plugin
 - Proxy /socket.io to Express server (port 3000)
 - Build output to /dist

 /tsconfig.json
 - Target ES2020, React JSX
 - Strict mode enabled

 1.3 Create Source Directory Structure

 /src
   /components
     /common        # Header, ErrorMessage, LoadingSpinner
     /join          # CreateGameForm, JoinGameFlow, RoomCodeStep, etc.
     /lobby         # PlayersList, PlayerCard, TeamCard, HostControls
     /host          # RoundSetupPhase, AnsweringPhase, ScoringPhase,
 TeamScoringCard, Scoreboard
     /player        # WaitingSection, AnsweringSection, SubmittedSection,
 ScoringSection
   /context
     SocketContext.tsx
     GameContext.tsx
   /hooks
     useSocket.ts
     useGameState.ts
     usePlayerInfo.ts
   /types
     game.ts
     socket-events.ts
   /pages
     JoinPage.tsx
     LobbyPage.tsx
     HostPage.tsx
     PlayerPage.tsx
   /styles          # Copy existing CSS files
   App.tsx
   main.tsx
 /index.html        # Single entry point for SPA

 1.4 Update package.json Scripts

 "scripts": {
   "dev": "concurrently \"vite\" \"node --watch server/index.js\"",
   "build": "vite build",
   "start": "node server/index.js",
   "preview": "vite preview"
 }

 ---
 Phase 2: Type Definitions

 /src/types/game.ts

 Define TypeScript interfaces matching context/state.md:

 - GameStatus enum: lobby | playing | scoring | ended
 - RoundStatus enum: answering | complete
 - RoundPhase enum: initial | in_progress | completed
 - Host, Player, Team, CurrentRound, GameState interfaces
 - PlayerInfo interface for sessionStorage data

 /src/types/socket-events.ts

 Define typed socket event interfaces:

 - ClientToServerEvents: createGame, joinGame, checkRoomStatus, requestPair,
 unpair, startGame, startRound, submitAnswer, revealAnswer, awardPoint,
 nextRound, backToAnswering
 - ServerToClientEvents: gameCreated, joinSuccess, roomStatus, lobbyUpdate,
 gameStarted, roundStarted, answerSubmitted, allAnswersIn, answerRevealed,
 scoreUpdated, readyForNextRound, returnedToAnswering, playerDisconnected,
 error

 ---
 Phase 3: Context and Hooks

 /src/context/SocketContext.tsx

 - Create typed Socket.io connection on mount
 - Expose socket, isConnected via context
 - Handle connection lifecycle

 /src/context/GameContext.tsx

 - useReducer for complex state updates
 - Expose: gameState, playerInfo, roundPhase, computed values (myPlayer,
 myTeam, myPartner)
 - Actions: setGameState, updatePlayers, updateTeams, setRoundPhase

 Custom Hooks

 useSocket.ts - Typed emit() and on() wrappers
 usePlayerInfo.ts - SessionStorage read/write for player info
 useGameState.ts - Binds socket events to GameContext state updates

 ---
 Phase 4: Page Migrations (in order)

 4.1 Join Page (public/index.html + public/js/join.js)

 Components:
 - JoinPage - Main page component
 - CreateGameForm - Host name input, create game button
 - JoinGameFlow - Multi-step join flow
   - RoomCodeStep - Room code input
   - NameInputStep - Player name input
   - ReconnectStep - Disconnected player selection
 - GameCreatedSection - Room code display after creation

 Key behaviors:
 - Form state managed locally
 - Socket events trigger navigation via useNavigate()

 4.2 Lobby Page (public/lobby.html + public/js/lobby.js)

 Components:
 - LobbyPage - Main page with route guard
 - Header - Room code, host display
 - PlayersList - Maps teams and unpaired players
 - TeamCard - Paired players with unpair button
 - PlayerCard - Unpaired player with pair action
 - HostControls - Start game button (host only)

 Key behaviors:
 - lobbyUpdate event triggers re-render
 - Pairing/unpairing via socket emits

 4.3 Player Page (public/player.html + public/js/player.js)

 Components:
 - PlayerPage - Main page with route guard
 - Header - Room code, host, player name, partner, team score
 - WaitingSection - Waiting for round to start
 - AnsweringSection - Question display + answer form
 - SubmittedSection - Confirmation of submitted answer
 - ScoringSection - Waiting for host scoring

 Key behaviors:
 - Section visibility via conditional rendering (replaces showSection())
 - hasSubmitted state resets on new round

 4.4 Host Page (public/host.html + public/js/host.js) - Most Complex

 Components:
 - HostPage - Main page with route guard
 - Header - Room code, host name, round number, status
 - RoundSetupPhase - Question input form
 - AnsweringPhase - Question display, answer status, action buttons
   - AnswerStatus - Submission counter and player list
   - AllAnswersNotification
 - ScoringPhase - Team cards for scoring
   - TeamScoringCard - Per-team scoring interface
       - PlayerAnswer - Reveal button + answer display
     - ScoringActions - Award/skip buttons
 - Scoreboard - Always-visible team rankings
 - DebugSidebar - Debug state display

 Key behaviors:
 - roundPhase state drives conditional rendering (replaces showPhase())
 - createTeamCards() becomes TeamScoringCard component with props
 - Event handlers passed as callbacks to child components

 ---
 Phase 5: CSS Migration

 1. Copy CSS files to /src/styles/:
   - styles.css → global.css
   - host.css, lobby.css, player.css, debug-sidebar.css
 2. Import strategy:
   - global.css in main.tsx
   - Page-specific CSS in respective page components
 3. Remove .hidden class usage - replace with conditional rendering

 ---
 Phase 6: Server Updates

 /server/index.js (minimal changes)

 // Change static file path for production builds
 app.use(express.static(path.join(__dirname, '..', 'dist')));

 // Add SPA catch-all route (after socket handlers)
 app.get('*', (req, res) => {
   res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
 });

 No changes to:
 - Socket handlers
 - Game state logic
 - Database layer

 ---
 Phase 7: Router Setup

 /src/App.tsx

 <SocketProvider>
   <GameProvider>
     <BrowserRouter>
       <Routes>
         <Route path="/" element={<JoinPage />} />
         <Route path="/lobby" element={<LobbyPage />} />
         <Route path="/host" element={<HostPage />} />
         <Route path="/player" element={<PlayerPage />} />
       </Routes>
     </BrowserRouter>
   </GameProvider>
 </SocketProvider>

 Each protected page has a route guard that redirects to / if playerInfo is
 missing.

 ---
 Key Migration Patterns

 | Vanilla JS                           | React                            |
 |--------------------------------------|----------------------------------|
 | document.getElementById()            | Props/state in JSX               |
 | element.textContent = value          | {value} in JSX                   |
 | element.classList.add('hidden')      | Conditional rendering            |
 | showPhase(phase)                     | {phase === 'x' && <Component />} |
 | innerHTML = template literal         | JSX components                   |
 | addEventListener on dynamic elements | Callback props                   |
 | socket.on('event', handler)          | useEffect with cleanup           |
 | gameState object mutations           | Context dispatch actions         |

 ---
 Critical Files Reference

 | File                            | Purpose
   |
 |---------------------------------|-------------------------------------------
 --|
 | public/js/host.js (524 lines)   | Most complex - round management, scoring
 UI |
 | public/js/lobby.js (226 lines)  | Pairing logic, lobby state
   |
 | public/js/player.js (252 lines) | Player flow, answer submission
   |
 | public/js/join.js               | Join flow, game creation
   |
 | context/state.md                | Game state structure for types
   |
 | context/architecture.md         | Socket event contracts
   |
 | server/index.js                 | Static file serving path update
   |

 ---
 Implementation Order

 1. Foundation: Vite config, TypeScript config, type definitions
 2. Infrastructure: SocketContext, GameContext, custom hooks
 3. Entry points: main.tsx, App.tsx with router, index.html
 4. Join Page: Simplest page, validates socket connection
 5. Lobby Page: Test pairing flow
 6. Player Page: Test game flow from player perspective
 7. Host Page: Most complex, test full round lifecycle
 8. Integration: Full game flow testing, reconnection scenarios