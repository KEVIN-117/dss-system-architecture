'use client';

import * as React from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

import { getEtlStatus, type EtlLaunch } from '../../data-access/load-manager';
import { durationLabel } from './etl-format';
import { launchStart, processLabel } from './load-manager-format';
import { useNow } from './EtlUi';

export const ETL_STATUS_POLL_MS = 15_000;

/**
 * Header indicator (LM-007): shows the running ETL, if any, with its elapsed time and a link to the launch.
 * It polls the BFF only while the tab is visible and stays hidden when nothing runs or the status cannot be
 * read (the Load Manager pages report errors themselves).
 */
export function EtlRunningIndicator({ enabled }: { enabled: boolean }) {
  const [active, setActive] = React.useState<EtlLaunch[]>([]);

  React.useEffect(() => {
    if (!enabled) {
      setActive([]);
      return;
    }
    let controller: AbortController | null = null;
    const load = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      controller?.abort();
      controller = new AbortController();
      const current = controller;
      getEtlStatus(current.signal)
        .then((status) => {
          if (!current.signal.aborted) setActive(status.active);
        })
        .catch(() => {
          if (!current.signal.aborted) setActive([]);
        });
    };
    load();
    const id = window.setInterval(load, ETL_STATUS_POLL_MS);
    document.addEventListener('visibilitychange', load);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', load);
      controller?.abort();
    };
  }, [enabled]);

  const now = useNow(active.length > 0);
  if (!enabled || active.length === 0) return null;

  const first = active[0];
  const others = active.length - 1;
  return (
    <Link
      href={`/etl/launches/${first.id}`}
      className="inline-flex max-w-[22rem] items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-live="polite"
      title="Ver la ejecución en curso"
    >
      <Loader2 aria-hidden="true" className="size-3.5 shrink-0 motion-safe:animate-spin" />
      <span className="truncate">
        ETL en ejecución · {processLabel(first.processCode)}
      </span>
      <span className="shrink-0 tabular-nums text-primary/80">
        {durationLabel(launchStart(first), null, now)}
      </span>
      {others > 0 ? (
        <span className="shrink-0 rounded-full bg-primary/15 px-1.5 tabular-nums">+{others}</span>
      ) : null}
    </Link>
  );
}
