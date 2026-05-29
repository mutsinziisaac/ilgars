import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Tappable card used as the mobile fallback for wide data tables. Renders a
 * row's key fields stacked vertically. Use `onActivate` for the primary
 * navigation (it also wires up Enter/Space keyboard handling); place inner
 * action buttons in `children` and call `event.stopPropagation()` on them.
 */
function DataCard({
  className,
  onActivate,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  onActivate?: () => void
}) {
  return (
    <div
      role={onActivate ? "button" : undefined}
      tabIndex={onActivate ? 0 : undefined}
      onClick={onActivate}
      onKeyDown={
        onActivate
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                onActivate()
              }
            }
          : undefined
      }
      className={cn(
        "flex w-full flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors outline-none",
        onActivate &&
          "cursor-pointer hover:border-primary/40 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function DataCardField({
  label,
  children,
  className,
}: {
  label: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
        {label}
      </p>
      <div className="mt-0.5 text-sm text-foreground">{children}</div>
    </div>
  )
}

export { DataCard, DataCardField }
