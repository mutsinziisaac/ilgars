import { createContext, useContext } from "react"

type MobileNavContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
}

export const MobileNavContext = createContext<MobileNavContextValue | null>(
  null
)

export function useMobileNav() {
  const context = useContext(MobileNavContext)
  if (!context) {
    throw new Error("useMobileNav must be used within a MobileNavContext")
  }
  return context
}
