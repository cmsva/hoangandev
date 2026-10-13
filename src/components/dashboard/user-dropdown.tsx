"use client"

/**
 * UserDropdown — Avatar + dropdown menu trong header.
 *
 *  - Logged in: profile + balance/điểm thưởng + grid dịch vụ thật + tài khoản + logout.
 *  - Guest: 2 nút Đăng nhập + Đăng ký (không có dropdown).
 *  - Mobile: thêm chuông thông báo (desktop có bell riêng ở header).
 *
 * Icon dùng bộ Nucleo từ @/components/icons (theo rule dự án).
 */
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useSession } from "@/components/auth-session-provider"
import { NotificationPanel, useNotificationUnread } from "@/components/dashboard/notification-bell"
import { useTRPC } from "@/trpc/client"
import { toast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"
import {
  IconClock,
  IconDollarCircle,
  IconUsers,
  IconCreditCard,
  IconQrCode,
  IconTicket,
  IconShield,
  IconLogout,
  IconBell,
  IconWallet,
  IconDocument,
} from "@/components/icons"

// ─── User utility / account pages (KHÔNG đưa dịch vụ vào dropdown) ───────────
const UTILITY_LINKS = [
  { href: "/customer/profile", label: "Hồ sơ", Icon: IconUsers },
  { href: "/customer/deposit", label: "Nạp tiền", Icon: IconCreditCard },
  { href: "/customer/card", label: "Nạp thẻ", Icon: IconQrCode },
  { href: "/customer/history", label: "Lịch sử", Icon: IconClock },
  { href: "/customer/transactions", label: "Giao dịch", Icon: IconWallet },
  { href: "/customer/logs", label: "Nhật ký", Icon: IconDocument },
  { href: "/customer/affiliate", label: "Tiếp thị", Icon: IconDollarCircle },
  { href: "/customer/history/ticket", label: "Hỗ trợ", Icon: IconTicket },
] as const

// ─── Helpers ────────────────────────────────────────────────────────────────
function formatVnd(n: number): string {
  return `${(n || 0).toLocaleString("vi-VN")}đ`
}

function getInitials(user: { fullname: string | null; username: string }): string {
  const source = user.fullname?.trim() || user.username
  return source
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

// ─── Quick action card ─────────────────────────────────────────────────────
function QuickAction({
  href,
  label,
  Icon,
  onClick,
}: {
  href: string
  label: string
  Icon: React.ComponentType<{ size?: number; className?: string }>
  onClick?: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="group flex flex-col items-center gap-1.5 rounded-lg p-2 transition-colors hover:bg-accent"
    >
      <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all group-hover:bg-primary group-hover:text-primary-foreground">
        <Icon size={18} />
      </div>
      <span className="text-center text-[10px] font-medium leading-tight text-muted-foreground transition-colors group-hover:text-primary">
        {label}
      </span>
    </Link>
  )
}

// ─── Stat card (Balance / Rewards) ─────────────────────────────────────────
function StatCard({
  href,
  label,
  value,
  accent,
  icon,
  onClick,
}: {
  href: string
  label: string
  value: string
  accent: "primary" | "amber"
  icon: React.ReactNode
  onClick?: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border/60 bg-muted/40 p-3 transition-all hover:shadow-md",
        accent === "primary"
          ? "hover:border-primary/40 hover:ring-1 hover:ring-primary/20"
          : "hover:border-amber-500/40 hover:ring-1 hover:ring-amber-500/20"
      )}
    >
      <div className="relative z-10 flex flex-col gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span
          className={cn(
            "text-base font-bold leading-none",
            accent === "primary" ? "text-primary" : "text-amber-600 dark:text-amber-400"
          )}
        >
          {value}
        </span>
      </div>
      <div
        className={cn(
          "absolute -bottom-2 -right-2 flex size-12 items-center justify-center transition-all duration-300 group-hover:scale-110",
          accent === "primary"
            ? "text-primary/10 group-hover:text-primary/25"
            : "text-amber-500/10 group-hover:text-amber-500/25"
        )}
      >
        {icon}
      </div>
    </Link>
  )
}

// ─── Main component ────────────────────────────────────────────────────────
export function UserDropdown() {
  const router = useRouter()
  const trpc = useTRPC()
  const user = useSession()
  const [open, setOpen] = useState(false)
  // "profile" = mặc định, "notifications" = panel thông báo (mobile)
  const [view, setView] = useState<"profile" | "notifications">("profile")
  const { unread } = useNotificationUnread(!!user)

  const logoutMutation = useMutation(
    trpc.auth.logout.mutationOptions({
      onSuccess: () => {
        toast.success("Đã đăng xuất")
        setOpen(false)
        router.push("/")
        router.refresh()
      },
      onError: () => toast.error("Đăng xuất thất bại"),
    })
  )

  // Reset về profile view mỗi lần đóng dropdown
  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) setView("profile")
  }

  // ─── Guest state ────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="flex items-center gap-1.5">
        <Link
          href="/authentication/login"
          className="inline-flex h-9 items-center rounded-full px-4 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
        >
          Đăng nhập
        </Link>
        <Link
          href="/authentication/register"
          className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90"
        >
          Đăng ký
        </Link>
      </div>
    )
  }

  // ─── Logged in state ───────────────────────────────────────────────────
  const initials = getInitials(user)
  const closeAndPush = () => setOpen(false)

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative inline-flex size-9 items-center justify-center overflow-hidden rounded-full border border-border/60 bg-background p-[2px] ring-2 ring-transparent transition-all hover:ring-primary/30"
          aria-label="Tài khoản"
        >
          {user.avatar ? (
            <Image
              src={user.avatar}
              alt={user.fullname || user.username}
              width={36}
              height={36}
              className="size-full rounded-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-primary text-[11px] font-bold text-primary-foreground">
              {initials}
            </div>
          )}
          <span className="absolute bottom-[2px] right-[2px] block size-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={10}
        className="w-[340px] overflow-hidden border-none p-0.5 shadow-2xl"
      >
        {view === "notifications" ? (
          /* ─── Notifications view (mobile) ─── */
          <div>
            <div className="flex items-center gap-2 border-b border-border px-2 py-2">
              <button
                type="button"
                onClick={() => setView("profile")}
                className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Quay lại"
              >
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <span className="text-sm font-semibold">Quay lại tài khoản</span>
            </div>
            <NotificationPanel
              active={open && view === "notifications"}
              onNavigate={() => setOpen(false)}
              bodyClassName="h-[360px]"
            />
          </div>
        ) : (
          <>
            {/* Profile header */}
            <div className="flex items-center justify-between gap-2.5 p-3.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="relative shrink-0">
                  {user.avatar ? (
                    <Image
                      src={user.avatar}
                      alt={user.fullname || user.username}
                      width={40}
                      height={40}
                      className="size-10 rounded-full object-cover ring-2 ring-border/40"
                    />
                  ) : (
                    <div className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-primary text-sm font-bold text-primary-foreground ring-2 ring-border/40">
                      {initials}
                    </div>
                  )}
                  <span className="absolute bottom-0 right-0 block size-3 rounded-full bg-emerald-500 ring-2 ring-background" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-sm font-bold text-foreground">
                    {user.fullname || user.username}
                  </h4>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                </div>
              </div>

              {/* Mobile-only notification bell (desktop có bell riêng ở header) */}
              <button
                type="button"
                onClick={() => setView("notifications")}
                className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/60 text-foreground transition-colors hover:bg-accent md:hidden"
                aria-label="Thông báo"
              >
                <IconBell size={18} />
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[16px] -translate-y-1/4 translate-x-1/4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-4 text-white ring-2 ring-background">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </button>
            </div>

            {/* Body */}
            <div className="space-y-3 bg-card p-3 pt-0">
              {/* Stats: balance + reward points */}
              <div className="grid grid-cols-2 gap-2">
                <StatCard
                  href="/customer/deposit"
                  label="Số dư"
                  value={formatVnd(user.money)}
                  accent="primary"
                  icon={
                    <svg viewBox="0 0 24 24" fill="currentColor" className="size-12">
                      <path d="M3 7v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2H5a2 2 0 0 1-2-2z" />
                    </svg>
                  }
                  onClick={closeAndPush}
                />
                <StatCard
                  href="/customer/rewards"
                  label="Điểm thưởng"
                  value={String(user.rewardPoints || 0)}
                  accent="amber"
                  icon={
                    <svg viewBox="0 0 24 24" fill="currentColor" className="size-12">
                      <rect x="3" y="8" width="18" height="4" rx="1" />
                      <rect x="5" y="12" width="14" height="9" rx="1" />
                    </svg>
                  }
                  onClick={closeAndPush}
                />
              </div>

              {/* Tiện ích & trang cá nhân */}
              <div>
                <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Tiện ích
                </p>
                <div className="grid grid-cols-4 gap-1">
                  {UTILITY_LINKS.map((u) => (
                    <QuickAction key={u.href} href={u.href} label={u.label} Icon={u.Icon} onClick={closeAndPush} />
                  ))}
                </div>
              </div>

              {/* Admin link */}
              {user.admin === 1 && (
                <Link
                  href="/adminPanel/dashboard"
                  onClick={closeAndPush}
                  className="flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary/10"
                >
                  <IconShield size={16} />
                  <span>Vào Admin Panel</span>
                </Link>
              )}

              {/* Logout */}
              <button
                type="button"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 py-2 text-xs font-bold text-rose-600 transition-colors hover:bg-rose-500/20 disabled:opacity-60 dark:text-rose-400"
              >
                <IconLogout size={16} />
                <span>{logoutMutation.isPending ? "Đang đăng xuất..." : "Đăng xuất"}</span>
              </button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
