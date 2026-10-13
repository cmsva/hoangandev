"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { useTRPC } from "@/trpc/client"
import { useQuery } from "@tanstack/react-query"
import { IconSearch } from "@/components/icons"
import { LanguageSwitcher } from "@/components/dashboard/language-switcher"
import { useSidebar } from "@/components/sidebar-context"
import { useSession } from "@/components/auth-session-provider"
import { NotificationBell } from "@/components/dashboard/notification-bell"
import { UserDropdown } from "@/components/dashboard/user-dropdown"

export function DashboardHeader() {
  const { theme, setTheme } = useTheme()
  const trpc = useTRPC()
  const { data: siteInfo } = useQuery(trpc.public.siteInfo.queryOptions())
  const [isMounted, setIsMounted] = useState(false)
  const { toggleMobile: toggleSidebar } = useSidebar()

  // Session resolved server-side, không refetch ở client
  const user = useSession()

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return <header className="relative z-50 flex h-14 items-center px-4 sm:px-5" suppressHydrationWarning />
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center border-b border-border/40 bg-background/95 px-4 backdrop-blur-sm sm:px-5">
      {/* ─── Left: sidebar toggle + logo + search ─── */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => toggleSidebar()}
          className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:hidden"
          aria-label="Mở/đóng menu"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 7L4 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path opacity="0.5" d="M20 12L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M20 17L4 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        <a className="flex items-center lg:hidden" href={user ? "/dashboard" : "/"}>
          <img
            alt={siteInfo?.siteTitle || "VanKhanh"}
            loading="lazy"
            width="32"
            height="32"
            className="h-8 w-auto rounded-lg"
            src={
              siteInfo?.logoLight ||
              siteInfo?.logoDark ||
              "https://cmstdev.vn/uploads/logo-0e7c1aeb-2d48-4a47-b178-da4c731cfd6f.png"
            }
          />
        </a>

        <button className="relative hidden h-9 w-64 items-center rounded-lg border border-input bg-muted/40 ps-9 pe-4 text-start text-sm text-muted-foreground/50 transition-colors hover:bg-muted/60 sm:flex">
          <IconSearch size={16} className="absolute ltr:left-3 rtl:right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
          Tìm kiếm...
          <kbd className="pointer-events-none absolute ltr:right-3 rtl:left-3 top-1/2 -translate-y-1/2 rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* ─── Right: theme + lang + (chips, bell) + user ─── */}
      <div className="ml-auto flex items-center gap-2 sm:gap-2.5">
        <div className="flex items-center gap-1 rounded-full border border-border/50 bg-accent/40 p-1 backdrop-blur-md dark:bg-card/50">
          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="relative inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-accent hover:text-foreground"
            aria-label="Chuyển đổi giao diện"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="hidden h-5 w-5 dark:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M0 0h24v24H0z" stroke="none" fill="none" />
              <path d="M14.828 14.828a4 4 0 1 0 -5.656 -5.656a4 4 0 0 0 5.656 5.656z" />
              <path d="M6.343 17.657l-1.414 1.414" /><path d="M6.343 6.343l-1.414 -1.414" />
              <path d="M17.657 6.343l1.414 -1.414" /><path d="M17.657 17.657l1.414 1.414" />
              <path d="M4 12h-2" /><path d="M12 4v-2" /><path d="M20 12h2" /><path d="M12 20v2" />
            </svg>
            <svg xmlns="http://www.w3.org/2000/svg" className="block h-5 w-5 dark:hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" />
            </svg>
          </button>
          <LanguageSwitcher />
        </div>

        {/* User-only chips & notifications */}
        {user && (
          <>
            <PromotionChip />
            <NotificationBell />

            <div className="ml-1 mr-1 hidden items-center gap-2.5 xl:flex">
              <a
                className="group flex items-center gap-2 rounded-full border border-border/60 bg-background py-1.5 pl-1.5 pr-3 transition-all hover:border-amber-500/40 hover:bg-accent/60 dark:bg-card"
                href="/customer/rewards"
              >
                <div className="flex size-[26px] items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                    <rect x="3" y="8" width="18" height="4" rx="1" />
                    <line x1="12" y1="8" x2="12" y2="21" />
                    <path d="M19 12v7a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-7" />
                    <path d="M7.5 8a2.5 2.5 0 0 1 0 -5a4.8 8 0 0 1 4.5 5a4.8 8 0 0 1 4.5 -5a2.5 2.5 0 0 1 0 5" />
                  </svg>
                </div>
                <div className="flex flex-col justify-center">
                  <span className="mb-0.5 text-[9px] font-semibold uppercase leading-none tracking-wider text-muted-foreground">Điểm thưởng</span>
                  <span className="text-xs font-bold leading-none text-foreground">{user.rewardPoints ?? 0}</span>
                </div>
              </a>

              <a
                className="group relative flex items-center gap-2 overflow-hidden rounded-full border border-border/60 bg-background py-1.5 pl-1.5 pr-1.5 transition-all hover:border-primary/40 hover:bg-accent/60 dark:bg-card"
                href="/customer/deposit"
              >
                <div className="relative z-10 flex size-[26px] items-center justify-center rounded-full bg-gradient-to-br from-primary to-blue-600 text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" className="size-3.5">
                    <path opacity="0.3" d="M2.25 4.75V13.25C2.25 14.355 3.145 15.25 4.25 15.25H14.75C15.302 15.25 15.75 14.802 15.75 14.25V7.75C15.75 7.198 15.302 6.75 14.75 6.75H4.25C3.145 6.75 2.25 5.855 2.25 4.75Z" fill="currentColor" />
                    <path d="M2.25 4.75V13.25C2.25 14.355 3.145 15.25 4.25 15.25H14.75C15.302 15.25 15.75 14.802 15.75 14.25V7.75C15.75 7.198 15.302 6.75 14.75 6.75H4.25C3.145 6.75 2.25 5.855 2.25 4.75Z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    <path d="M2.25 4.75C2.25 3.645 3.145 2.75 4.25 2.75" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    <path d="M12.5 12C13.052 12 13.5 11.552 13.5 11C13.5 10.448 13.052 10 12.5 10C11.948 10 11.5 10.448 11.5 11C11.5 11.552 11.948 12 12.5 12Z" fill="currentColor" />
                  </svg>
                </div>
                <div className="relative z-10 flex flex-col justify-center pr-1">
                  <span className="mb-0.5 text-[9px] font-semibold uppercase leading-none tracking-wider text-muted-foreground">Số dư ví</span>
                  <span className="text-xs font-bold leading-none text-foreground">{user.money ? `${user.money.toLocaleString()}đ` : "0đ"}</span>
                </div>
                <div className="relative z-10 -ml-5 flex size-[26px] items-center justify-center rounded-full bg-primary text-white opacity-0 transition-all duration-300 group-hover:ml-0 group-hover:opacity-100">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" /><path d="M12 5v14" />
                  </svg>
                </div>
              </a>
            </div>
          </>
        )}

        {/* User dropdown (logged in) or Login/Register CTAs (guest) */}
        <UserDropdown />
      </div>
    </header>
  )
}

// ─── PromotionChip (chỉ render khi đã login) ────────────────────────────────
function PromotionChip() {
  const trpc = useTRPC()
  const { data } = useQuery({
    ...trpc.deposit.getPromotions.queryOptions(),
    refetchOnWindowFocus: false,
    staleTime: 5 * 60_000,
  })
  const promos = (data || []) as Array<{ amount: number; discount: number }>
  if (promos.length === 0) return null
  const maxDiscount = Math.max(...promos.map((p) => p.discount || 0))
  return (
    <a
      href="/customer/deposit"
      className="relative hidden size-8 items-center justify-center rounded-full text-muted-foreground transition-all hover:scale-[1.08] hover:bg-accent hover:text-foreground md:inline-flex"
      aria-label={`${promos.length} khuyến mãi đang có`}
      title={`${promos.length} khuyến mãi (cao nhất +${maxDiscount}%)`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="size-[18px] text-rose-500">
        <rect x="3" y="8" width="18" height="4" rx="1" />
        <line x1="12" y1="8" x2="12" y2="21" />
        <path d="M19 12v7a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-7" />
        <path d="M7.5 8a2.5 2.5 0 0 1 0 -5a4.8 8 0 0 1 4.5 5a4.8 8 0 0 1 4.5 -5a2.5 2.5 0 0 1 0 5" />
      </svg>
      <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[16px] -translate-y-1/4 translate-x-1/4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold leading-4 text-white shadow-sm ring-2 ring-background">
        {promos.length > 99 ? "99+" : promos.length}
      </span>
    </a>
  )
}
