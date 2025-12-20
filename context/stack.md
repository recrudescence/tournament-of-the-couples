

**Tech Stack:**
- **Backend:** Node.js, Express 5, Socket.io, SQLite
- **Frontend:** React 19, TypeScript, Vite
- **State Management:** React Context API + useReducer
- **Routing:** React Router 7

## Commands

### Development
```bash
npm run dev          # Start Vite dev server (port 5173) + Express server (port 3000) concurrently
npm run dev:server   # Start only Express server with auto-reload
npm run build        # Build production React app to dist/
npm run preview      # Preview production build
npm start            # Start production server (serves from dist/)
```

**Development workflow:**
- Vite dev server runs on port 5173 with Hot Module Replacement (HMR)
- Vite proxies `/socket.io` requests to Express server on port 3000
- Express server runs on port 3000 by default (configurable via PORT environment variable)

### Database
The SQLite database (`game.db`) is automatically initialized on server startup using the schema in `server/schema.sql`. No manual setup required.
