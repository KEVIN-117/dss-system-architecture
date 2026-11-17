'use client';

import { createPortal } from 'react-dom';
import { useSidebar } from '@dss-monorepo/design-system/portal';
import { OlapQueryWorkspace } from './olap-query-workspace';
import { useOlapSidebar } from './olap-sidebar';

export function EmbeddedOlapWorkspace() {
  const { target, setExpanded } = useOlapSidebar();
  const { isMobile, setOpen, setOpenMobile } = useSidebar();
  return (
    <OlapQueryWorkspace
      embedded
      renderExplorer={(explorer) => target ? createPortal(explorer, target) : null}
      onOpenExplorerFilter={() => { if (isMobile) setOpenMobile(false); }}
      onOpenExplorer={() => {
        setExpanded(true);
        if (isMobile) setOpenMobile(true);
        else setOpen(true);
      }}
    />
  );
}
