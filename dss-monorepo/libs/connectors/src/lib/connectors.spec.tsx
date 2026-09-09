import { render } from '@testing-library/react';

import DssMonorepoConnectors from './connectors';

describe('DssMonorepoConnectors', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<DssMonorepoConnectors />);
    expect(baseElement).toBeTruthy();
  });
});
