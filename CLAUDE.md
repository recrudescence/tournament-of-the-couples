# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current Architecture (December 2025)

**Frontend:** React 19 + TypeScript SPA built with Vite
- All client code is in `/src` (not `/public/js`)
- Type-safe Socket.io integration via custom hooks
- React Router for client-side navigation
- Context API + useReducer for state management
- **Bulma CSS framework** for styling (imported in `main.tsx`)
- **Wake Lock API** to prevent mobile screen sleep during gameplay

**Backend:** Node.js, Express 5, Socket.io (unchanged)
- Server code remains vanilla JavaScript
- Socket event contracts preserved

See `context/react-migration.md` for full migration details.

## Workflow

- Prioritize efficient token usage wherever possible
- Avoid excessively praising the user's decisions or ideas - be to the point, thoughtfully questioning, and critical of any design or decisions that may lead to messy or poorly architected code
- When adding new features, use React components and TypeScript (not vanilla JS)
- When modifying socket events, update type definitions in `src/types/socket-events.ts`
- When thinking, check in before opening or exploring a lot of files

## Common Components

- **ExitButton**: Floating red button in top-left corner (all game pages) - allows players/hosts to exit to home with confirmation
- **DebugSidebar**: Host-only debug panel for viewing game state

## Styling Conventions

**Bulma CSS Framework** (installed December 2025)
- Use Bulma utility classes for layout, typography, and UI components
- Bulma is imported in `main.tsx` before `global.css` (allows custom overrides)
- Common patterns:
  - Layout: `section`, `container`, `box`, `hero`
  - Buttons: `button`, `is-primary`, `is-large`, `is-fullwidth`, `is-loading`
  - Forms: `field`, `label`, `control`, `input`
  - Messages: `notification is-danger is-light`, `notification is-info is-light`
  - Typography: `title`, `subtitle`, `has-text-centered`, `has-text-weight-bold`
  - Spacing: `mb-3`, `mt-4`, `p-6` (margin/padding utilities)
  - Flex: `is-flex`, `is-justify-content-space-between`, `is-align-items-center`
- Custom game-specific styles remain in `global.css` for unique UI elements
- Page-specific CSS files (lobby.css, host.css, player.css) may contain overrides

**Migrated Pages:**
- JoinPage: ✅ Fully migrated to Bulma
- LobbyPage: ✅ Fully migrated to Bulma
- FinishGamePage: ✅ Fully migrated to Bulma (replaced all inline styles)
- PlayerPage: ✅ Fully migrated to Bulma (responsive columns, answer forms)
- HostPage: ✅ Fully migrated to Bulma (tabs, forms, team cards, scoreboard)

## Important Configuration Notes

- **Vite Dev Server Proxy**: The Vite dev server proxies `/api/*` and `/socket.io/*` requests to the backend at `http://localhost:3000`. If you add new API endpoints, ensure they're defined in `server/index.js` BEFORE the static file serving middleware, or they'll be caught by the SPA fallback route.
- **Room Code Visibility**: Room codes exist internally for socket.io room management but are completely hidden from the user-facing UI. The join flow uses a game list instead of manual code entry.

## Project-specific context

Specific context around the project, gameplay, architecture, and patterns can be found in the following documents. These documents should be updated when necessary to ensure they are up to date with the current state of the code.
- context/architecture.md: a detailed look at the architecture and data flow of the game
- context/react-migration.md: React + TypeScript migration notes and file mappings
- context/gameplay.md: Tournament of the Couples gameplay
- context/patterns.md: common patterns in the code (React-focused)
- context/stack.md: tech stack notes
- context/state.md: database schema and gameplay state
- context/TODO.md: to-do items for future state, features, and plans for the project

