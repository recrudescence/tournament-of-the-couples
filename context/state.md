
## Database Schema

```sql
games (game_code, started_at, ended_at)
rounds (round_id, game_code, round_number, question, created_at)
answers (answer_id, round_id, player_name, team_id, answer_text, response_time)
```

Database is append-only logging, not used for state restoration.

**Note:** `response_time` is in milliseconds and represents how long it took the player to submit their answer from when the round started.

## Game State Structure

Understanding the in-memory game state structure is critical for working with this codebase:

**Storage:** `Map<roomCode, gameState>` in `server/gameState.js`

**Per-room game state:**
```javascript
{
  roomCode: "game",                  // room code (e.g., "game", "play")
  gameId: "game",                    // Same as roomCode, for DB compatibility
  status: "lobby" | "playing" | "scoring" | "ended",

  host: {
    socketId: "...",
    name: "...",
    connected: true | false         // Disconnection tracking (same as players)
  },

  players: [                          // Includes ALL players (may include host)
    {
      socketId: "...",                // Changes on page navigation/reconnect
      name: "...",                    // Stable identifier for reconnection
      partnerId: "..." | null,        // Socket ID of partner (if paired)
      teamId: "..." | null,           // team code (e.g., "team")
      connected: true | false         // Disconnection tracking
    }
  ],

  teams: [                            // Created when two players pair
    {
      teamId: "team",                 // team code (not UUID)
      player1Id: "socketId",          // Must update on reconnect
      player2Id: "socketId",          // Must update on reconnect
      score: 0
    }
  ],

  currentRound: {                     // null when no active round
    roundNumber: 1,
    roundId: null,                    // Database ID (set after persistence)
    question: "What's your partner's favorite color?",
    variant: "open_ended" | "multiple_choice" | "binary",
    options: ["Option 1", "Option 2"] | null,  // Array of choices for MC/binary, null for open_ended
    status: "answering" | "complete",
    answers: {                        // Map of PLAYER NAME → answer object (stable across reconnections)
      "Alice": {
        text: "Blue",
        responseTime: 3420            // Time in milliseconds from round start to submission
      },
      "Bob": {
        text: "Red",
        responseTime: 5180
      }
    },
    submittedInCurrentPhase: []       // Array of player names who submitted in THIS answering session
                                      // Cleared when returning to answering from scoring
                                      // Used to determine round completion
  }
}
```

**Key relationships:**
- `player.partnerId` ↔ other `player.socketId`
- `player.teamId` ↔ `team.teamId`
- `team.player1Id` & `team.player2Id` ↔ `player.socketId`
- `currentRound.answers[playerName]` ↔ `player.name`

**Important:** Socket ID references (`partnerId`, `player1Id`, `player2Id`) must be updated when a player reconnects. However, `currentRound.answers` is keyed by player name (not socket ID), so answers automatically persist across reconnections without migration.

**All gameState functions accept roomCode as first parameter:**
- `gameState.initializeGame(roomCode)`
- `gameState.addPlayer(roomCode, socketId, name, isHost)`
- `gameState.getGameState(roomCode)`
- `gameState.pairPlayers(roomCode, socketId1, socketId2)`
- etc.
