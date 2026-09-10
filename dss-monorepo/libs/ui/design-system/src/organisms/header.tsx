import * as React from "react"
import { cn } from "cn"
import { Search, Bell, Menu, Terminal, User } from "lucide-react"

import { Button } from "../atoms/button"
import { InputGroup, InputGroupInput, InputGroupAddon } from "../atoms/input-group"
import { Avatar, AvatarFallback, AvatarImage } from "../atoms/avatar"
import { Badge } from "../atoms/badge"
import { 
  Popover, 
  PopoverTrigger, 
  PopoverContent, 
  PopoverHeader, 
  PopoverTitle, 
  PopoverDescription 
} from "../atoms/popover"

export interface HeaderProps extends React.HTMLAttributes<HTMLElement> {
  user?: {
    name: string
    email: string
    avatarUrl?: string
  }
  onMenuClick?: () => void
  onSearch?: (query: string) => void
  onDisconnect?: () => void
}

export function Header({ 
  className, 
  user, 
  onMenuClick, 
  onSearch,
  onDisconnect,
  ...props 
}: HeaderProps) {
  const [searchQuery, setSearchQuery] = React.useState("")

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    if (onSearch) {
      onSearch(e.target.value)
    }
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-50 flex w-full h-16 items-center justify-between px-4 sm:px-6 lg:px-8",
        "bg-background/80 backdrop-blur-md border-b border-primary/20",
        "shadow-[0_0_15px_theme(colors.primary.DEFAULT/20%)]",
        className
      )}
      {...props}
    >
      {/* Left: Logo & Mobile Menu */}
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onMenuClick} 
          className="lg:hidden text-primary hover:text-primary hover:bg-primary/20"
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
        <div className="flex items-center gap-2 font-bold text-lg text-primary tracking-widest uppercase">
          <Terminal className="h-6 w-6 text-primary drop-shadow-[0_0_5px_theme(colors.primary.DEFAULT)]" />
          <span className="hidden sm:inline-block drop-shadow-[0_0_5px_theme(colors.primary.DEFAULT)]">
            SYS.ADMIN
          </span>
        </div>
      </div>

      {/* Middle: Search/Command */}
      <div className="flex-1 max-w-md mx-4 hidden md:block">
        <InputGroup className="bg-background/50 border-primary/30 focus-within:border-primary focus-within:shadow-[0_0_10px_theme(colors.primary.DEFAULT/30%)] transition-all">
          <InputGroupAddon>
            <Search className="h-4 w-4 text-primary/70" />
          </InputGroupAddon>
          <InputGroupInput 
            placeholder="Search commands or data..." 
            value={searchQuery}
            onChange={handleSearchChange}
            className="text-primary placeholder:text-primary/50" 
          />
          <InputGroupAddon align="inline-end">
            <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-primary/30 bg-primary/10 px-1.5 font-mono text-[10px] font-medium text-primary">
              <span className="text-xs">⌘</span>K
            </kbd>
          </InputGroupAddon>
        </InputGroup>
      </div>

      {/* Right: Notifications & Profile */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="relative text-primary hover:text-primary hover:bg-primary/20">
          <Bell className="h-5 w-5" />
          <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center animate-pulse border-none">
            3
          </Badge>
          <span className="sr-only">Notifications</span>
        </Button>

        {user ? (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full p-0">
                <Avatar className="h-8 w-8 ring-2 ring-primary/50 shadow-[0_0_10px_theme(colors.primary.DEFAULT/30%)] hover:ring-primary transition-all">
                  {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
                  <AvatarFallback className="bg-primary/20 text-primary">{user.name.charAt(0)}</AvatarFallback>
                </Avatar>
              </Button>
            </PopoverTrigger>
            <PopoverContent 
              className="w-56 border-primary/30 bg-background/95 backdrop-blur-md shadow-[0_0_15px_theme(colors.primary.DEFAULT/20%)]" 
              align="end"
            >
              <PopoverHeader>
                <PopoverTitle className="text-primary">{user.name}</PopoverTitle>
                <PopoverDescription className="text-primary/70">{user.email}</PopoverDescription>
              </PopoverHeader>
              <div className="mt-2 flex flex-col gap-1 border-t border-primary/20 pt-2">
                <Button variant="ghost" className="justify-start text-primary hover:bg-primary/20">Profile Settings</Button>
                <Button variant="ghost" className="justify-start text-primary hover:bg-primary/20">System Logs</Button>
                <Button variant="ghost" onClick={onDisconnect} className="justify-start text-destructive hover:bg-destructive/20 mt-1">Disconnect</Button>
              </div>
            </PopoverContent>
          </Popover>
        ) : (
          <Button className="bg-primary/20 text-primary border border-primary/50 hover:bg-primary hover:text-primary-foreground shadow-[0_0_10px_theme(colors.primary.DEFAULT/30%)] transition-all">
            <User className="h-4 w-4 mr-2" />
            INITIALIZE
          </Button>
        )}
      </div>
    </header>
  )
}
