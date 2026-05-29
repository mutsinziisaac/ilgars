import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

export type Step<K extends string = string> = {
  key: K
  label: string
  description?: string
}

/**
 * Breakpoint at which the stepper switches from horizontal (mobile) to
 * vertical (desktop). Should match the breakpoint where the host form switches
 * from a stacked to a multi-column layout.
 */
type DesktopBreakpoint = "lg" | "xl"

const BP_CLASSES: Record<
  DesktopBreakpoint,
  { horizontal: string; vertical: string }
> = {
  lg: { horizontal: "flex lg:hidden", vertical: "hidden lg:flex" },
  xl: { horizontal: "flex xl:hidden", vertical: "hidden xl:flex" },
}

function StepCircle({
  index,
  isComplete,
  isActive,
}: {
  index: number
  isComplete: boolean
  isActive: boolean
}) {
  return (
    <div
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition-all duration-200",
        isComplete && "border-primary bg-primary text-primary-foreground",
        isActive && "border-primary bg-card text-primary ring-4 ring-primary/10",
        !isComplete &&
          !isActive &&
          "border-muted-foreground/20 bg-muted/40 text-muted-foreground/50"
      )}
      aria-hidden
    >
      {isComplete ? (
        <Check className="size-3.5" strokeWidth={3} />
      ) : (
        <span>{index + 1}</span>
      )}
    </div>
  )
}

export function VerticalStepper<K extends string>({
  steps,
  currentKey,
  onJump,
  className,
  desktopBreakpoint = "lg",
}: {
  steps: readonly Step<K>[]
  currentKey: K
  onJump?: (key: K) => void
  className?: string
  desktopBreakpoint?: DesktopBreakpoint
}) {
  const currentIndex = steps.findIndex((s) => s.key === currentKey)
  const bp = BP_CLASSES[desktopBreakpoint]

  return (
    <>
      {/* Mobile: horizontal stepper */}
      <ol className={cn("items-start", bp.horizontal, className)}>
        {steps.map((step, i) => {
          const isComplete = i < currentIndex
          const isActive = i === currentIndex
          const isFirst = i === 0
          const isLast = i === steps.length - 1
          const canJump = isComplete && onJump !== undefined

          return (
            <li
              key={step.key}
              className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
            >
              <div className="flex w-full items-center">
                <span
                  className={cn(
                    "h-px flex-1 rounded-full transition-colors duration-200",
                    isFirst && "invisible",
                    i <= currentIndex ? "bg-primary" : "bg-muted-foreground/15"
                  )}
                />
                {canJump ? (
                  <button
                    type="button"
                    onClick={() => onJump?.(step.key)}
                    aria-current={isActive ? "step" : undefined}
                    className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  >
                    <StepCircle
                      index={i}
                      isComplete={isComplete}
                      isActive={isActive}
                    />
                  </button>
                ) : (
                  <StepCircle
                    index={i}
                    isComplete={isComplete}
                    isActive={isActive}
                  />
                )}
                <span
                  className={cn(
                    "h-px flex-1 rounded-full transition-colors duration-200",
                    isLast && "invisible",
                    i < currentIndex ? "bg-primary" : "bg-muted-foreground/15"
                  )}
                />
              </div>
              <span
                className={cn(
                  "w-full truncate text-center text-[11px] leading-tight font-medium transition-colors duration-200",
                  isComplete && "text-foreground",
                  isActive && "text-primary",
                  !isComplete && !isActive && "text-muted-foreground/60"
                )}
              >
                {step.label}
              </span>
            </li>
          )
        })}
      </ol>

      {/* Desktop: vertical stepper */}
      <ol className={cn("flex-col", bp.vertical, className)}>
        {steps.map((step, i) => {
          const isComplete = i < currentIndex
          const isActive = i === currentIndex
          const isLast = i === steps.length - 1
          const canJump = isComplete && onJump !== undefined

          const Wrapper: "button" | "div" = canJump ? "button" : "div"

          return (
            <li key={step.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <StepCircle
                  index={i}
                  isComplete={isComplete}
                  isActive={isActive}
                />
                {!isLast && (
                  <div
                    className={cn(
                      "my-1 w-px flex-1 rounded-full transition-colors duration-200",
                      isComplete ? "bg-primary" : "bg-muted-foreground/15"
                    )}
                    style={{ minHeight: "1.75rem" }}
                  />
                )}
              </div>
              <Wrapper
                type={canJump ? "button" : undefined}
                onClick={canJump ? () => onJump?.(step.key) : undefined}
                disabled={canJump ? false : undefined}
                aria-current={isActive ? "step" : undefined}
                className={cn(
                  "flex flex-col gap-0.5 pt-0.5 pb-6 text-left",
                  isLast && "pb-0",
                  canJump &&
                    "cursor-pointer rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                )}
              >
                <span
                  className={cn(
                    "text-sm leading-tight font-semibold transition-colors duration-200",
                    isComplete && "text-foreground",
                    isActive && "text-primary",
                    !isComplete && !isActive && "text-muted-foreground/60"
                  )}
                >
                  {step.label}
                </span>
                {step.description && (
                  <span
                    className={cn(
                      "text-[11px] leading-tight transition-colors duration-200",
                      isActive
                        ? "text-muted-foreground"
                        : "text-muted-foreground/45"
                    )}
                  >
                    {step.description}
                  </span>
                )}
              </Wrapper>
            </li>
          )
        })}
      </ol>
    </>
  )
}
