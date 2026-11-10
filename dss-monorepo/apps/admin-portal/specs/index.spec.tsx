import React from 'react';
import { render } from '@testing-library/react';
import { AuthProvider } from '@dss-monorepo/auth';
import Page from '../src/app/page';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
});

describe('Page', () => {
  it('should render successfully', () => {
    const { baseElement } = render(
      <AuthProvider bffBaseUrl="http://localhost:3006">
        <Page />
      </AuthProvider>,
    );
    expect(baseElement).toBeTruthy();
  });
});
