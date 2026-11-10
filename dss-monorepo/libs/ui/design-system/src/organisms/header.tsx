'use client';

import * as React from 'react';
import { cn } from 'cn';
import { Search, Bell, Menu, GraduationCap, LogOut, User } from 'lucide-react';
import { Button } from '../atoms/button';
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
} from '../atoms/input-group';
import { Avatar, AvatarFallback, AvatarImage } from '../atoms/avatar';
import { Badge } from '../atoms/badge';
import { ThemeToggle } from '../atoms/theme-toggle';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
} from '../atoms/popover';

export interface HeaderProps extends React.HTMLAttributes<HTMLElement> {
  appName?: string;
  logo?: React.ReactNode;
  contextLabel?: string;
  user?: { name: string; email: string; avatarUrl?: string };
  notificationCount?: number;
  onMenuClick?: () => void;
  onSearch?: (query: string) => void;
  showSearch?: boolean;
  onNotificationsClick?: () => void;
  onProfileClick?: () => void;
  onSignIn?: () => void;
  onDisconnect?: () => void;
}

export function Header({
  className,
  appName = 'DSS académico',
  logo,
  contextLabel,
  user,
  notificationCount = 0,
  onMenuClick,
  onSearch,
  showSearch = true,
  onNotificationsClick,
  onProfileClick,
  onSignIn,
  onDisconnect,
  ...props
}: HeaderProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const searchId = React.useId();
  const unreadCount = Number.isFinite(notificationCount)
    ? Math.max(0, Math.floor(notificationCount))
    : 0;
  const initials = user?.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('');

  return (
    <header
      className={cn(
        'sticky top-0 z-30 grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 border-b border-border bg-card px-4 py-3 text-foreground sm:px-6',
        showSearch &&
          'md:grid-cols-[minmax(0,1fr)_minmax(14rem,28rem)_minmax(0,1fr)]',
        '[&_:focus-visible]:outline-2 [&_:focus-visible]:outline-offset-2 [&_:focus-visible]:outline-foreground [&_[data-slot=avatar]::after]:shadow-none [&_[data-slot=avatar]::after]:border-border [&_[data-slot=avatar]::after]:mix-blend-normal',
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 items-center gap-3">
        {onMenuClick && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="size-11 lg:hidden"
            aria-label="Abrir menú de navegación"
          >
            <Menu aria-hidden="true" />
          </Button>
        )}
        {logo ?? (
          <GraduationCap
            className="size-7 shrink-0 text-primary"
            aria-hidden="true"
          />
        )}
        <div className="min-w-0">
          <p className="truncate text-base font-semibold leading-6">
            {appName}
          </p>
          {contextLabel && (
            <p className="truncate text-sm leading-5 text-muted-foreground">
              {contextLabel}
            </p>
          )}
        </div>
      </div>

      {showSearch && (
        <div
          role="search"
          aria-label="Búsqueda académica"
          className="order-3 col-span-2 min-w-0 md:order-none md:col-span-1"
        >
          <label htmlFor={searchId} className="sr-only">
            Buscar en el espacio académico
          </label>
          <InputGroup className="min-h-11 bg-background">
            <InputGroupAddon>
              <Search
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
            </InputGroupAddon>
            <InputGroupInput
              id={searchId}
              type="search"
              placeholder="Buscar informes, cubos o recursos…"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                onSearch?.(event.target.value);
              }}
              className="text-foreground placeholder:text-muted-foreground"
            />
          </InputGroup>
        </div>
      )}

      <div className="flex min-w-0 items-center justify-end gap-2 md:order-3">
        <ThemeToggle />
        {onNotificationsClick && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onNotificationsClick}
            className="relative size-11 text-muted-foreground"
            aria-label={
              unreadCount
                ? `Notificaciones: ${unreadCount} sin leer`
                : 'Notificaciones'
            }
          >
            <Bell aria-hidden="true" />
            {unreadCount > 0 && (
              <Badge
                aria-hidden="true"
                variant="destructive"
                className="absolute right-0 top-0 flex min-w-4 items-center justify-center px-1 text-xs tabular-nums"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
          </Button>
        )}
        {user ? (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                aria-label={`Cuenta de ${user.name}`}
                className="h-11 min-w-11 gap-2 px-1.5 lg:px-2"
              >
                <Avatar className="size-8">
                  {user.avatarUrl && (
                    <AvatarImage src={user.avatarUrl} alt="" />
                  )}
                  <AvatarFallback className="bg-secondary font-medium text-secondary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden max-w-36 truncate lg:inline">
                  {user.name}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-72 max-w-[calc(100vw-2rem)] p-4"
              aria-label="Cuenta de usuario"
            >
              <PopoverHeader>
                <PopoverTitle className="break-words text-base font-semibold">
                  {user.name}
                </PopoverTitle>
                <PopoverDescription className="break-all leading-6">
                  {user.email}
                </PopoverDescription>
              </PopoverHeader>
              {(onProfileClick || onDisconnect) && (
                <div className="mt-2 flex flex-col gap-1 border-t border-border pt-3">
                  {onProfileClick && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={onProfileClick}
                      className="min-h-11 justify-start"
                    >
                      <User aria-hidden="true" />
                      Mi perfil
                    </Button>
                  )}
                  {onDisconnect && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={onDisconnect}
                      className="min-h-11 justify-start text-destructive"
                    >
                      <LogOut aria-hidden="true" />
                      Cerrar sesión
                    </Button>
                  )}
                </div>
              )}
            </PopoverContent>
          </Popover>
        ) : onSignIn ? (
          <Button type="button" onClick={onSignIn} className="min-h-11">
            <User aria-hidden="true" />
            Iniciar sesión
          </Button>
        ) : null}
      </div>
    </header>
  );
}
