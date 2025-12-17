const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create database connection
const dbPath = path.join(__dirname, '..', 'game.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
  }
});

// Promisify database operations
const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Initialize database schema
async function initializeDatabase() {
  try {
    const fs = require('fs');
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Split schema by semicolons and execute each statement
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    for (const statement of statements) {
      await run(statement);
    }
    
    console.log('Database tables initialized');
  } catch (err) {
    console.error('Error initializing database:', err.message);
    throw err;
  }
}

// Create a new game
async function createGame(gameId) {
  try {
    await run('INSERT INTO games (game_id) VALUES (?)', [gameId]);
    console.log(`Game created: ${gameId}`);
  } catch (err) {
    console.error('Error creating game:', err.message);
    throw err;
  }
}

// End a game
async function endGame(gameId) {
  try {
    await run(
      'UPDATE games SET ended_at = CURRENT_TIMESTAMP WHERE game_id = ?',
      [gameId]
    );
    console.log(`Game ended: ${gameId}`);
  } catch (err) {
    console.error('Error ending game:', err.message);
    throw err;
  }
}

// Save a round
async function saveRound(gameId, roundNumber, question) {
  try {
    const result = await run(
      'INSERT INTO rounds (game_id, round_number, question) VALUES (?, ?, ?)',
      [gameId, roundNumber, question]
    );
    console.log(`Round saved: ${result.lastID}`);
    return result.lastID;
  } catch (err) {
    console.error('Error saving round:', err.message);
    throw err;
  }
}

// Save an answer
async function saveAnswer(roundId, playerName, teamId, answerText) {
  try {
    const result = await run(
      'INSERT INTO answers (round_id, player_name, team_id, answer_text) VALUES (?, ?, ?, ?)',
      [roundId, playerName, teamId, answerText]
    );
    console.log(`Answer saved: ${result.lastID}`);
    return result.lastID;
  } catch (err) {
    console.error('Error saving answer:', err.message);
    throw err;
  }
}

// Get all rounds and answers for a game
async function getGameRounds(gameId) {
  try {
    const rounds = await all(
      `SELECT * FROM rounds WHERE game_id = ? ORDER BY round_number`,
      [gameId]
    );

    // For each round, get its answers
    for (let round of rounds) {
      round.answers = await all(
        `SELECT * FROM answers WHERE round_id = ?`,
        [round.round_id]
      );
    }

    return rounds;
  } catch (err) {
    console.error('Error getting game rounds:', err.message);
    throw err;
  }
}

module.exports = {
  init: initializeDatabase,
  createGame,
  endGame,
  saveRound,
  saveAnswer,
  getGameRounds
};
