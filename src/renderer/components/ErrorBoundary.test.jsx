/**
 * Tests for ErrorBoundary Component
 * Critical for app stability
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

describe('ErrorBoundary', () => {
  // Suppress console.error for these tests
  beforeAll(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    console.error.mockRestore();
  });

  test('should render children when no error', () => {
    const ChildComponent = () => <div>Child Content</div>;

    render(
      <ErrorBoundary>
        <ChildComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Child Content')).toBeInTheDocument();
  });

  test('should render error UI when child throws error', () => {
    const ProblematicComponent = () => {
      throw new Error('Test error');
    };

    render(
      <ErrorBoundary>
        <ProblematicComponent />
      </ErrorBoundary>
    );

    // Check for error message in UI
    expect(screen.getByText(/algo salió mal/i)).toBeInTheDocument();
  });

  test('should display error message', () => {
    const errorMessage = 'Specific test error';
    const ProblematicComponent = () => {
      throw new Error(errorMessage);
    };

    render(
      <ErrorBoundary>
        <ProblematicComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  test('should have reload button on error', () => {
    const ProblematicComponent = () => {
      throw new Error('Test error');
    };

    render(
      <ErrorBoundary>
        <ProblematicComponent />
      </ErrorBoundary>
    );

    const reloadButton = screen.getByRole('button', { name: /recargar/i });
    expect(reloadButton).toBeInTheDocument();
  });
});
