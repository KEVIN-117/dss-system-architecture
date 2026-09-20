import { useState } from 'react';
import { Button } from './button';

type Direction = 'asc' | 'desc';

type SortableColumnHeaderProps<K extends string> = {
  label: string;
  sortKey: K;
  activeKey: K;
  direction: Direction;
  onToggle: (key: K) => void;
  testid?: string;
};

const ARROW_UP = 'M5 12l7-7 7 7M12 19V5';
const ARROW_DOWN = 'M12 5v14M19 12l-7 7-7-7';
const ARROW_UP_DOWN = 'M21 16l-4 4-4-4M17 20V4M3 8l4-4 4 4M7 4v16';

export function SortableColumnHeader<K extends string>({
  label,
  sortKey,
  activeKey,
  direction,
  onToggle,
  testid,
}: SortableColumnHeaderProps<K>) {
  const [isActive, setIsActive] = useState(activeKey === sortKey);

  const directionIcon = () => {
    if (isActive) {
      if (direction === 'asc') {
        return <Icon d={ARROW_UP} cls="h-4 w-4" />;
      } else {
        return <Icon d={ARROW_DOWN} cls="h-4 w-4" />;
      }
    } else {
      return <Icon d={ARROW_UP_DOWN} cls="h-4 w-4" />;
    }
  };

  const Icon = ({ d, cls }: { d: string; cls: string }) => (
    <svg
      className={cls}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );

  return (
    <Button onClick={() => onToggle(sortKey)} variant="ghost" className="w-fit">
      {label}
      {directionIcon()}
    </Button>
  );
}
