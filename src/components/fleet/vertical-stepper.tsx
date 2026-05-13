import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

export type Step<K extends string = string> = {
  key: K
  label: string
  description?: string
}

export function VerticalStepper<K extends string>({
  steps,
  currentKey,
  onJump,
  className,
}: {
  steps: readonly Step<K>[]
  currentKey: K
  onJump?: (key: K) => void
  className?: string
}) {
  const currentIndex = steps.findIndex((s) => s.key === currentKey)

  return (
    <ol className={cn("flex flex-col", className)}>
      {steps.map((step, i) => {
        const isComplete = i < currentIndex
        const isActive = i === currentIndex
        const isLast = i === steps.length - 1
        const canJump = isComplete && onJump !== undefined

        const Wrapper: "button" | "div" = canJump ? "button" : "div"

        return (
          <li key={step.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition-all duration-200",
                  isComplete && "border-primary bg-primary text-primary-foreground",
                  isActive &&
                    "border-primary bg-card text-primary ring-4 ring-primary/10",
                  !isComplete &&
                    !isActive &&
                    "border-muted-foreground/20 bg-muted/40 text-muted-foreground/50"
                )}
                aria-hidden
              >
                {isComplete ? (
                  <Check className="size-3.5" strokeWidth={3} />
                ) : (
                  <span>{i + 1}</span>
                )}
              </div>
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
                    isActive ? "text-muted-foreground" : "text-muted-foreground/45"
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
  )
}
