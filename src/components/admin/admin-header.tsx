"use client"

import Link from "next/link"
import { useSidebar } from "@/components/sidebar-context"
import { useSession } from "@/components/auth-session-provider"
import { IconBell, IconLogout } from "@/components/icons"

export function AdminHeader() {
  const { toggleMobile: toggleSidebar } = useSidebar()
  const user = useSession()
  const username = user?.username || "admin"

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-sm sm:px-6">
      {/* Mobile / collapse toggle */}
      <button
        aria-label="Toggle sidebar"
        onClick={() => toggleSidebar()}
        className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-foreground transition-colors hover:bg-accent lg:hidden"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4"
          aria-hidden="true"
        >
          <line x1="4" x2="20" y1="6" y2="6" />
          <line x1="4" x2="20" y1="12" y2="12" />
          <line x1="4" x2="20" y1="18" y2="18" />
        </svg>
      </button>

      {/* Title */}
      <div className="flex items-center gap-2">
        <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary">
          Admin
        </span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side */}
      <div className="flex items-center gap-2">
        <button
          aria-label="Notifications"
          className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
        >
          <IconBell size={18} />
        </button>

        <Link
          href="/dashboard"
          className="hidden sm:flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
        >
          Trang người dùng
        </Link>

        <Link
          href="/customer/profile"
          className="flex h-9 items-center gap-2 rounded-full border border-border bg-card pl-1 pr-3 text-xs font-medium text-foreground transition-colors hover:bg-accent"
        >
          <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold uppercase">
            {username.slice(0, 2)}
          </span>
          <span className="hidden sm:inline">{username}</span>
        </Link>
      </div>
    </header>
  )
}
