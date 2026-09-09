import { render } from '@testing-library/react';

import DssMonorepoAuth from './auth';

describe('DssMonorepoAuth', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<DssMonorepoAuth />);
    expect(baseElement).toBeTruthy();
  });
});
