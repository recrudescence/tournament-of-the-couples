

**Tech Stack:** Node.js, Express, Socket.io, SQLite, vanilla HTML/CSS/JavaScript (no frontend frameworks, but eventually React.js)

## Commands

### Development
```bash
npm run dev      # Start server with auto-reload (--watch flag)
npm start        # Start production server
```

The server runs on port 3000 by default (configurable via PORT environment variable).

### Database
The SQLite database (`game.db`) is automatically initialized on server startup using the schema in `server/schema.sql`. No manual setup required.
