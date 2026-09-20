import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { getInstanceByDom } from 'echarts/core';
import { AcademicBarChart } from './academic-bar-chart';
import { RiskDonutChart } from './risk-donut-chart';
import { TrendLineChart } from './trend-line-chart';
import type { ChartDataPoint } from '../core/builders';
import type { ChartClickEvent } from '../core/types';
import { colorWithAlpha, normalizeChartColor } from '../core/colors';

const data: ChartDataPoint[] = [
  { label: 'Ingeniería', value: 80, tone: 'success' },
  { label: 'Ciencias', value: 45, tone: 'warning' },
  { label: 'Economía', value: 20, tone: 'destructive' },
];

function Lifecycle() {
  const [kind, setKind] = useState('bar');
  const [mode, setMode] = useState(false);
  const [role, setRole] = useState('admin');
  const [state, setState] = useState('normal');
  const [loading, setLoading] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [mounted, setMounted] = useState(true);
  const [callback, setCallback] = useState(0);
  const [selection, setSelection] = useState('');
  const [snapshot, setSnapshot] = useState('');
  const [localColor, setLocalColor] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const Component = kind === 'bar' ? AcademicBarChart : kind === 'donut' ? RiskDonutChart : TrendLineChart;
  const points = state === 'empty' ? [] : state === 'zero' ? data.map((d) => ({ ...d, value: 0 })) :
    state === 'invalid' ? [{ label: 'Dato no válido', value: NaN }] : state === 'reduced' ? data.slice(0, 1) :
    state === 'long' ? data.map((d) => ({ ...d, label: `${d.label} — seguimiento académico de la gestión 2026` })) : data;
  const onClick = (event: ChartClickEvent) => setSelection(`${callback}:${event.name}:${event.value}`);
  const inspect = () => {
    const host = container.current?.querySelector<HTMLElement>('[role="img"]');
    const chart = host && getInstanceByDom(host);
    setSnapshot(JSON.stringify({
      option: chart?.getOption(), width: chart?.getWidth(), height: chart?.getHeight(),
      colors: ['#1234', 'rgba(10,20,30,0.4)', 'hsl(120 100% 25%)', 'oklch(0.6 0.15 260)']
        .map((color) => ({ input: color, normalized: normalizeChartColor(color), alpha: colorWithAlpha(color, 0.5) })),
    }));
  };
  return (
    <section>
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>Gráficos del DSS: estados e interacción</h1>
      <p style={{ marginBottom: 20 }}>Datos ilustrativos. Cambia el contexto sin recargar el gráfico.</p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 24 }}>
        <label>Gráfico <select aria-label="Gráfico" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="bar">Barras</option><option value="donut">Dona</option><option value="line">Línea</option>
        </select></label>
        <label>Ámbito <select aria-label="Ámbito" value={role} onChange={(e) => setRole(e.target.value)}>
          {['admin', 'rector', 'decano', 'director'].map((r) => <option key={r}>{r}</option>)}
        </select></label>
        <label>Datos <select aria-label="Datos" value={state} onChange={(e) => setState(e.target.value)}>
          {['normal', 'empty', 'zero', 'invalid', 'reduced', 'long'].map((s) => <option key={s}>{s}</option>)}
        </select></label>
        <button onClick={() => setMode(!mode)}>Cambiar modo</button>
        <button onClick={() => setNarrow(!narrow)}>Cambiar ancho</button>
        <button onClick={() => setLoading(!loading)}>Alternar carga</button>
        <button onClick={() => setHidden(!hidden)}>Ocultar o mostrar</button>
        <button onClick={() => setMounted(!mounted)}>Montar o desmontar</button>
        <button onClick={() => setCallback(callback + 1)}>Cambiar callback</button>
        <button onClick={() => setLocalColor(!localColor)}>Color local</button>
        <button onClick={inspect}>Inspeccionar opciones</button>
      </div>
      <div ref={container} data-testid="local-theme" data-theme={role} className={mode ? 'dark' : ''}
        style={{ width: narrow ? 'min(300px, 100%)' : '100%', maxWidth: 900, display: hidden ? 'none' : 'block',
          background: 'var(--background)', color: 'var(--foreground)',
          ...(localColor ? { '--primary': 'oklch(0.6 0.15 260)' } : {}) } as CSSProperties}>
        {mounted && <Component title="Seguimiento académico" data={points} loading={loading} onChartClick={onClick} />}
      </div>
      <p style={{ marginTop: 16 }}>Selección: <output data-testid="selection" aria-live="polite">{selection}</output></p>
      <details style={{ marginTop: 16 }}><summary>Opciones del motor para diagnóstico</summary>
        <pre data-testid="snapshot" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 240, overflow: 'auto' }}>{snapshot}</pre>
      </details>
    </section>
  );
}

const meta: Meta<typeof Lifecycle> = { title: 'Charts/Validation', component: Lifecycle, parameters: { layout: 'fullscreen' } };
export default meta;
type Story = StoryObj<typeof Lifecycle>;
export const LifecycleAndThemes: Story = {};
