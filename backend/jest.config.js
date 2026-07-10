/**
 * Jest configuration (ESM). Run with `npm test`.
 * Uses an in-memory MongoDB (mongodb-memory-server) via tests/setup.js so the
 * suite is hermetic and requires no external database.
 */
export default {
  testEnvironment: 'node',
  transform: {},
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  moduleFileExtensions: ['js', 'mjs', 'json'],
  clearMocks: true,
  verbose: true,
};
