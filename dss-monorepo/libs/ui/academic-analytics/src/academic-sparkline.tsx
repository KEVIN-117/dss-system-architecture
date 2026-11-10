export interface AcademicSparklinePoint {
  label: string;
  value: number;
}

export interface AcademicSparklineProps {
  data: readonly AcademicSparklinePoint[];
  label: string;
  formatValue?: (value: number) => string;
  className?: string;
}

/** Compact, accessible trend context for academic summary metrics. */
export function AcademicSparkline({
  data,
  label,
  formatValue = (value) => new Intl.NumberFormat('es-BO').format(value),
  className,
}: AcademicSparklineProps) {
  const points = data.filter(
    (point) => Number.isFinite(point.value) && point.label.trim().length > 0,
  );

  if (points.length === 0) return null;

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const width = 100;
  const height = 36;
  const padding = 3;
  const coordinates = points.map((point, index) => {
    const x =
      points.length === 1
        ? width / 2
        : padding + (index / (points.length - 1)) * (width - padding * 2);
    const y =
      max === min
        ? height / 2
        : padding + ((max - point.value) / range) * (height - padding * 2);
    return { x, y };
  });
  const line = coordinates.map(({ x, y }) => `${x},${y}`).join(' ');
  const area = `${coordinates[0].x},${height} ${line} ${coordinates.at(-1)?.x},${height}`;
  const first = points[0];
  const last = points.at(-1);
  const lastPoint = coordinates.at(-1);
  const accessibleLabel = `${label}. Tendencia de ${points.length} periodos; ${first.label}: ${formatValue(first.value)}; ${last?.label}: ${last ? formatValue(last.value) : ''}.`;

  return (
    <svg
      role="img"
      aria-label={accessibleLabel}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={
        className ?? 'h-9 w-full text-[color:var(--role-accent,var(--primary))]'
      }
    >
      <polygon points={area} fill="currentColor" fillOpacity="0.1" />
      <polyline
        points={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {lastPoint && (
        <circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r="2.2"
          fill="currentColor"
          stroke="var(--card)"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}
