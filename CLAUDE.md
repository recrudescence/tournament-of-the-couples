# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current Architecture (January 2026)

**Frontend:** React 19 + TypeScript SPA built with Vite
- All client code is in `/src` (not `/public/js`)
- Type-safe Socket.io integration via custom hooks
- React Router for client-side navigation
- Context API + useReducer for state management
- **Derived state pattern**: UI state derived from `gameState` where possible (not duplicated)
- **Bulma CSS framework** for styling (imported in `main.tsx`)
- **Framer Motion** for animations (3D transforms, spring physics, enter/exit transitions)
- **Wake Lock API** to prevent mobile screen sleep during gameplay

**Backend:** Node.js, Express 5, Socket.io (unchanged)
- Server code remains vanilla JavaScript
- Socket event contracts preserved

## Workflow

- Prioritize efficient token usage wherever possible
- Avoid excessively praising the user's decisions or ideas - be to the point, thoughtfully questioning, and critical of any design or decisions that may lead to messy or poorly architected code
- When adding new features, use React components and TypeScript (not vanilla JS)
- When modifying socket events, update type definitions in `src/types/socket-events.ts`
- To ensure frugality with token usage: when thinking, check in before opening or exploring a lot of files

## Component Organization

**Component Structure** (December 2025 - Post Component Decomposition)
- `/src/components/common/` - Shared components used across multiple pages
  - **ExitButton**: Floating red button in top-left corner (all game pages) - allows players/hosts to exit to home with confirmation
  - **PlayerAvatar**: Reusable avatar component displaying player's color + emoji. Supports three sizes (small/medium/large), optional bump animation, and click-to-randomize for the current player.
  - **PlayerCard**: Unpaired player display with avatar, click-to-pair interaction, and host kick functionality. Players can tap their own avatar to randomize it.
  - **TeamCard**: Paired team display showing two player mini-cards side-by-side with avatars, break-up/kick actions. Avatar tap-to-randomize supported.
  - **PlaceBadge**: Animated 1st/2nd/3rd place badges with gold/silver/bronze styling. Features floating, shimmer, and vibrate effects. Used in TeamScoreboard, PlayerHeader, and FinishGamePage.

- `/src/components/host/` - Host-specific components (used by HostPage)
  - **HostHeader**: Round number, game status, host info display
  - **QuestionForm**: Question input with variant selection (open_ended, multiple_choice, binary)
  - **AnsweringPhase**: Answer submission status display with player avatars during answering phase. Shows notification and buttons when `allAnswersIn` is true.
  - **ScoringInterface**: Team-by-team answer review and scoring interface with player avatars
  - **ScoringModal**: Animated modal for scoring individual teams with 3D entrance/exit
  - **FlipCard**: Reusable 3D flip card component for revealing answers
  - **SinglePlayerScoring** / **BothPlayersScoring**: Answer display variants inside ScoringModal
  - **TeamScoreboard**: Team list with scores and player avatars
  - **RoundControls**: End game button

- `/src/components/player/` - Player-specific components (used by PlayerPage)
  - **PlayerHeader**: Host, player, partner, team score display
  - **WaitingStatus**: Waiting for round screen
  - **AnswerSubmissionForm**: Question display, timer, and variant-specific input forms
  - **SubmittedStatus**: Submitted answer display with partner status
  - **ScoringStatus**: Scoring in progress message

**Custom Hooks:**
- `/src/hooks/useSocket.ts` - Type-safe Socket.io integration
- `/src/hooks/usePlayerInfo.ts` - SessionStorage-based player info management
- `/src/hooks/useGameError.ts` - Auto-dismissing error notifications
- `/src/hooks/useTimer.ts` - Response time tracking for player answers
- `/src/hooks/useWakeLock.ts` - Prevent mobile screen sleep during gameplay
- `/src/hooks/usePrevious.ts` - Track previous value of a variable (used for avatar change detection)

**Page Components:**
- All major pages (HostPage, PlayerPage, LobbyPage) are kept under 400 lines
- Pages coordinate components and manage socket event subscriptions
- Business logic is delegated to custom hooks and components
- **Derived state pattern**: PlayerPage and HostPage derive UI phase/status from `gameState` rather than duplicating state. Socket handlers primarily dispatch state updates; UI reacts to derived values.

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

## Animation Conventions

**Framer Motion** (installed January 2026)
- All animation definitions are centralized in `/src/styles/motion.ts`
- Use named variants and shared transitions instead of inline animation props

**Shared Transitions (spring configs):**
- `springDefault` - stiffness: 300, damping: 25 (most common)
- `springBouncy` - stiffness: 400, damping: 15 (badges, emojis)
- `springStiff` - stiffness: 400, damping: 20 (buttons)
- `springGentle` - stiffness: 200, damping: 20 (cards)

**Shared Variants (named animation states):**
- `fadeIn`, `slideInLeft`, `slideInRight`, `slideInUp`, `slideInUpDeep`
- `flipInLeft`, `flipInRight` - 3D card flip entrances
- `cardEntrance`, `scalePop`, `emojiSpin`, `popInSpin`
- `modalBackdrop`, `flipCard`
- `badgeEntrance` - scale up with rotation for place badges

**Badge Animations (continuous):**
- `badgeFloat` / `badgeFloatTransition` - subtle y bob
- `badgeShimmer` / `badgeShimmerTransition(fast)` - metallic shine sweep
- `badgeVibrate` / `badgeVibrateTransition` - gold badge excitement
- `badgeShadowKeyframes(color)` - pulsing shadow for float effect

**Interaction Presets (hover/tap):**
- `buttonHover`/`buttonTap` - subtle scale (1.05/0.95)
- `liftHover`/`liftTap` - scale + y offset + shadow
- `cardHover`/`cardTap` - 3D tilt effect
- `nervousHover` - shake animation for destructive buttons

**Helper Functions:**
- `staggerDelay(index, base, increment)` - calculate staggered delays

**Usage Pattern:**
```tsx
import { slideInLeft, springDefault, staggerDelay, buttonHover, buttonTap } from '../../styles/motion';

<motion.div
  variants={slideInLeft}
  initial="hidden"
  animate="visible"
  transition={{ ...springDefault, delay: staggerDelay(index) }}
  whileHover={buttonHover}
  whileTap={buttonTap}
>
```

**Animated Components:**
- `TeamCard` - 3D flip entrance, card hover effects
- `ScoringModal` - 3D modal entrance/exit with AnimatePresence
- `FlipCard` - Reusable 3D card flip for answer reveals
- `PlaceBadge` - Animated gold/silver/bronze badges with float, shimmer, and vibrate effects
- `SinglePlayerScoring` / `BothPlayersScoring` - Staggered slide-in animations

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

