import * as React from 'react';
import { cn } from 'cn';
import { ChevronDown, Landmark } from 'lucide-react';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarSeparator,
  useSidebar,
} from '../organisms/sidebar';
import { Header, HeaderProps } from '../organisms/header';
import { TooltipProvider } from '../atoms/tooltip';

export interface NavigationItem {
  title: string;
  href: string;
  icon?: React.ReactNode;
  isActive?: boolean;
}

export interface NavigationGroup {
  title: string;
  items: NavigationItem[];
  content?: React.ReactNode;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

export interface DashboardTemplateProps
  extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  sidebarTitle?: string;
  sidebarSubtitle?: string;
  sidebarLogo?: React.ReactNode;
  navItems?: NavigationItem[];
  navGroups?: NavigationGroup[];
  surfaceMaterial?: 'solid' | 'frosted';
  user?: HeaderProps['user'];
  onMenuClick?: () => void;
  onSearch?: (query: string) => void;
  onDisconnect?: () => void;
  onNavigate?: (href: string) => void;
  /** Rendered in the header before the theme toggle (AcademicContextBadge). */
  headerContext?: React.ReactNode;
  /** Text at the bottom of the sidebar. */
  sidebarFooter?: React.ReactNode;
}

function toNavigationIdSegment(value: string): string {
  return (
    value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'group'
  );
}

export function DashboardTemplate({
  children,
  sidebarTitle = 'DSS MAINFRAME',
  sidebarSubtitle,
  sidebarLogo,
  navItems = [],
  navGroups,
  surfaceMaterial = 'frosted',
  user,
  onMenuClick,
  onSearch,
  onDisconnect,
  onNavigate,
  headerContext,
  sidebarFooter,
  className,
  ...props
}: DashboardTemplateProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <SidebarProvider>
        <DashboardTemplateFrame
          className={className}
          navItems={navItems}
          navGroups={navGroups}
          sidebarTitle={sidebarTitle}
          sidebarSubtitle={sidebarSubtitle}
          sidebarLogo={sidebarLogo}
          surfaceMaterial={surfaceMaterial}
          user={user}
          onMenuClick={onMenuClick}
          onSearch={onSearch}
          onDisconnect={onDisconnect}
          onNavigate={onNavigate}
          headerContext={headerContext}
          sidebarFooter={sidebarFooter}
          {...props}
        >
          {children}
        </DashboardTemplateFrame>
      </SidebarProvider>
    </TooltipProvider>
  );
}

function DashboardTemplateFrame({
  children,
  sidebarTitle,
  sidebarSubtitle,
  sidebarLogo,
  navItems,
  navGroups,
  surfaceMaterial,
  user,
  onMenuClick,
  onSearch,
  onDisconnect,
  onNavigate,
  headerContext,
  sidebarFooter = 'Sistema de decisiones académicas',
  className,
  ...props
}: DashboardTemplateProps) {
  const { toggleSidebar } = useSidebar();
  const [collapsedGroups, setCollapsedGroups] = React.useState<Set<string>>(
    () => new Set(),
  );
  const groupIdPrefix = toNavigationIdSegment(sidebarTitle ?? 'dashboard');
  const groups = navGroups?.length
    ? navGroups
    : navItems?.length
      ? [{ title: 'Navegación', items: navItems }]
      : [];
  const activeGroupTitle = groups.find((group) =>
    group.items.some((item) => item.isActive),
  )?.title;

  React.useEffect(() => {
    if (!activeGroupTitle) return;
    setCollapsedGroups((current) => {
      if (!current.has(activeGroupTitle)) return current;
      const next = new Set(current);
      next.delete(activeGroupTitle);
      return next;
    });
  }, [activeGroupTitle]);

  return (
    <div
      data-dss-portal=""
      className={cn('relative isolate flex min-h-svh w-full bg-background', className)}
      {...props}
    >
      <a
        href="#contenido"
        className="sr-only z-50 rounded-lg bg-background px-4 py-2 text-sm font-medium text-foreground shadow-raised ring-2 ring-ring focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Saltar al contenido
      </a>
      {surfaceMaterial === 'frosted' ? <PortalBackdrop /> : null}
      <Sidebar
        material={surfaceMaterial}
        collapsible="icon"
        className="border-r border-sidebar-border/80"
      >
        <SidebarHeader className="border-b border-sidebar-border/80 px-4 py-4 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0">
          <div className="flex min-w-0 items-center gap-3 group-data-[collapsible=icon]:justify-center">
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-sidebar-border bg-sidebar-accent text-sidebar-primary group-data-[collapsible=icon]:size-9"
            >
              {sidebarLogo ?? <Landmark className="size-5" strokeWidth={1.8} />}
            </span>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-semibold tracking-tight text-sidebar-foreground">
                {sidebarTitle}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {sidebarSubtitle ?? 'Plataforma institucional'}
              </p>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent className="gap-0 px-3 py-3 group-data-[collapsible=icon]:px-2">
          <nav aria-label="Navegación principal">
            {groups.map((group, index) => {
              const isExpanded = group.expanded ?? !collapsedGroups.has(group.title);
              const contentId = `${groupIdPrefix}-navigation-group-${index}-${toNavigationIdSegment(group.title)}`;
              return (
                <SidebarGroup
                  key={group.title}
                  className={cn(
                    'p-0 pb-2',
                    index > 0 && 'mt-2 border-t border-sidebar-border/70 pt-2',
                  )}
                >
                  <SidebarGroupLabel
                    role="heading"
                    aria-level={2}
                    className="h-9 px-0 text-muted-foreground"
                  >
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      aria-controls={contentId}
                      className="flex h-full w-full items-center justify-between rounded-md px-3 text-left text-xs font-semibold tracking-wide transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                      onClick={() => {
                        if (group.onExpandedChange) {
                          group.onExpandedChange(!isExpanded);
                          return;
                        }
                        setCollapsedGroups((current) => {
                          const next = new Set(current);
                          if (next.has(group.title)) next.delete(group.title);
                          else next.add(group.title);
                          return next;
                        });
                      }}
                    >
                      <span className="truncate">{group.title}</span>
                      <ChevronDown
                        aria-hidden="true"
                        className={cn(
                          'size-3.5 shrink-0 transition-transform duration-150 motion-reduce:transition-none',
                          isExpanded ? 'rotate-0' : '-rotate-90',
                        )}
                      />
                    </button>
                  </SidebarGroupLabel>
                  <SidebarGroupContent
                    id={contentId}
                    hidden={!isExpanded}
                    className="pt-1"
                  >
                    <SidebarMenu className="gap-1">
                      {group.items.map((item) => (
                        <SidebarMenuItem key={`${item.href}-${item.title}`}>
                          <SidebarMenuButton
                            asChild
                            isActive={item.isActive}
                            tooltip={item.title}
                            className="relative h-10 rounded-lg px-3 text-sidebar-foreground transition-colors duration-150 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring data-[active=true]:bg-sidebar-accent data-[active=true]:font-semibold data-[active=true]:text-sidebar-accent-foreground data-[active=true]:ring-1 data-[active=true]:ring-inset data-[active=true]:ring-sidebar-border [&_svg]:text-muted-foreground data-[active=true]:[&_svg]:text-sidebar-primary"
                          >
                            <a
                              href={item.href}
                              onClick={(event) => {
                                if (
                                  onNavigate &&
                                  event.button === 0 &&
                                  !event.metaKey &&
                                  !event.ctrlKey &&
                                  !event.shiftKey &&
                                  !event.altKey
                                ) {
                                  event.preventDefault();
                                  onNavigate(item.href);
                                }
                              }}
                              aria-current={item.isActive ? 'page' : undefined}
                            >
                              {item.isActive && (
                                <span
                                  aria-hidden="true"
                                  className="absolute inset-y-2 left-0 w-0.5 rounded-r bg-sidebar-primary"
                                />
                              )}
                              {item.icon && (
                                <span className="flex size-5 shrink-0 items-center justify-center">
                                  {item.icon}
                                </span>
                              )}
                              <span>{item.title}</span>
                            </a>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                    {group.content && (
                      <div className="group-data-[collapsible=icon]:hidden">
                        {group.content}
                      </div>
                    )}
                  </SidebarGroupContent>
                </SidebarGroup>
              );
            })}
            {groups.length === 0 && (
              <p className="px-3 py-4 text-sm text-muted-foreground">
                No hay secciones disponibles.
              </p>
            )}
          </nav>
          <SidebarSeparator className="mt-auto group-data-[collapsible=icon]:hidden" />
          <SidebarFooter className="px-3 py-3 group-data-[collapsible=icon]:hidden">
            <p className="text-xs leading-5 text-muted-foreground">
              {sidebarFooter}
            </p>
          </SidebarFooter>
        </SidebarContent>
      </Sidebar>

      <main className="flex min-h-svh min-w-0 flex-1 flex-col overflow-x-hidden">
        <Header
          appName={sidebarTitle}
          contextLabel={sidebarSubtitle}
          logo={sidebarLogo}
          user={user}
          onMenuClick={() => {
            onMenuClick?.();
            toggleSidebar();
          }}
          onSearch={onSearch}
          showSearch={Boolean(onSearch)}
          onDisconnect={onDisconnect}
          contextSlot={headerContext}
          data-dashboard-material={surfaceMaterial}
          className={cn(
            'sticky top-0 z-30 border-b',
            surfaceMaterial === 'frosted'
              ? 'border-(--glass-border) hairline-top'
              : 'border-border',
          )}
        />
        <div
          id="contenido"
          tabIndex={-1}
          className="w-full flex-1 p-4 outline-none sm:p-6 lg:p-8"
        >
          {children}
        </div>
      </main>
    </div>
  );
}

/**
 * Static ambient light behind the frosted chrome: two blurred orbs (brand blue
 * and the role accent) and a faint top glow. Nothing animates, so it costs one
 * paint and never competes with the data.
 */
function PortalBackdrop() {
  return (
    <div
      aria-hidden="true"
      data-slot="portal-backdrop"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div className="absolute -top-48 -left-32 size-[36rem] rounded-full bg-(--orb-primary) blur-[110px]" />
      <div className="absolute top-32 -right-24 size-[28rem] rounded-full bg-(--orb-role) blur-[120px]" />
      <div className="absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,color-mix(in_srgb,var(--foreground)_4%,transparent),transparent_70%)]" />
    </div>
  );
}
