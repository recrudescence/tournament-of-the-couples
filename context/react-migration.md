# React Migration Notes

## Migration Overview

Successfully migrated from vanilla JavaScript multi-page app to React + TypeScript SPA.

**Date Completed:** December 2025

## What Changed

### Frontend Architecture

**Before:**
- 4 separate HTML pages with vanilla JavaScript
- Direct DOM manipulation with `getElementById()` and `innerHTML`
- Manual state synchronization between JS objects and DOM
- Page navigation via `window.location.href`
- CSS class toggling for show/hide (`.hidden`)

**After:**
- Single-page React application with TypeScript
- Component-based architecture with props and state
- Declarative UI with automatic re-rendering
- Client-side routing with React Router
- Conditional rendering (`{condition && <Component />}`)

### Build System

**Before:**
- No build step
- Static file serving from `/public`
- Manual file concatenation/minification

**After:**
- Vite build system with HMR
- TypeScript compilation
- Production optimizations (code splitting, minification)
- Development proxy for Socket.io

### State Management

**Before:**
```javascript
let gameState = {
  roundNumber: 0,
  teams: [],
  players: []
};
// Manual DOM updates
roundNumberEl.textContent = gameState.roundNumber;
```

**After:**
```typescript
const { gameState, dispatch } = useGameContext();
dispatch({ type: 'SET_GAME_STATE', payload: newState });
// Automatic re-render with new state
```

### Socket.io Integration

**Before:**
- New socket connection on each page navigation
- Socket events handled with direct DOM manipulation
- No type safety

**After:**
- Single socket instance managed via SocketContext
- Socket events handled via useEffect hooks with cleanup
- Fully typed events (ClientToServerEvents, ServerToClientEvents)

## File Mapping

| Old (Vanilla JS) | New (React) | Notes |
|-----------------|-------------|-------|
| `public/index.html` + `public/js/join.js` | `src/pages/JoinPage.tsx` | Multi-step form with state machine |
| `public/lobby.html` + `public/js/lobby.js` | `src/pages/LobbyPage.tsx` | Dynamic team rendering |
| `public/host.html` + `public/js/host.js` | `src/pages/HostPage.tsx` | Complex state with phase management |
| `public/player.html` + `public/js/player.js` | `src/pages/PlayerPage.tsx` | Section-based flow |
| N/A | `src/context/SocketContext.tsx` | New: Socket connection management |
| N/A | `src/context/GameContext.tsx` | New: Global state with reducer |
| N/A | `src/hooks/useSocket.ts` | New: Typed socket operations |
| N/A | `src/hooks/usePlayerInfo.ts` | New: SessionStorage abstraction |
| N/A | `src/types/game.ts` | New: TypeScript type definitions |
| N/A | `src/types/socket-events.ts` | New: Socket event types |

## What Stayed the Same

✅ **Server-side code** - No changes to:
- Socket handlers (`server/socketHandlers.js`)
- Game state logic (`server/gameState.js`)
- Database layer (`server/database.js`)
- Socket event names and payloads

✅ **Game logic** - All game rules and state transitions unchanged

✅ **Socket.io protocol** - Event contracts remain identical

✅ **SessionStorage** - Still used for player info persistence

## Breaking Changes

None for end users. The application works identically from a user perspective.

For developers:
- Must run `npm run build` for production
- Development now requires Vite dev server
- Old `public/js/*.js` files are legacy (keep for reference during transition)

## Development Workflow Changes

### Old Workflow
```bash
npm run dev  # Start Express server only
# Navigate to http://localhost:3000
# Manual page refresh to see changes
```

### New Workflow
```bash
npm run dev  # Start Vite + Express concurrently
# Navigate to http://localhost:5173 (Vite dev server)
# Hot Module Replacement - instant updates without refresh
```

### Production
```bash
npm run build  # Build React app to dist/
npm start      # Express serves from dist/
```

## Type Safety Benefits

All socket events are now fully typed:

```typescript
// Compile-time error if event name is wrong
emit('ivalidEvent', { data });  // ❌ TypeScript error

// Compile-time error if payload is wrong type
emit('startRound', { wrongField: 'oops' });  // ❌ TypeScript error

// IntelliSense autocomplete
emit('startRound', { question: '...' });  // ✅ Correct
```

## Performance Improvements

- **Faster development**: HMR provides instant feedback
- **Smaller bundle**: Code splitting and tree shaking
- **Better caching**: Hashed filenames for cache busting
- **Optimized rendering**: React's reconciliation vs manual DOM manipulation

## Future Improvements Enabled

The React migration enables:
- Easy component testing with React Testing Library
- Shared component library between pages
- CSS-in-JS or CSS modules for better scoping
- Animation libraries (Framer Motion, React Spring)
- State management libraries (Redux, Zustand) if needed
- Progressive Web App capabilities
