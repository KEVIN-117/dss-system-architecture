'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

const OlapSidebarContext = createContext<{
  target: HTMLDivElement | null;
  setTarget: (target: HTMLDivElement | null) => void;
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
} | null>(null);

export function OlapSidebarProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  const [expanded, setExpanded] = useState(true);
  return <OlapSidebarContext.Provider value={{ target, setTarget, expanded, setExpanded }}>{children}</OlapSidebarContext.Provider>;
}

export function useOlapSidebar() {
  const context = useContext(OlapSidebarContext);
  if (!context) throw new Error('OLAP sidebar requires OlapSidebarProvider');
  return context;
}
