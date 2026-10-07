import { createContext } from 'react';

export type DashboardMoveDirection = 'up' | 'down' | 'left' | 'right';

export interface DashboardEditContextValue {
  showDragHandle: boolean;
  moveTile?: (direction: DashboardMoveDirection) => void;
}

export const DashboardEditContext = createContext<DashboardEditContextValue>({
  showDragHandle: false,
});
