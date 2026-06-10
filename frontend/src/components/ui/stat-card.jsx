import * as React from "react"
import { cn } from "../../lib/utils"
import { Card } from "./card"

/**
 * StatCard - Display a metric with label and optional trend
 */
const StatCard = React.forwardRef(({
  className,
  label,
  value,
  icon: Icon,
  trend,
  variant = "default",
  ...props
}, ref) => {
  const variantStyles = {
    default: "text-slate-100",
    success: "text-emerald-400",
    warning: "text-amber-400",
    error: "text-rose-400",
    primary: "text-indigo-400",
  }

  return (
    <Card ref={ref} className={cn("p-4", className)} {...props}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className={cn("text-2xl font-bold mt-1", variantStyles[variant])}>
            {value}
          </p>
          {trend && (
            <p className={cn(
              "text-xs mt-1",
              trend > 0 ? "text-emerald-400" : trend < 0 ? "text-rose-400" : "text-slate-400"
            )}>
              {trend > 0 ? "+" : ""}{trend}%
            </p>
          )}
        </div>
        {Icon && (
          <div className="p-2 rounded-lg bg-slate-800">
            <Icon className={cn("w-5 h-5", variantStyles[variant])} />
          </div>
        )}
      </div>
    </Card>
  )
})
StatCard.displayName = "StatCard"

export { StatCard }
