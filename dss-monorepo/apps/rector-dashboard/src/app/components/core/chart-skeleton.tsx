export function ChartSkeleton() {
  return (
    <div
      className="grid h-80 animate-pulse place-items-center rounded-md bg-muted/30"
      role="status"
      aria-label="Cargando visualización"
    >
      <div
        className="flex h-40 w-3/4 items-end justify-center gap-4"
        aria-hidden="true"
      >
        <span className="h-16 w-8 rounded-t bg-muted" />
        <span className="h-28 w-8 rounded-t bg-muted" />
        <span className="h-24 w-8 rounded-t bg-muted" />
        <span className="h-36 w-8 rounded-t bg-muted" />
      </div>
    </div>
  );
}
