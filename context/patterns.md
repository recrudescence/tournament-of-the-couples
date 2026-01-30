
## Common Patterns

### Adding a New Socket Event

**Server-side:**
1. Add event type to `src/types/socket-events.ts` in `ClientToServerEvents` or `ServerToClientEvents` interface
2. Add handler in `server/socketHandlers.js` within `setupSocketHandlers()`
3. Extract roomCode from socket: `const roomCode = socket.roomCode;`
4. Add guard clause: `if (!roomCode) { socket.emit('error', { message: 'Not in a room' }); return; }`
5. Update `gameState.js` if state changes are needed (all functions accept roomCode as first parameter)
6. Emit response event: `socket.emit()` for sender, `io.to(roomCode).emit()` for all in room

**Client-side (React):**
1. Types are already defined in `src/types/socket-events.ts`
2. Add `useEffect` hook in relevant page component with event listener:
   ```typescript
   useEffect(() => {
     const unsubscribe = on('eventName', (data) => {
       // Update state via dispatch or setState
       dispatch({ type: 'ACTION_TYPE', payload: data });
     });
     return unsubscribe;
   }, [on, dispatch]);
   ```
3. Use `emit()` from `useSocket` hook to send events:
   ```typescript
   const { emit } = useSocket();
   emit('eventName', { data });
   ```

### Adding a New Game Phase

**Server-side:**
1. Add status value to `gameState.status` or `currentRound.status`
2. Create transition functions in `gameState.js`
3. Add socket events in `socketHandlers.js` to trigger transitions

**Client-side (React):**
1. Update `RoundPhase` enum in `src/types/game.ts` if needed
2. Add phase state to relevant page component (e.g., `HostPage`)
3. Use conditional rendering instead of `.hidden` class:
   ```typescript
   {phase === 'newPhase' && <NewPhaseComponent />}
   ```
4. Update socket event handlers to set phase state when server broadcasts phase changes

### Component Structure

**Pages** (`src/pages/`):
- Top-level route components
- Handle socket connections and events
- Manage page-level state
- Contain route guards (redirect if no playerInfo)

**Components** (`src/components/`):
- Presentational components
- Receive data via props
- Emit events via callback props

**Hooks** (`src/hooks/`):
- `useSocket` - Typed socket emit/on operations
- `usePlayerInfo` - SessionStorage management
- `useGameState` - Game state with socket bindings

**Context** (`src/context/`):
- `SocketContext` - Socket.io connection lifecycle
- `GameContext` - Global game state with reducer

### State Management Pattern

Use Context API + useReducer for global state:

```typescript
// In GameContext
const [state, dispatch] = useReducer(gameReducer, initialState);

// In components
const { gameState, dispatch } = useGameContext();
dispatch({ type: 'SET_GAME_STATE', payload: newState });
```

Local component state for UI-only concerns:
```typescript
const [isExpanded, setIsExpanded] = useState(false);
```

### Derived State Pattern (January 2026)

Prefer deriving UI state from `gameState` over duplicating it in local state. This keeps a single source of truth and simplifies socket handlers.

**PlayerPage example** - phase is derived, not stored:
```typescript
// Derive phase from gameState (single source of truth)
const phase = derivePlayerPhase(gameState, playerInfo?.name);
const currentRound = gameState?.currentRound;
const variant = currentRound?.variant ?? 'open_ended';
const hasSubmitted = currentRound?.submittedInCurrentPhase.includes(playerInfo.name) ?? false;
const submittedAnswer = currentRound?.answers?.[playerInfo.name]?.text ?? '';

// Socket handlers just update gameState - UI reacts via derivation
on('roundStarted', ({ gameState: state }) => {
  dispatch({ type: 'SET_GAME_STATE', payload: state });
  // No need to setPhase, setVariant, etc. - derived automatically
});
```

**HostPage example** - allAnswersIn and gameStatus are derived:
```typescript
// Derived values
const playerCount = gameState?.players.length ?? 0;
const submittedCount = gameState?.currentRound?.submittedInCurrentPhase.length ?? 0;
const allAnswersIn = phase === 'answering' && playerCount > 0 && submittedCount >= playerCount;

const gameStatus = useMemo(() => {
  if (phase === 'roundSetup') return 'Setting Up';
  if (phase === 'scoring') return 'Scoring';
  if (allAnswersIn) return 'All Answers In';
  return 'Answering';
}, [phase, allAnswersIn]);
```

**What to derive vs. keep local:**
- **Derive**: Values that mirror server state (phase, submission status, round info)
- **Keep local**: Form input state, animation flags, UI-only counters (currentTeamIndex)

**GameContext actions for edge cases:**
- `SET_PLAYER_CONNECTED`: Update a player's connected status without needing the full gameState (for `playerDisconnected` events that don't include gameState)

### Testing Reconnection

Players can reconnect mid-game by name. Key areas to verify:
- Socket ID references updated in players, teams, and round answers
- Player UI restores to correct phase (answering/submitted/scoring)
- Host UI shows correct answer count and player status
- All state properly synchronized via socket events
