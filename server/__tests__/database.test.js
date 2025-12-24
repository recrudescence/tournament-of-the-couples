const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Test database path
const testDbPath = path.join(__dirname, '..', 'test-game.db');

// We need to create a custom database module for testing
// since the original module creates a database connection immediately
let db;
let database;

// Promisify database operations for testing
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

// Test database functions (mirroring database.js)
async function initializeDatabase() {
  const schemaPath = path.join(__dirname, '..', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const statement of statements) {
    await run(statement);
  }
}

async function createGame(gameId) {
  await run('INSERT INTO games (game_code) VALUES (?)', [gameId]);
}

async function endGame(gameId) {
  await run(
    'UPDATE games SET ended_at = CURRENT_TIMESTAMP WHERE game_code = ?',
    [gameId]
  );
}

async function saveRound(gameId, roundNumber, question, variant = 'open_ended', options = null) {
  const optionsJson = options ? JSON.stringify(options) : null;
  const result = await run(
    'INSERT INTO rounds (game_code, round_number, question, variant_type, variant_options_json) VALUES (?, ?, ?, ?, ?)',
    [gameId, roundNumber, question, variant, optionsJson]
  );
  return result.lastID;
}

async function saveAnswer(roundId, playerName, teamId, answerText, responseTime = -1) {
  const result = await run(
    'INSERT INTO answers (round_id, player_name, team_id, answer_text, response_time) VALUES (?, ?, ?, ?, ?)',
    [roundId, playerName, teamId, answerText, responseTime]
  );
  return result.lastID;
}

async function getGameRounds(gameId) {
  const rounds = await all(
    `SELECT * FROM rounds WHERE game_code = ? ORDER BY round_number`,
    [gameId]
  );

  for (let round of rounds) {
    if (round.variant_options_json) {
      round.variant_options = JSON.parse(round.variant_options_json);
    }
    round.answers = await all(
      `SELECT * FROM answers WHERE round_id = ?`,
      [round.round_id]
    );
  }

  return rounds;
}

describe('Database Operations', () => {
  beforeAll(() => {
    // Create test database
    db = new sqlite3.Database(testDbPath);
  });

  afterAll((done) => {
    // Close database and delete test file
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
      }
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
      done();
    });
  });

  beforeEach(async () => {
    // Initialize fresh schema before each test
    await initializeDatabase();
  });

  afterEach(async () => {
    // Clean up tables after each test
    await run('DROP TABLE IF EXISTS answers');
    await run('DROP TABLE IF EXISTS rounds');
    await run('DROP TABLE IF EXISTS games');
  });

  describe('initializeDatabase', () => {
    test('creates games table', async () => {
      const table = await get(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='games'`
      );
      expect(table).toBeDefined();
      expect(table.name).toBe('games');
    });

    test('creates rounds table', async () => {
      const table = await get(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='rounds'`
      );
      expect(table).toBeDefined();
      expect(table.name).toBe('rounds');
    });

    test('creates answers table', async () => {
      const table = await get(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='answers'`
      );
      expect(table).toBeDefined();
      expect(table.name).toBe('answers');
    });

    test('games table has correct columns', async () => {
      const columns = await all(`PRAGMA table_info(games)`);
      const columnNames = columns.map(c => c.name);

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('game_code');
      expect(columnNames).toContain('started_at');
      expect(columnNames).toContain('ended_at');
    });

    test('rounds table has correct columns', async () => {
      const columns = await all(`PRAGMA table_info(rounds)`);
      const columnNames = columns.map(c => c.name);

      expect(columnNames).toContain('round_id');
      expect(columnNames).toContain('game_code');
      expect(columnNames).toContain('round_number');
      expect(columnNames).toContain('question');
      expect(columnNames).toContain('variant_type');
      expect(columnNames).toContain('variant_options_json');
      expect(columnNames).toContain('created_at');
    });

    test('answers table has correct columns', async () => {
      const columns = await all(`PRAGMA table_info(answers)`);
      const columnNames = columns.map(c => c.name);

      expect(columnNames).toContain('answer_id');
      expect(columnNames).toContain('round_id');
      expect(columnNames).toContain('player_name');
      expect(columnNames).toContain('team_id');
      expect(columnNames).toContain('answer_text');
      expect(columnNames).toContain('response_time');
    });
  });

  describe('createGame', () => {
    test('inserts a new game', async () => {
      await createGame('test-game-123');

      const game = await get('SELECT * FROM games WHERE game_code = ?', ['test-game-123']);
      expect(game).toBeDefined();
      expect(game.game_code).toBe('test-game-123');
    });

    test('sets started_at timestamp automatically', async () => {
      await createGame('test-game-456');

      const game = await get('SELECT * FROM games WHERE game_code = ?', ['test-game-456']);
      expect(game.started_at).toBeDefined();
      expect(game.started_at).not.toBeNull();
    });

    test('ended_at is null for new game', async () => {
      await createGame('test-game-789');

      const game = await get('SELECT * FROM games WHERE game_code = ?', ['test-game-789']);
      expect(game.ended_at).toBeNull();
    });

    test('can create multiple games', async () => {
      await createGame('game-1');
      await createGame('game-2');
      await createGame('game-3');

      const games = await all('SELECT * FROM games');
      expect(games.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('endGame', () => {
    beforeEach(async () => {
      await createGame('test-game');
    });

    test('sets ended_at timestamp', async () => {
      await endGame('test-game');

      const game = await get('SELECT * FROM games WHERE game_code = ?', ['test-game']);
      expect(game.ended_at).toBeDefined();
      expect(game.ended_at).not.toBeNull();
    });

    test('ended_at is after started_at', async () => {
      await endGame('test-game');

      const game = await get('SELECT * FROM games WHERE game_code = ?', ['test-game']);
      expect(new Date(game.ended_at).getTime()).toBeGreaterThanOrEqual(
        new Date(game.started_at).getTime()
      );
    });

    test('can be called on non-existent game without error', async () => {
      await expect(endGame('nonexistent-game')).resolves.not.toThrow();
    });
  });

  describe('saveRound', () => {
    beforeEach(async () => {
      await createGame('test-game');
    });

    test('inserts a new round with open_ended variant', async () => {
      const roundId = await saveRound('test-game', 1, 'What is your favorite color?', 'open_ended', null);

      const round = await get('SELECT * FROM rounds WHERE round_id = ?', [roundId]);
      expect(round).toBeDefined();
      expect(round.game_code).toBe('test-game');
      expect(round.round_number).toBe(1);
      expect(round.question).toBe('What is your favorite color?');
      expect(round.variant_type).toBe('open_ended');
      expect(round.variant_options_json).toBeNull();
    });

    test('inserts a round with multiple_choice variant', async () => {
      const options = ['Red', 'Blue', 'Green', 'Yellow'];
      const roundId = await saveRound('test-game', 1, 'Pick a color', 'multiple_choice', options);

      const round = await get('SELECT * FROM rounds WHERE round_id = ?', [roundId]);
      expect(round.variant_type).toBe('multiple_choice');
      expect(round.variant_options_json).toBe(JSON.stringify(options));
    });

    test('inserts a round with binary variant', async () => {
      const options = ['Yes', 'No'];
      const roundId = await saveRound('test-game', 2, 'Do you agree?', 'binary', options);

      const round = await get('SELECT * FROM rounds WHERE round_id = ?', [roundId]);
      expect(round.variant_type).toBe('binary');
      expect(round.variant_options_json).toBe(JSON.stringify(options));
    });

    test('returns the round ID', async () => {
      const roundId = await saveRound('test-game', 1, 'Question 1', 'open_ended', null);

      expect(roundId).toBeDefined();
      expect(typeof roundId).toBe('number');
      expect(roundId).toBeGreaterThan(0);
    });

    test('sets created_at timestamp automatically', async () => {
      const roundId = await saveRound('test-game', 1, 'Question 1', 'open_ended', null);

      const round = await get('SELECT * FROM rounds WHERE round_id = ?', [roundId]);
      expect(round.created_at).toBeDefined();
      expect(round.created_at).not.toBeNull();
    });

    test('can save multiple rounds for same game', async () => {
      await saveRound('test-game', 1, 'Question 1', 'open_ended', null);
      await saveRound('test-game', 2, 'Question 2', 'binary', ['Yes', 'No']);
      await saveRound('test-game', 3, 'Question 3', 'multiple_choice', ['A', 'B', 'C']);

      const rounds = await all('SELECT * FROM rounds WHERE game_code = ?', ['test-game']);
      expect(rounds).toHaveLength(3);
    });

    test('defaults to open_ended variant when not specified', async () => {
      const roundId = await saveRound('test-game', 1, 'Question 1');

      const round = await get('SELECT * FROM rounds WHERE round_id = ?', [roundId]);
      expect(round.variant_type).toBe('open_ended');
    });
  });

  describe('saveAnswer', () => {
    let roundId;

    beforeEach(async () => {
      await createGame('test-game');
      roundId = await saveRound('test-game', 1, 'Test question', 'open_ended', null);
    });

    test('inserts a new answer', async () => {
      const answerId = await saveAnswer(roundId, 'Alice', 'team-123', 'Blue', 3000);

      const answer = await get('SELECT * FROM answers WHERE answer_id = ?', [answerId]);
      expect(answer).toBeDefined();
      expect(answer.round_id).toBe(roundId);
      expect(answer.player_name).toBe('Alice');
      expect(answer.team_id).toBe('team-123');
      expect(answer.answer_text).toBe('Blue');
      expect(answer.response_time).toBe(3000);
    });

    test('returns the answer ID', async () => {
      const answerId = await saveAnswer(roundId, 'Bob', 'team-456', 'Red', 2500);

      expect(answerId).toBeDefined();
      expect(typeof answerId).toBe('number');
      expect(answerId).toBeGreaterThan(0);
    });

    test('defaults response_time to -1 when not provided', async () => {
      const answerId = await saveAnswer(roundId, 'Charlie', 'team-789', 'Green');

      const answer = await get('SELECT * FROM answers WHERE answer_id = ?', [answerId]);
      expect(answer.response_time).toBe(-1);
    });

    test('can save multiple answers for same round', async () => {
      await saveAnswer(roundId, 'Alice', 'team-1', 'Answer 1', 1000);
      await saveAnswer(roundId, 'Bob', 'team-1', 'Answer 2', 2000);
      await saveAnswer(roundId, 'Charlie', 'team-2', 'Answer 3', 1500);
      await saveAnswer(roundId, 'Diana', 'team-2', 'Answer 4', 2500);

      const answers = await all('SELECT * FROM answers WHERE round_id = ?', [roundId]);
      expect(answers).toHaveLength(4);
    });

    test('can save answers for different teams', async () => {
      await saveAnswer(roundId, 'Alice', 'team-alpha', 'Answer A', 1000);
      await saveAnswer(roundId, 'Bob', 'team-beta', 'Answer B', 2000);

      const answers = await all('SELECT * FROM answers WHERE round_id = ?', [roundId]);
      expect(answers[0].team_id).toBe('team-alpha');
      expect(answers[1].team_id).toBe('team-beta');
    });
  });

  describe('getGameRounds', () => {
    beforeEach(async () => {
      await createGame('test-game');
    });

    test('returns empty array for game with no rounds', async () => {
      const rounds = await getGameRounds('test-game');
      expect(rounds).toEqual([]);
    });

    test('returns rounds with open_ended variant', async () => {
      const roundId = await saveRound('test-game', 1, 'Question 1', 'open_ended', null);
      await saveAnswer(roundId, 'Alice', 'team-1', 'Answer 1', 1000);

      const rounds = await getGameRounds('test-game');
      expect(rounds).toHaveLength(1);
      expect(rounds[0].question).toBe('Question 1');
      expect(rounds[0].variant_type).toBe('open_ended');
      expect(rounds[0].variant_options).toBeUndefined();
    });

    test('returns rounds with parsed variant_options for multiple_choice', async () => {
      const options = ['A', 'B', 'C', 'D'];
      await saveRound('test-game', 1, 'Pick one', 'multiple_choice', options);

      const rounds = await getGameRounds('test-game');
      expect(rounds[0].variant_type).toBe('multiple_choice');
      expect(rounds[0].variant_options).toEqual(options);
    });

    test('returns rounds with parsed variant_options for binary', async () => {
      const options = ['Yes', 'No'];
      await saveRound('test-game', 1, 'True or false?', 'binary', options);

      const rounds = await getGameRounds('test-game');
      expect(rounds[0].variant_type).toBe('binary');
      expect(rounds[0].variant_options).toEqual(options);
    });

    test('returns rounds with their answers', async () => {
      const roundId = await saveRound('test-game', 1, 'Question 1', 'open_ended', null);
      await saveAnswer(roundId, 'Alice', 'team-1', 'Answer 1', 1000);
      await saveAnswer(roundId, 'Bob', 'team-1', 'Answer 2', 2000);

      const rounds = await getGameRounds('test-game');
      expect(rounds[0].answers).toHaveLength(2);
      expect(rounds[0].answers[0].player_name).toBe('Alice');
      expect(rounds[0].answers[1].player_name).toBe('Bob');
    });

    test('returns multiple rounds in correct order', async () => {
      const round1 = await saveRound('test-game', 1, 'Question 1', 'open_ended', null);
      const round2 = await saveRound('test-game', 2, 'Question 2', 'binary', ['Yes', 'No']);
      const round3 = await saveRound('test-game', 3, 'Question 3', 'multiple_choice', ['A', 'B']);

      await saveAnswer(round1, 'Alice', 'team-1', 'Answer 1', 1000);
      await saveAnswer(round2, 'Bob', 'team-1', 'Yes', 1500);
      await saveAnswer(round3, 'Charlie', 'team-2', 'A', 2000);

      const rounds = await getGameRounds('test-game');
      expect(rounds).toHaveLength(3);
      expect(rounds[0].round_number).toBe(1);
      expect(rounds[1].round_number).toBe(2);
      expect(rounds[2].round_number).toBe(3);
    });

    test('each round has its own answers', async () => {
      const round1 = await saveRound('test-game', 1, 'Question 1', 'open_ended', null);
      const round2 = await saveRound('test-game', 2, 'Question 2', 'open_ended', null);

      await saveAnswer(round1, 'Alice', 'team-1', 'R1 Answer', 1000);
      await saveAnswer(round2, 'Bob', 'team-1', 'R2 Answer', 2000);

      const rounds = await getGameRounds('test-game');
      expect(rounds[0].answers).toHaveLength(1);
      expect(rounds[0].answers[0].answer_text).toBe('R1 Answer');
      expect(rounds[1].answers).toHaveLength(1);
      expect(rounds[1].answers[0].answer_text).toBe('R2 Answer');
    });

    test('returns empty array for non-existent game', async () => {
      const rounds = await getGameRounds('nonexistent-game');
      expect(rounds).toEqual([]);
    });

    test('includes all answer fields', async () => {
      const roundId = await saveRound('test-game', 1, 'Question 1', 'open_ended', null);
      await saveAnswer(roundId, 'Alice', 'team-alpha', 'My answer', 3500);

      const rounds = await getGameRounds('test-game');
      const answer = rounds[0].answers[0];

      expect(answer.answer_id).toBeDefined();
      expect(answer.round_id).toBe(roundId);
      expect(answer.player_name).toBe('Alice');
      expect(answer.team_id).toBe('team-alpha');
      expect(answer.answer_text).toBe('My answer');
      expect(answer.response_time).toBe(3500);
    });
  });

  describe('integration: complete game flow', () => {
    test('creates game, saves rounds and answers, retrieves everything', async () => {
      // Create game
      await createGame('integration-test');

      // Round 1: Open ended
      const round1 = await saveRound('integration-test', 1, 'Favorite color?', 'open_ended', null);
      await saveAnswer(round1, 'Alice', 'team-1', 'Blue', 2000);
      await saveAnswer(round1, 'Bob', 'team-1', 'Blue', 2500);
      await saveAnswer(round1, 'Charlie', 'team-2', 'Red', 1800);
      await saveAnswer(round1, 'Diana', 'team-2', 'Red', 2200);

      // Round 2: Binary
      const round2 = await saveRound('integration-test', 2, 'Love pizza?', 'binary', ['Yes', 'No']);
      await saveAnswer(round2, 'Alice', 'team-1', 'Yes', 1500);
      await saveAnswer(round2, 'Bob', 'team-1', 'Yes', 1600);
      await saveAnswer(round2, 'Charlie', 'team-2', 'No', 1400);
      await saveAnswer(round2, 'Diana', 'team-2', 'Yes', 1700);

      // Round 3: Multiple choice
      const round3 = await saveRound('integration-test', 3, 'Pick season', 'multiple_choice', ['Spring', 'Summer', 'Fall', 'Winter']);
      await saveAnswer(round3, 'Alice', 'team-1', 'Summer', 3000);
      await saveAnswer(round3, 'Bob', 'team-1', 'Summer', 3100);

      // End game
      await endGame('integration-test');

      // Retrieve and verify
      const rounds = await getGameRounds('integration-test');
      expect(rounds).toHaveLength(3);

      expect(rounds[0].variant_type).toBe('open_ended');
      expect(rounds[0].answers).toHaveLength(4);

      expect(rounds[1].variant_type).toBe('binary');
      expect(rounds[1].variant_options).toEqual(['Yes', 'No']);
      expect(rounds[1].answers).toHaveLength(4);

      expect(rounds[2].variant_type).toBe('multiple_choice');
      expect(rounds[2].variant_options).toEqual(['Spring', 'Summer', 'Fall', 'Winter']);
      expect(rounds[2].answers).toHaveLength(2);

      // Verify game is ended
      const game = await get('SELECT * FROM games WHERE game_code = ?', ['integration-test']);
      expect(game.ended_at).not.toBeNull();
    });
  });
});
