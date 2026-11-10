import React from 'react';
import { render } from '@testing-library/react';
import { AuthProvider } from '@dss-monorepo/auth';
import Page from '../src/app/page';

vi.mock('@dss-monorepo/charts', () => ({
  AcademicBarChart: () => null,
  TrendLineChart: () => null,
}));

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
