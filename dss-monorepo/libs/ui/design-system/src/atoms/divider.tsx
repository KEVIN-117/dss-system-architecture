interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  children?: React.ReactNode;
}

export function Divider({
  orientation = 'horizontal',
  children,
}: DividerProps) {
  if (orientation === 'vertical') {
    return (
      <div
        className="inline-block h-full w-px shrink-0 bg-border"
        role="separator"
        aria-orientation="vertical"
      />
    );
  } else if (children) {
    return (
      <div
        className="flex items-center gap-3"
        role="separator"
        aria-orientation="horizontal"
      >
        <div className="h-px flex-1 bg-border"></div>
        <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
          {children}
        </span>
        <div className="h-px flex-1 bg-border"></div>
      </div>
    );
  }
  return (
    <div
      className="h-px w-full bg-border"
      role="separator"
      aria-orientation="horizontal"
    />
  );
}
