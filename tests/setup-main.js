/**
 * Setup for Main Process Tests
 * Mocks Electron APIs
 */

// Load global test utilities first
require('./setup.js');

// Mock Electron
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn((name) => {
      if (name === 'userData') return '/mock/userData';
      if (name === 'logs') return '/mock/logs';
      return '/mock/path';
    }),
    getVersion: jest.fn(() => '1.0.7'),
    isPackaged: false,
    quit: jest.fn()
  },
  BrowserWindow: jest.fn(),
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn()
  },
  shell: {
    showItemInFolder: jest.fn(),
    openExternal: jest.fn()
  }
}));

// Mock electron-log
jest.mock('electron-log', () => ({
  transports: {
    file: {
      level: 'debug',
      getFile: jest.fn(() => ({ path: '/mock/log.log' }))
    },
    console: {
      level: 'debug'
    }
  },
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

// Mock electron-store
jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn()
  }));
});

// Mock better-sqlite3
jest.mock('better-sqlite3', () => {
  return jest.fn().mockImplementation(() => global.testUtils.createMockDb());
});

// Mock fs for file operations
const mockFs = {
  ...jest.requireActual('fs'),
  existsSync: jest.fn(() => true),
  readFileSync: jest.fn(() => 'mock file content'),
  writeFileSync: jest.fn(),
  copyFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  mkdirSync: jest.fn(),
  readdirSync: jest.fn(() => [])
};

jest.mock('fs', () => mockFs);
