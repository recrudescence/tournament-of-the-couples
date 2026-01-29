process.env.NODE_ENV = 'test';

module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'server/**/*.js',
    '!server/index.js',
    '!server/**/*.test.js'
  ],
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(uuid)/)'
  ],
  verbose: true
};
