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
}

export interface DashboardTemplateProps
  extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  sidebarTitle?: string;
  navItems?: NavigationItem[];
  navGroups?: NavigationGroup[];
  surfaceMaterial?: 'solid' | 'frosted';
  user?: HeaderProps['user'];
  onMenuClick?: () => void;
  onSearch?: (query: string) => void;
  onDisconnect?: () => void;
}

export function DashboardTemplate({
  children,
  sidebarTitle = 'DSS MAINFRAME',
  navItems = [],
  navGroups,
  surfaceMaterial = 'solid',
  user,
  onMenuClick,
  onSearch,
  onDisconnect,
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
          surfaceMaterial={surfaceMaterial}
          user={user}
          onMenuClick={onMenuClick}
          onSearch={onSearch}
          onDisconnect={onDisconnect}
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
  navItems,
  navGroups,
  surfaceMaterial,
  user,
  onMenuClick,
  onSearch,
  onDisconnect,
  className,
  ...props
}: DashboardTemplateProps) {
  const { toggleSidebar } = useSidebar();
  const [collapsedGroups, setCollapsedGroups] = React.useState<Set<string>>(
    () => new Set(),
  );
  const groupIdPrefix = React.useId().replaceAll(':', '');
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
      className={cn('flex min-h-svh w-full bg-background', className)}
      {...props}
    >
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
              <Landmark className="size-5" strokeWidth={1.8} />
            </span>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-semibold tracking-tight text-sidebar-foreground">
                {sidebarTitle}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                Plataforma institucional
              </p>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent className="gap-0 px-3 py-3 group-data-[collapsible=icon]:px-2">
          <nav aria-label="Navegación principal">
            {groups.map((group, index) => {
              const isExpanded = !collapsedGroups.has(group.title);
              const contentId = `${groupIdPrefix}-navigation-group-${index}`;
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
                      onClick={() =>
                        setCollapsedGroups((current) => {
                          const next = new Set(current);
                          if (next.has(group.title)) next.delete(group.title);
                          else next.add(group.title);
                          return next;
                        })
                      }
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
              Sistema de decisiones académicas
            </p>
          </SidebarFooter>
        </SidebarContent>
      </Sidebar>

      <main className="flex min-h-svh min-w-0 flex-1 flex-col overflow-x-hidden">
        <Header
          appName={sidebarTitle}
          user={user}
          onMenuClick={() => {
            onMenuClick?.();
            toggleSidebar();
          }}
          onSearch={onSearch}
          onDisconnect={onDisconnect}
          data-dashboard-material={surfaceMaterial}
          className="sticky top-0 z-30 border-b border-border"
        />
        <div className="w-full flex-1 p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
