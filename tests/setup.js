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
  createMockDb: () => {
    // Create statement mock that persists across calls
    const mockStatement = {
      run: jest.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
      get: jest.fn(),
      all: jest.fn().mockReturnValue([])
    };

    return {
      prepare: jest.fn().mockReturnValue(mockStatement),
      exec: jest.fn(),
      pragma: jest.fn(),
      transaction: jest.fn((fn) => () => fn()),
      close: jest.fn()
    };
  },

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
