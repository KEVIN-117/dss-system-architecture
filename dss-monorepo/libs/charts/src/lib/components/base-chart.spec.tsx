import { act, cleanup, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseChart } from './base-chart';
import { AcademicBarChart } from './academic-bar-chart';
import { RiskDonutChart } from './risk-donut-chart';
import { TrendLineChart } from './trend-line-chart';
import type { ChartClickEvent } from '../core/types';

const engine = vi.hoisted(() => ({ init: vi.fn() }));
vi.mock('../core/engine', () => engine);

type ChartMock = ReturnType<typeof makeChart>;
function makeChart() {
  return {
    setOption: vi.fn(),
    resize: vi.fn(),
    clear: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    showLoading: vi.fn(),
    hideLoading: vi.fn(),
    dispose: vi.fn(),
  };
}
let charts: ChartMock[];
let frames: Map<number, FrameRequestCallback>;
let resize: () => void;
let changeTheme: () => void;
let motionChange: () => void;
let width: number;
let reducedMotion: boolean;
let disconnectResize: ReturnType<typeof vi.fn>;
let disconnectMutation: ReturnType<typeof vi.fn>;
let removeMotion: ReturnType<typeof vi.fn>;
let nextFrame: number;

function flush() {
  act(() => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback(0));
  });
}
const seriesClick = {
  componentType: 'series',
  dataIndex: 0,
  name: 'A',
  value: 8,
} as ChartClickEvent;

beforeEach(() => {
  charts = [];
  frames = new Map();
  nextFrame = 0;
  width = 600;
  reducedMotion = false;
  engine.init.mockImplementation(() => {
    const chart = makeChart();
    charts.push(chart);
    return chart;
  });
  disconnectResize = vi.fn();
  disconnectMutation = vi.fn();
  removeMotion = vi.fn();
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(
    () => width,
  );
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(360);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe() {
        /* measured on first frame */
      }
      disconnect = disconnectResize;
    },
  );
  vi.stubGlobal(
    'MutationObserver',
    class {
      constructor(callback: () => void) {
        changeTheme = callback;
      }
      observe() {
        /* attributes watched */
      }
      disconnect = disconnectMutation;
    },
  );
  vi.stubGlobal('matchMedia', () => ({
    get matches() {
      return reducedMotion;
    },
    addEventListener: (_: string, callback: () => void) => {
      motionChange = callback;
    },
    removeEventListener: removeMotion,
  }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  engine.init.mockClear();
});

describe('BaseChart lifecycle', () => {
  it('keeps tooltips inside the chart by default', () => {
    render(<BaseChart option={{ tooltip: { trigger: 'axis' } }} />);
    flush();
    expect(charts[0].setOption).toHaveBeenLastCalledWith(
      expect.objectContaining({
        tooltip: expect.objectContaining({ trigger: 'axis', confine: true }),
      }),
      { notMerge: true },
    );
  });
  it('reuses an instance and replaces options when series shrink', () => {
    const view = render(
      <BaseChart option={{ series: [{ type: 'bar', data: [8, 9] }] }} />,
    );
    flush();
    view.rerender(
      <BaseChart option={{ series: [{ type: 'bar', data: [2] }] }} />,
    );
    flush();
    expect(charts).toHaveLength(1);
    expect(charts[0].setOption).toHaveBeenLastCalledWith(
      expect.objectContaining({ series: [{ type: 'bar', data: [2] }] }),
      { notMerge: true },
    );
  });

  it('uses a callback added or replaced after mount, only for series events', () => {
    const view = render(<BaseChart option={{}} />);
    flush();
    const first = vi.fn();
    const second = vi.fn();
    const handler = charts[0].on.mock.calls[0][1] as (
      event: ChartClickEvent,
    ) => void;
    view.rerender(<BaseChart option={{}} onChartClick={first} />);
    handler(seriesClick);
    view.rerender(<BaseChart option={{}} onChartClick={second} />);
    handler(seriesClick);
    handler({ ...seriesClick, componentType: 'legend' });
    expect(first).toHaveBeenCalledExactlyOnceWith(seriesClick);
    expect(second).toHaveBeenCalledExactlyOnceWith(seriesClick);
    expect(charts[0].on).toHaveBeenCalledTimes(1);
  });

  it('defers initialization when hidden and coalesces resize notifications', () => {
    width = 0;
    render(<BaseChart option={{}} />);
    flush();
    expect(charts).toHaveLength(0);
    width = 400;
    resize();
    resize();
    resize();
    flush();
    expect(charts).toHaveLength(1);
    expect(charts[0].resize).not.toHaveBeenCalled();
    width = 450;
    resize();
    flush();
    expect(charts[0].resize).toHaveBeenCalledTimes(1);
    changeTheme();
    flush();
    expect(charts[0].resize).toHaveBeenCalledTimes(1);
  });

  it('cleans observers, animation frames, events and canvases in Strict Mode', () => {
    const view = render(
      <StrictMode>
        <BaseChart option={{}} />
      </StrictMode>,
    );
    flush();
    resize();
    view.unmount();
    flush();
    expect(charts).toHaveLength(1);
    expect(charts[0].dispose).toHaveBeenCalledTimes(1);
    expect(charts[0].off).toHaveBeenCalledWith('click', expect.any(Function));
    expect(disconnectResize).toHaveBeenCalledTimes(2);
    expect(disconnectMutation).toHaveBeenCalledTimes(2);
    expect(removeMotion).toHaveBeenCalledTimes(2);
    expect(frames.size).toBe(0);
  });

  it('updates local themes and reduced motion without remounting', () => {
    const view = render(
      <BaseChart option={(theme) => ({ color: [theme.foreground] })} />,
    );
    flush();
    view.container.firstElementChild?.setAttribute(
      'style',
      '--foreground: #ff0000',
    );
    // Override has the same change path as a newly resolved theme in the browser.
    view.rerender(
      <BaseChart
        themeTokens={{ foreground: '#ff0000' }}
        option={(theme) => ({ color: [theme.foreground] })}
      />,
    );
    changeTheme();
    reducedMotion = true;
    motionChange();
    flush();
    expect(charts).toHaveLength(1);
    expect(charts[0].setOption).toHaveBeenLastCalledWith(
      expect.objectContaining({ color: ['#ff0000'], animation: false }),
      { notMerge: true },
    );
  });

  it('prioritizes loading over invalid and empty data, then clears stale output', () => {
    const view = render(
      <BaseChart
        option={{ series: [{ type: 'bar', data: [NaN] }] }}
        invalid
        empty
        loading
      />,
    );
    flush();
    expect(screen.getByRole('status').textContent).toBe('Cargando…');
    expect(charts[0].showLoading).toHaveBeenCalled();
    expect(charts[0].setOption.mock.calls[0][0]).not.toHaveProperty('series');
    view.rerender(
      <BaseChart option={{}} empty emptyMessage="No hay registros" />,
    );
    flush();
    expect(screen.getByRole('status').textContent).toBe('No hay registros');
    expect(charts[0].hideLoading).toHaveBeenCalled();
    expect(charts[0].clear).toHaveBeenCalled();
  });
});

describe('Required chart states', () => {
  it.each([AcademicBarChart, RiskDonutChart, TrendLineChart])(
    'rejects non-finite and negative values',
    (Component) => {
      for (const value of [-1, NaN, Infinity]) {
        const view = render(<Component data={[{ label: 'A', value }]} />);
        flush();
        expect(screen.getByRole('alert').textContent).toContain(
          'Datos inválidos',
        );
        view.unmount();
      }
      expect(charts).toHaveLength(0);
    },
  );
  it('does not draw a distribution for a zero-total donut', () => {
    render(<RiskDonutChart data={[{ label: 'A', value: 0 }]} />);
    flush();
    expect(screen.getByRole('status').textContent).toBe(
      'Sin datos disponibles',
    );
    expect(charts).toHaveLength(0);
  });
});
