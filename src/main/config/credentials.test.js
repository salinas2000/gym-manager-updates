/**
 * Tests for Credential Manager
 * Critical security component - comprehensive testing required
 */

const credentialManager = require('./credentials');

describe('Credential Manager', () => {
  beforeEach(() => {
    // Reset singleton state
    credentialManager.credentials = null;

    // Clear all environment variables
    delete process.env.GYM_SUPABASE_URL;
    delete process.env.GYM_SUPABASE_KEY;
    delete process.env.GYM_GOOGLE_CLIENT_ID;
    delete process.env.GYM_GOOGLE_CLIENT_SECRET;
    delete process.env.GYM_GOOGLE_PROJECT_ID;
    delete process.env.GYM_GITHUB_TOKEN;

    jest.clearAllMocks();
  });

  afterEach(() => {
    // Cleanup after each test
    credentialManager.credentials = null;

    // Clear environment variables
    delete process.env.GYM_SUPABASE_URL;
    delete process.env.GYM_SUPABASE_KEY;
    delete process.env.GYM_GOOGLE_CLIENT_ID;
    delete process.env.GYM_GOOGLE_CLIENT_SECRET;
    delete process.env.GYM_GOOGLE_PROJECT_ID;
    delete process.env.GYM_GITHUB_TOKEN;
  });

  describe('init()', () => {
    test('should load from system environment variables (Priority 1)', () => {
      // Setup: Mock system env vars
      process.env.GYM_SUPABASE_URL = 'https://test.supabase.co';
      process.env.GYM_SUPABASE_KEY = 'test_key';

      const result = credentialManager.init();

      expect(result).toBe(true);
      expect(credentialManager.isLoaded()).toBe(true);

      const creds = credentialManager.get();
      expect(creds.supabase.url).toBe('https://test.supabase.co');
      expect(creds.supabase.key).toBe('test_key');

      // Cleanup
      delete process.env.GYM_SUPABASE_URL;
      delete process.env.GYM_SUPABASE_KEY;
    });

    test('should fallback to .env.local file (Priority 2)', () => {
      // Ensure no env vars are set (so it falls back to file)
      delete process.env.GYM_SUPABASE_URL;
      delete process.env.GYM_SUPABASE_KEY;

      // Setup: Mock file system
      const fs = require('fs');
      fs.existsSync.mockReturnValueOnce(true);
      fs.readFileSync.mockReturnValueOnce(`
SUPABASE_URL=https://local.supabase.co
SUPABASE_KEY=local_key
      `);

      const result = credentialManager.init();

      expect(result).toBe(true);
      const creds = credentialManager.get();
      expect(creds.supabase.url).toBe('https://local.supabase.co');
      expect(creds.supabase.key).toBe('local_key');
    });

    test('should fallback to electron-store (Priority 3)', () => {
      // Ensure no env vars or file
      delete process.env.GYM_SUPABASE_URL;
      delete process.env.GYM_SUPABASE_KEY;

      const fs = require('fs');
      fs.existsSync.mockReturnValueOnce(false);

      // Setup: Mock electron-store
      const Store = require('electron-store');
      const mockStore = {
        get: jest.fn(() => global.testUtils.createMockCredentials())
      };
      Store.mockImplementationOnce(() => mockStore);

      const result = credentialManager.init();

      expect(result).toBe(true);
      expect(mockStore.get).toHaveBeenCalledWith('credentials');
    });

    test('should return false if no credentials found', () => {
      // Ensure no credentials anywhere
      delete process.env.GYM_SUPABASE_URL;
      delete process.env.GYM_SUPABASE_KEY;

      const fs = require('fs');
      fs.existsSync.mockReturnValueOnce(false);

      const Store = require('electron-store');
      Store.mockImplementationOnce(() => ({
        get: jest.fn(() => null)
      }));

      const result = credentialManager.init();

      expect(result).toBe(false);
      expect(credentialManager.isLoaded()).toBe(false);
    });
  });

  describe('isComplete()', () => {
    test('should return true for complete Supabase credentials', () => {
      const creds = {
        supabase: { url: 'https://test.supabase.co', key: 'key' },
        google: {},
        github: {}
      };

      expect(credentialManager.isComplete(creds)).toBe(true);
    });

    test('should return false if Supabase URL is missing', () => {
      const creds = {
        supabase: { key: 'key' },
        google: {},
        github: {}
      };

      expect(credentialManager.isComplete(creds)).toBe(false);
    });

    test('should return false if Supabase key is missing', () => {
      const creds = {
        supabase: { url: 'https://test.supabase.co' },
        google: {},
        github: {}
      };

      expect(credentialManager.isComplete(creds)).toBe(false);
    });

    test('should return true even if optional credentials are missing', () => {
      const creds = {
        supabase: { url: 'https://test.supabase.co', key: 'key' },
        google: null,
        github: null
      };

      expect(credentialManager.isComplete(creds)).toBe(true);
    });
  });

  describe('parseEnvFile()', () => {
    test('should parse simple key=value pairs', () => {
      const content = `
KEY1=value1
KEY2=value2
      `;

      const result = credentialManager.parseEnvFile(content);

      expect(result).toEqual({
        KEY1: 'value1',
        KEY2: 'value2'
      });
    });

    test('should ignore comments', () => {
      const content = `
# This is a comment
KEY1=value1
# Another comment
KEY2=value2
      `;

      const result = credentialManager.parseEnvFile(content);

      expect(result).toEqual({
        KEY1: 'value1',
        KEY2: 'value2'
      });
    });

    test('should ignore empty lines', () => {
      const content = `
KEY1=value1

KEY2=value2

      `;

      const result = credentialManager.parseEnvFile(content);

      expect(result).toEqual({
        KEY1: 'value1',
        KEY2: 'value2'
      });
    });

    test('should handle values with = sign', () => {
      const content = 'KEY1=value=with=equals';

      const result = credentialManager.parseEnvFile(content);

      expect(result).toEqual({
        KEY1: 'value=with=equals'
      });
    });

    test('should trim whitespace', () => {
      const content = '  KEY1  =  value1  ';

      const result = credentialManager.parseEnvFile(content);

      expect(result).toEqual({
        KEY1: 'value1'
      });
    });
  });

  describe('saveToStore()', () => {
    test('should save credentials to encrypted store', () => {
      const Store = require('electron-store');
      const mockSet = jest.fn();
      Store.mockImplementation(() => ({
        set: mockSet,
        get: jest.fn()
      }));

      const creds = global.testUtils.createMockCredentials();
      const result = credentialManager.saveToStore(creds);

      expect(result).toBe(true);
      expect(mockSet).toHaveBeenCalledWith('credentials', creds);
      expect(credentialManager.credentials).toEqual(creds);
    });

    test('should return false on error', () => {
      const Store = require('electron-store');
      Store.mockImplementation(() => {
        throw new Error('Store error');
      });

      const creds = global.testUtils.createMockCredentials();
      const result = credentialManager.saveToStore(creds);

      expect(result).toBe(false);
    });
  });

  describe('get()', () => {
    test('should return credentials if loaded', () => {
      credentialManager.credentials = global.testUtils.createMockCredentials();

      const result = credentialManager.get();

      expect(result).toEqual(credentialManager.credentials);
    });

    test('should throw error if not initialized', () => {
      credentialManager.credentials = null;

      expect(() => credentialManager.get()).toThrow('Credentials not initialized');
    });
  });

  describe('isLoaded()', () => {
    test('should return true if complete credentials are loaded', () => {
      credentialManager.credentials = global.testUtils.createMockCredentials();

      expect(credentialManager.isLoaded()).toBe(true);
    });

    test('should return false if credentials are null', () => {
      credentialManager.credentials = null;

      expect(credentialManager.isLoaded()).toBe(false);
    });

    test('should return false if credentials are incomplete', () => {
      credentialManager.credentials = {
        supabase: { url: null, key: null },
        google: {},
        github: {}
      };

      expect(credentialManager.isLoaded()).toBe(false);
    });
  });

  describe('getInstructions()', () => {
    test('should return configuration instructions object', () => {
      const instructions = credentialManager.getInstructions();

      expect(instructions).toHaveProperty('title');
      expect(instructions).toHaveProperty('message');
      expect(instructions).toHaveProperty('options');
      expect(Array.isArray(instructions.options)).toBe(true);
      expect(instructions.options.length).toBeGreaterThan(0);
    });

    test('should include all configuration methods', () => {
      const instructions = credentialManager.getInstructions();
      const methods = instructions.options.map(opt => opt.method);

      expect(methods).toContain('Sistema (Recomendado)');
      expect(methods).toContain('Archivo Local');
      expect(methods).toContain('Configuración Manual');
    });
  });

  describe('createTemplate()', () => {
    test('should create .env.local.template file', () => {
      const fs = require('fs');
      const mockWriteFileSync = jest.fn();
      fs.writeFileSync = mockWriteFileSync;

      const path = credentialManager.createTemplate();

      expect(mockWriteFileSync).toHaveBeenCalled();
      expect(path).toBeTruthy();
      expect(path).toContain('.env.local.template');
    });

    test('should return null on error', () => {
      const fs = require('fs');
      fs.writeFileSync = jest.fn(() => {
        throw new Error('Write error');
      });

      const path = credentialManager.createTemplate();

      expect(path).toBeNull();
    });
  });
});
