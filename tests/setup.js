/**
 * Global test setup
 * Runs before all tests
 */

// Suppress console errors during tests (optional)
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn()
};

// Set test timeout
jest.setTimeout(10000);

// Global test utilities
global.testUtils = {
  // Helper to create mock database
  createMockDb: () => ({
    prepare: jest.fn(() => ({
      run: jest.fn(),
      get: jest.fn(),
      all: jest.fn()
    })),
    exec: jest.fn(),
    pragma: jest.fn(),
    transaction: jest.fn((fn) => fn)
  }),

  // Helper to create mock credentials
  createMockCredentials: () => ({
    supabase: {
      url: 'https://test.supabase.co',
      key: 'test_key'
    },
    google: {
      clientId: 'test_client_id',
      clientSecret: 'test_client_secret',
      projectId: 'test_project'
    },
    github: {
      token: 'test_token'
    }
  })
};
