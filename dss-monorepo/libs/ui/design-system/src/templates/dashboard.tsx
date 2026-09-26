import * as React from 'react';
import { cn } from 'cn';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from '../organisms/sidebar';
import { Header, HeaderProps } from '../organisms/header';
import { Typography } from '../atoms/typography';

export interface NavigationItem {
  title: string;
  href: string;
  icon?: React.ReactNode;
}

export interface DashboardTemplateProps
  extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  sidebarTitle?: string;
  navItems?: NavigationItem[];
  user?: HeaderProps['user'];
  onMenuClick?: () => void;
  onSearch?: (query: string) => void;
  onDisconnect?: () => void;
}

export function DashboardTemplate({
  children,
  sidebarTitle = 'DSS MAINFRAME',
  navItems = [],
  user,
  onMenuClick,
  onSearch,
  onDisconnect,
  className,
  ...props
}: DashboardTemplateProps) {
  return (
    <SidebarProvider>
      <div
        className={cn('flex min-h-screen w-full bg-background', className)}
        {...props}
      >
        {/* Sidebar Left side */}
        <Sidebar className="border-r border-primary/20 bg-background/80 backdrop-blur-xl">
          <SidebarHeader className="p-6 border-b border-primary/10">
            <Typography variant="neon" className="text-xl">
              {sidebarTitle}
            </Typography>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup className="mt-4">
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.href + item.title}>
                    <SidebarMenuButton
                      asChild
                      className="hover:bg-primary/10 hover:text-primary transition-colors data-[active=true]:bg-primary/20 data-[active=true]:text-primary data-[active=true]:border-r-2 data-[active=true]:border-primary"
                    >
                      <a
                        href={item.href}
                        className="flex items-center gap-3 px-4 py-3 font-mono text-sm"
                      >
                        {item.icon}
                        <span>{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="p-4 border-t border-primary/20 bg-muted/10">
            <div className="flex items-center justify-between">
              <Typography
                variant="muted"
                className="text-[10px] uppercase font-mono"
              >
                Status: Secure
              </Typography>
              <div className="size-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_theme(colors.emerald.500)]" />
            </div>
          </SidebarFooter>
        </Sidebar>

        {/* Main content right side */}
        <main className="flex-1 flex flex-col relative overflow-x-hidden min-h-screen">
          {/* Cyberpunk Grid Background */}
          <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,theme(colors.primary.DEFAULT/3%)_1px,transparent_1px),linear-gradient(to_bottom,theme(colors.primary.DEFAULT/3%)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

          <div className="relative z-10 flex-1 flex flex-col">
            <Header
              user={user}
              onMenuClick={onMenuClick}
              onSearch={onSearch}
              onDisconnect={onDisconnect}
              className="sticky top-0 z-50 border-b border-primary/20 bg-background/70 backdrop-blur-lg"
            />
            <div className="flex-1 p-6 md:p-8 lg:p-10 w-full animate-in fade-in zoom-in-95 duration-500">
              {children}
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
