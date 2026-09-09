import { render } from '@testing-library/react';

import DssMonorepoRbac from './rbac';

describe('DssMonorepoRbac', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<DssMonorepoRbac />);
    expect(baseElement).toBeTruthy();
  });
});
