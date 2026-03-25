/**
 * Jest Configuration for Gym Manager Pro
 *
 * Tests both Electron main process and React renderer
 */

module.exports = {
  // Test environment
  testEnvironment: 'node', // Default for main process tests

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Coverage configuration - only measure files that have tests
  collectCoverageFrom: [
    'src/main/**/*.js',
    '!src/main/**/*.test.js',
    '!src/main/main.js',
    '!**/node_modules/**'
  ],

  // Coverage thresholds - realistic for current test coverage
  coverageThreshold: {
    global: {
      branches: 10,
      functions: 15,
      lines: 15,
      statements: 15
    }
  },

  // Transform files
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest'
  },

  // Module name mapper (for CSS, images, etc.)
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/tests/__mocks__/fileMock.js',
    '^@/(.*)$': '<rootDir>/src/$1'
  },

  // Test match patterns
  testMatch: [
    '**/__tests__/**/*.(test|spec).js',
    '**/?(*.)+(spec|test).js'
  ],

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/release/',
    '/build/'
  ],

  // Projects for multi-environment testing
  projects: [
    {
      displayName: 'main',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/main/**/*.test.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup-main.js']
    },
    {
      displayName: 'renderer',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/src/renderer/**/*.test.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup-renderer.js']
    }
  ],

  // Module file extensions
  moduleFileExtensions: ['js', 'jsx', 'json', 'node'],

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks between tests
  restoreMocks: true,

  // Reset mocks between tests
  resetMocks: true
};
