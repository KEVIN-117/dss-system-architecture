import * as React from 'react';
import {
  BarChart3,
  ChevronDown,
  LayoutDashboard,
  PanelLeft,
  Plus,
  Sparkles,
} from 'lucide-react';
import { cn } from 'cn';
import { Button } from '../../atoms/button';
import { Badge } from '../../atoms/badge';
import type { AppBuilderConfig, AppBuilderPage } from './types';

export interface AppShellProps {
  app: AppBuilderConfig;
  activePageId?: string;
  onPageChange?: (pageId: string) => void;
  onAddPage?: () => void;
  onEditSection?: (
    section: 'theme' | 'header' | 'navigation' | 'assistant' | 'pages',
  ) => void;
  editable?: boolean;
  className?: string;
  emptyContent?: React.ReactNode;
}

function PageMark({ page, active }: { page: AppBuilderPage; active: boolean }) {
  return (
    <span
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-lg',
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground',
      )}
      aria-hidden="true"
    >
      {page.id === 'overview' ? (
        <LayoutDashboard className="size-4" />
      ) : (
        <BarChart3 className="size-4" />
      )}
    </span>
  );
}

/** Presentational branded shell for an authored app. Data and persistence remain owned by the host. */
export function AppShell({
  app,
  activePageId,
  onPageChange,
  onAddPage,
  onEditSection,
  editable = false,
  className,
  emptyContent,
}: AppShellProps) {
  const activePage =
    app.pages.find((page) => page.id === activePageId) ?? app.pages[0];
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <section
      className={cn(
        'flex min-h-[34rem] w-full overflow-hidden rounded-xl border border-border bg-background text-foreground shadow-sm',
        className,
      )}
      aria-label={`${app.name} app preview`}
    >
      {app.navigation === 'rail' && (
        <aside
          className={cn(
            'hidden shrink-0 flex-col border-r border-border bg-card transition-[width] md:flex',
            collapsed ? 'w-16' : 'w-60',
          )}
          aria-label="App navigation"
        >
          <div className="flex h-16 items-center gap-3 border-b border-border px-3">
            <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary text-primary-foreground">
              {app.logoUrl ? (
                <img
                  src={app.logoUrl}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <span className="font-semibold">
                  {app.name.slice(0, 1).toUpperCase()}
                </span>
              )}
            </span>
            {!collapsed && (
              <span className="min-w-0 truncate text-sm font-semibold">
                {app.name}
              </span>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              className="ml-auto"
              aria-label={
                collapsed ? 'Expand navigation' : 'Collapse navigation'
              }
              onClick={() => setCollapsed((value) => !value)}
            >
              <PanelLeft className="size-4" />
            </Button>
          </div>
          <nav className="flex-1 space-y-1 p-2" aria-label="Pages">
            {app.pages.map((page) => {
              const active = page.id === activePage?.id;
              return (
                <button
                  key={page.id}
                  type="button"
                  onClick={() => onPageChange?.(page.id)}
                  aria-current={active ? 'page' : undefined}
                  title={collapsed ? page.title : undefined}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    active
                      ? 'bg-primary/10 font-medium text-primary'
                      : 'text-muted-foreground',
                  )}
                >
                  <PageMark page={page} active={active} />
                  {!collapsed && <span className="truncate">{page.title}</span>}
                </button>
              );
            })}
            {editable && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 w-full justify-start text-muted-foreground"
                onClick={onAddPage}
              >
                <Plus className="size-4" />
                {!collapsed && 'Add page'}
              </Button>
            )}
          </nav>
          {editable && (
            <div className="border-t border-border p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => onEditSection?.('navigation')}
              >
                Navigation settings
              </Button>
            </div>
          )}
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-16 items-center gap-4 border-b border-border px-4 md:px-6">
          {app.navigation === 'top' && (
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <span className="font-semibold">
                {app.name.slice(0, 1).toUpperCase()}
              </span>
            </span>
          )}
          <div className="min-w-0 flex-1">
            {app.headerEyebrow && (
              <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {app.headerEyebrow}
              </p>
            )}
            <button
              type="button"
              className="max-w-full truncate text-left text-sm font-semibold hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => editable && onEditSection?.('header')}
              aria-label="Edit app header"
            >
              {app.name}
            </button>
          </div>
          {editable && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEditSection?.('header')}
            >
              Edit header
            </Button>
          )}
          {app.showAssistant && (
            <Button variant="outline" size="sm" className="gap-2">
              <Sparkles className="size-4" />
              Ask
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" aria-label="Workspace options">
            <ChevronDown className="size-4" />
          </Button>
        </header>
        {app.navigation === 'top' && (
          <nav
            className="flex gap-1 overflow-x-auto border-b border-border px-4 md:px-6"
            aria-label="Pages"
          >
            {app.pages.map((page) => (
              <button
                key={page.id}
                type="button"
                onClick={() => onPageChange?.(page.id)}
                aria-current={page.id === activePage?.id ? 'page' : undefined}
                className={cn(
                  'border-b-2 px-3 py-3 text-sm font-medium whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  page.id === activePage?.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {page.title}
              </button>
            ))}
            {editable && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Add page"
                onClick={onAddPage}
              >
                <Plus className="size-4" />
              </Button>
            )}
          </nav>
        )}
        {app.navigation === 'rail' && (
          <nav
            className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2 md:hidden"
            aria-label="Pages"
          >
            {app.pages.map((page) => (
              <button
                key={page.id}
                type="button"
                onClick={() => onPageChange?.(page.id)}
                aria-current={page.id === activePage?.id ? 'page' : undefined}
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  page.id === activePage?.id
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {page.title}
              </button>
            ))}
          </nav>
        )}
        <main
          className="min-h-0 flex-1 overflow-auto bg-muted/30 p-4 md:p-6"
          aria-live="polite"
        >
          {activePage ? (
            <>
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">
                    {activePage.title}
                  </h2>
                  {activePage.description && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {activePage.description}
                    </p>
                  )}
                </div>
                {editable && <Badge variant="outline">Draft preview</Badge>}
              </div>
              {activePage.content ?? emptyContent ?? (
                <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background text-center">
                  <span className="mb-3 flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <LayoutDashboard className="size-5" />
                  </span>
                  <p className="font-medium">Your page is ready</p>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    Add dashboard tiles and content to start building this page.
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed border-border bg-background text-sm text-muted-foreground">
              Add a page to start building your app.
            </div>
          )}
        </main>
      </div>
    </section>
  );
}
