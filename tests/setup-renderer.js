/**
 * Setup for Renderer Process Tests
 * Configures React Testing Library
 */

// Load global test utilities first
require('./setup.js');

import '@testing-library/jest-dom';

// Mock window.electron (preload API)
global.window.electron = {
  // Customers
  getCustomers: jest.fn(),
  createCustomer: jest.fn(),
  updateCustomer: jest.fn(),
  deleteCustomer: jest.fn(),

  // Payments
  getPayments: jest.fn(),
  createPayment: jest.fn(),

  // Tariffs
  getTariffs: jest.fn(),
  createTariff: jest.fn(),
  updateTariff: jest.fn(),
  deleteTariff: jest.fn(),

  // Settings
  getSettings: jest.fn(),
  updateSettings: jest.fn(),

  // Credentials
  getCredentialStatus: jest.fn(),

  // Analytics
  getAnalytics: jest.fn(),

  // Cloud
  syncToCloud: jest.fn(),
  syncFromCloud: jest.fn(),

  // IPC listeners
  onCloudSyncComplete: jest.fn(),
  onRemoteLoadPending: jest.fn()
};

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn()
  }))
});

// Suppress specific console warnings in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render') ||
       args[0].includes('Not implemented: HTMLFormElement.prototype.submit'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
