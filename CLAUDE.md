# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current Architecture (December 2025)

**Frontend:** React 19 + TypeScript SPA built with Vite
- All client code is in `/src` (not `/public/js`)
- Type-safe Socket.io integration via custom hooks
- React Router for client-side navigation
- Context API + useReducer for state management

**Backend:** Node.js, Express 5, Socket.io (unchanged)
- Server code remains vanilla JavaScript
- Socket event contracts preserved

See `context/react-migration.md` for full migration details.

## Workflow

- Prioritize efficient token usage wherever possible
- Avoid excessively praising the user's decisions or ideas - be to the point, thoughtfully questioning, and critical of any design or decisions that may lead to messy or poorly architected code
- When adding new features, use React components and TypeScript (not vanilla JS)
- When modifying socket events, update type definitions in `src/types/socket-events.ts`
- When planning or thinking, check for confirmation before opening or exploring a lot of files. Avoid looking at CSS unless necessary.

## Project-specific context

Specific context around the project, gameplay, architecture, and patterns can be found in the following documents. These documents should be updated when necessary to ensure they are up to date with the current state of the code.
- context/architecture.md: a detailed look at the architecture and data flow of the game
- context/react-migration.md: React + TypeScript migration notes and file mappings
- context/gameplay.md: Tournament of the Couples gameplay
- context/patterns.md: common patterns in the code (React-focused)
- context/stack.md: tech stack notes
- context/state.md: database schema and gameplay state
- context/TODO.md: to-do items for future state, features, and plans for the project

