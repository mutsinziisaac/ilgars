import { ChevronDown, Home, Plus } from "lucide-react"
import { NavLink } from "react-router-dom"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { WALLET_BALANCE_MZN, formatMzn } from "@/lib/fleet"
import { cn } from "@/lib/utils"

import { NAV_ITEMS } from "./nav-config"

const MOCK_USER = {
  name: "Trans Limpopo",
  chestId: "100184",
  initials: "TL",
}

const MOCK_WALLET = {
  whole: formatMzn(Math.floor(WALLET_BALANCE_MZN)),
  cents: "00",
}

export function AppSidebar() {
  return (
    <aside className="sticky top-0 flex h-svh w-60 shrink-0 flex-col gap-3 bg-sidebar p-3 text-sidebar-foreground">
      <div className="flex items-center gap-2.5 px-1 pt-1">
        <div className="flex size-9 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
          <Home className="size-4" />
        </div>
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="text-sm font-semibold">ILGARS</span>
          <span className="text-[9px] font-medium tracking-widest text-sidebar-foreground/60 uppercase">
            Transporter portal
          </span>
        </div>
      </div>

      <div className="rounded-xl bg-sidebar-accent p-3 text-sidebar-accent-foreground">
        <p className="text-[9px] font-medium tracking-widest text-sidebar-foreground/60 uppercase">
          Wallet · MZN
        </p>
        <p className="mt-0.5 mb-2.5 font-semibold tracking-tight">
          <span className="text-2xl">{MOCK_WALLET.whole}</span>
          <span className="text-sm text-sidebar-foreground/70">
            .{MOCK_WALLET.cents}
          </span>
        </p>
        <Button variant="secondary" size="sm" className="w-full">
          <Plus />
          Top up wallet
        </Button>
      </div>

      <nav className="flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                cn(
                  "group/nav relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent/70 text-sidebar-foreground"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span
                      aria-hidden
                      className="absolute top-1 bottom-1 -left-3 w-0.5 rounded-r bg-secondary"
                    />
                  )}
                  <Icon className="size-4 shrink-0" />
                  <span className="flex-1 text-[13px]">{item.label}</span>
                  {item.badge !== undefined && (
                    <Badge
                      variant="secondary"
                      className="h-4 min-w-4 px-1 text-[10px]"
                    >
                      {item.badge}
                    </Badge>
                  )}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      <div className="flex-1" />

      <button
        type="button"
        className="flex items-center gap-2.5 rounded-xl bg-sidebar-accent/40 px-2.5 py-2 text-left transition-colors hover:bg-sidebar-accent/70"
      >
        <Avatar className="size-8 bg-secondary">
          <AvatarFallback className="bg-secondary text-xs font-semibold text-secondary-foreground">
            {MOCK_USER.initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate text-[13px] font-medium text-sidebar-foreground">
            {MOCK_USER.name}
          </span>
          <span className="truncate text-[10px] text-sidebar-foreground/60">
            Chest ID {MOCK_USER.chestId}
          </span>
        </div>
        <ChevronDown className="size-3.5 text-sidebar-foreground/60" />
      </button>
    </aside>
  )
}
