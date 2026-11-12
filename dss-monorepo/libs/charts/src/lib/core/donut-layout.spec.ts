import { describe, expect, it } from 'vitest';
import { buildDonutOption } from './builders';

describe('donut chart layout', () => {
  it.each([320, 640])(
    'keeps the tooltip inside the chart and truncates the legend at %ipx',
    (width) => {
      const option = buildDonutOption(
        [{ label: 'Facultad con un nombre muy largo', value: 8 }],
        'Facultades',
        undefined,
        width,
      );
      expect(option.tooltip).toMatchObject({ confine: true });
      expect(option.legend).toMatchObject({
        orient: 'horizontal',
        textStyle: { overflow: 'truncate' },
      });
    },
  );
});
