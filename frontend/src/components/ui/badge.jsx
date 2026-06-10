import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "../../lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20",
        success: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
        warning: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
        error: "bg-rose-500/10 text-rose-400 border border-rose-500/20",
        secondary: "bg-slate-800 text-slate-300 border border-slate-700",
        outline: "border border-slate-700 text-slate-300",
        track2: "bg-violet-500/10 text-violet-400 border border-violet-500/20",
        trace: "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({ className, variant, ...props }) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
