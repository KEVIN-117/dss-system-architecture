import * as React from "react"
import { cn } from "cn"
import { Typography } from "../atoms/typography"
import { Badge } from "../atoms/badge"

export interface MetricIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  isCritical?: boolean;
}

export const MetricIndicator = React.forwardRef<HTMLDivElement, MetricIndicatorProps>(
  ({ className, title, value, trend, trendValue, isCritical, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "group relative flex flex-col gap-2 rounded-xl bg-card/40 backdrop-blur-md p-6 border border-primary/20 overflow-hidden",
          "shadow-[0_4px_20px_theme(colors.primary.DEFAULT/5%)] transition-all hover:border-primary/50 hover:bg-card/60",
          isCritical && "border-destructive/50 shadow-[0_4px_30px_theme(colors.destructive.DEFAULT/15%)]",
          className
        )}
        {...props}
      >
        {/* Subtle background glow */}
        <div 
          className={cn(
            "absolute -right-12 -top-12 h-32 w-32 rounded-full blur-3xl opacity-20 pointer-events-none transition-opacity group-hover:opacity-40",
            isCritical ? "bg-destructive" : "bg-primary"
          )} 
        />
        
        <div className="flex items-center justify-between z-10">
          <Typography variant="small" className="text-muted-foreground uppercase tracking-widest font-heading">
            {title}
          </Typography>
          {trendValue && (
            <Badge 
              variant={trend === 'down' ? (isCritical ? 'destructive' : 'default') : trend === 'up' ? 'default' : 'secondary'}
              className={cn(
                "font-mono text-xs shadow-sm",
                trend === 'down' && !isCritical && "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30",
                trend === 'up' && !isCritical && "bg-primary/20 text-primary hover:bg-primary/30"
              )}
            >
              {trend === 'up' && '↑ '}
              {trend === 'down' && '↓ '}
              {trendValue}
            </Badge>
          )}
        </div>
        
        <div className="mt-2 z-10 flex items-baseline gap-2">
          <Typography 
            variant="h2" 
            className={cn(
              "border-none pb-0 text-5xl tracking-tighter", 
              isCritical ? "text-destructive drop-shadow-[0_0_8px_theme(colors.destructive.DEFAULT/50%)]" : "text-foreground drop-shadow-[0_0_8px_theme(colors.primary.DEFAULT/20%)]"
            )}
          >
            {value}
          </Typography>
        </div>
        
        {isCritical && (
          <div className="absolute bottom-0 left-0 h-1 w-full bg-destructive/80 animate-pulse" />
        )}
      </div>
    )
  }
)
MetricIndicator.displayName = "MetricIndicator"
