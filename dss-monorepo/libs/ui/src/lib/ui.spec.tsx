import { render } from '@testing-library/react';

import DssMonorepoUi from './ui';

describe('DssMonorepoUi', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<DssMonorepoUi />);
    expect(baseElement).toBeTruthy();
  });
});
