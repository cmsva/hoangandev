"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { ConfirmDialog } from "@/components/confirm-dialog"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { toast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"
import { BalanceDialog } from "../UsersClient"

// ─── Helpers ───────────────────────────────────────────────────────────────
function formatMoney(n: number | null | undefined) {
  const num = Number(n)
  return new Intl.NumberFormat("vi-VN").format(Number.isFinite(num) ? num : 0) + "đ"
}
function formatNum(n: number | null | undefined) {
  return new Intl.NumberFormat("vi-VN").format(Number(n) || 0)
}
function formatDateTime(input: any) {
  if (!input) return "—"
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return "—"
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function timeAgo(input: any): string {
  if (!input) return "—"
  const t = new Date(input).getTime()
  if (!Number.isFinite(t)) return "—"
  const diff = Date.now() - t
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec}s trước`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} phút trước`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} giờ trước`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day} ngày trước`
  const month = Math.floor(day / 30)
  if (month < 12) return `${month} tháng trước`
  return `${Math.floor(month / 12)} năm trước`
}
function isOnline(lastSeen: string | Date | null | undefined): boolean {
  if (!lastSeen) return false
  const t = new Date(lastSeen).getTime()
  if (!Number.isFinite(t)) return false
  return Date.now() - t < 5 * 60_000
}
function initials(s: string): string {
  return (s || "?").slice(0, 2).toUpperCase()
}

// ─── Inline icons ─────────────────────────────────────────────────────────
const Ic = {
  back: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>,
  shield: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>,
  user: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  wallet: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>,
  activity: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  alert: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  check: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  cross: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  copy: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  search: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.34-4.34"/></svg>,
  arrowDown: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>,
  arrowUp: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>,
}

// ─── Tabs definition ───────────────────────────────────────────────────────
type TabKey = "profile" | "activity" | "balance" | "danger"

const TABS: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
  { key: "profile", label: "Hồ sơ", icon: Ic.user },
  { key: "activity", label: "Nhật ký hoạt động", icon: Ic.activity },
  { key: "balance", label: "Biến động số dư", icon: Ic.wallet },
  { key: "danger", label: "Bảo mật & Nguy hiểm", icon: Ic.alert },
]

// ─── Page ──────────────────────────────────────────────────────────────────
export function AdminUserDetailClient({ id }: { id: string }) {
  const router = useRouter()
  const trpc = useTRPC()
  const qc = useQueryClient()

  const userQuery = useQuery(trpc.adminUser.detail.queryOptions({ id })) as {
    data: any
    isLoading: boolean
  }

  const [activeTab, setActiveTab] = React.useState<TabKey>("profile")
  const [adjusting, setAdjusting] = React.useState(false)

  const invalidate = React.useCallback(() => {
    qc.invalidateQueries({ queryKey: trpc.adminUser.detail.queryKey() })
    qc.invalidateQueries({ queryKey: trpc.adminUser.list.queryKey() })
    qc.invalidateQueries({ queryKey: trpc.adminUser.stats.queryKey() })
    qc.invalidateQueries({ queryKey: trpc.admin.getBalanceLogs.queryKey() })
    qc.invalidateQueries({ queryKey: trpc.admin.getActivityLogs.queryKey() })
  }, [qc, trpc])

  if (userQuery.isLoading || !userQuery.data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-12 w-96 rounded-md" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    )
  }

  const u = userQuery.data
  const online = isOnline(u.lastSeen)

  return (
    <div className="space-y-6">
      {/* ─── Hero banner ─── */}
      <HeroBanner user={u} online={online} onAdjustBalance={() => setAdjusting(true)} />

      {/* ─── Stat cards ─── */}
      <StatGrid user={u} />

      {/* ─── Tabs ─── */}
      <nav className="border-b border-border">
        <ul className="-mb-px flex flex-wrap items-center gap-1">
          {TABS.map((tab) => {
            const active = activeTab === tab.key
            return (
              <li key={tab.key}>
                <button
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-all",
                    active
                      ? "border-b-2 border-primary text-primary"
                      : "border-b-2 border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className={cn(active ? "text-primary" : "text-muted-foreground")}>{tab.icon}</span>
                  {tab.label}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* ─── Tab content ─── */}
      <div>
        {activeTab === "profile" && <ProfileTab user={u} onSaved={invalidate} />}
        {activeTab === "activity" && <ActivityLogsTab userId={u.id} />}
        {activeTab === "balance" && <BalanceLogsTab userId={u.id} />}
        {activeTab === "danger" && (
          <DangerTab
            user={u}
            onSaved={invalidate}
            onDeleted={() => router.push("/adminPanel/users")}
          />
        )}
      </div>

      {adjusting && (
        <BalanceDialog user={u} onClose={() => setAdjusting(false)} onSaved={invalidate} />
      )}
    </div>
  )
}

// ═══ HERO BANNER ═══════════════════════════════════════════════════════════
function HeroBanner({
  user,
  online,
  onAdjustBalance,
}: {
  user: any
  online: boolean
  onAdjustBalance: () => void
}) {
  function copyId() {
    navigator.clipboard
      .writeText(user.id)
      .then(() => toast.success("Đã sao chép ID"))
      .catch(() => toast.error("Sao chép thất bại"))
  }
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* Decorative gradient strip */}
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-r from-primary/15 via-primary/5 to-transparent" />
      <div className="relative flex flex-col gap-5 p-6 lg:flex-row lg:items-end lg:justify-between">
        {/* Breadcrumb + back */}
        <div className="absolute left-6 top-5 right-6 flex items-center justify-between text-xs text-muted-foreground">
          <Link href="/adminPanel/users" className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/80 px-2.5 py-1 text-xs font-medium backdrop-blur transition-colors hover:text-foreground">
            {Ic.back} Khách hàng
          </Link>
          <button
            type="button"
            onClick={copyId}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/80 px-2 py-1 font-mono text-[11px] backdrop-blur transition-colors hover:text-foreground"
            title={user.id}
          >
            {Ic.copy}
            {user.id.slice(0, 6)}…{user.id.slice(-4)}
          </button>
        </div>

        {/* Avatar + identity */}
        <div className="flex items-center gap-4 pt-12">
          <div className="relative shrink-0">
            <div className="size-20 overflow-hidden rounded-2xl border-4 border-background bg-muted shadow-lg sm:size-24">
              {user.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatar} alt={user.username} className="size-full object-cover" />
              ) : (
                <div className="flex size-full items-center justify-center bg-gradient-to-br from-primary to-primary/60 text-3xl font-black text-primary-foreground">
                  {initials(user.username)}
                </div>
              )}
            </div>
            <span
              className={cn(
                "absolute -bottom-0.5 -right-0.5 size-5 rounded-full border-[3px] border-background",
                online ? "animate-pulse bg-emerald-500" : "bg-muted-foreground/40"
              )}
            />
          </div>

          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-bold tracking-tight">{user.username}</h1>
              {user.admin === 1 && (
                <span className="inline-flex items-center gap-1 rounded-md bg-purple-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-purple-600">
                  {Ic.shield} Admin
                </span>
              )}
              {user.banned === 1 ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-rose-600">
                  Đã khóa
                </span>
              ) : online ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-600">
                  <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" /> Online
                </span>
              ) : (
                <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  Offline
                </span>
              )}
              {user.status2fa === 1 && (
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-600">
                  2FA
                </span>
              )}
            </div>
            {user.fullname && (
              <p className="truncate text-sm font-medium text-foreground/80">{user.fullname}</p>
            )}
            <p className="truncate text-xs text-muted-foreground">
              {user.email} · Tham gia {formatDateTime(user.createdAt)}
            </p>
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <Button onClick={onAdjustBalance} size="sm" className="gap-1.5">
            {Ic.wallet} Điều chỉnh số dư
          </Button>
        </div>
      </div>
    </div>
  )
}

// ═══ STAT GRID ═════════════════════════════════════════════════════════════
function StatGrid({ user }: { user: any }) {
  const cards = [
    {
      label: "Số dư",
      value: formatMoney(user.money),
      color: "text-emerald-600",
      bg: "bg-emerald-500/10",
      icon: Ic.wallet,
    },
    {
      label: "Tổng đã nạp",
      value: formatMoney(user.totalMoney),
      color: "text-blue-600",
      bg: "bg-blue-500/10",
      icon: Ic.arrowDown,
    },
    {
      label: "Hoa hồng",
      value: formatMoney(user.refMoney),
      color: "text-violet-600",
      bg: "bg-violet-500/10",
      icon: Ic.arrowUp,
    },
    {
      label: "Reward Points",
      value: formatNum(user.rewardPoints ?? 0),
      color: "text-amber-600",
      bg: "bg-amber-500/10",
      icon: <span className="text-base">★</span>,
    },
    {
      label: "Đơn mã nguồn",
      value: formatNum(user.stats.productOrders),
      color: "text-cyan-600",
      bg: "bg-cyan-500/10",
      icon: <span className="text-base">⌥</span>,
    },
    {
      label: "Đơn domain",
      value: formatNum(user.stats.domainOrders),
      color: "text-pink-600",
      bg: "bg-pink-500/10",
      icon: <span className="text-base">@</span>,
    },
    {
      label: "Cron job",
      value: formatNum(user.stats.cronjobOrders),
      color: "text-indigo-600",
      bg: "bg-indigo-500/10",
      icon: <span className="text-base">⏱</span>,
    },
    {
      label: "Lượt giới thiệu",
      value: formatNum(user.stats.referrals),
      color: "text-orange-600",
      bg: "bg-orange-500/10",
      icon: Ic.user,
    },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", c.bg, c.color)}>
              {c.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {c.label}
              </p>
              <p className="truncate text-lg font-bold tabular-nums leading-tight text-foreground">
                {c.value}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ═══ PROFILE TAB ════════════════════════════════════════════════════════════
function ProfileTab({ user, onSaved }: { user: any; onSaved: () => void }) {
  const trpc = useTRPC()
  const [fullname, setFullname] = React.useState(user.fullname ?? "")
  const [email, setEmail] = React.useState(user.email ?? "")
  const [refId, setRefId] = React.useState(user.refId ?? "")
  const [bannedVal, setBannedVal] = React.useState<string>(String(user.banned ?? 0))
  const [adminVal, setAdminVal] = React.useState<string>(String(user.admin ?? 0))

  const updateMut = useMutation({
    ...trpc.adminUser.updateInfo.mutationOptions(),
    onError: (err: any) => toast.error(err.message || "Cập nhật thất bại"),
  })
  const banMut = useMutation({
    ...trpc.adminUser.setBanned.mutationOptions(),
    onError: (err: any) => toast.error(err.message || "Đổi trạng thái thất bại"),
  })
  const adminMut = useMutation({
    ...trpc.adminUser.setAdmin.mutationOptions(),
    onError: (err: any) => toast.error(err.message || "Đổi vai trò thất bại"),
  })

  const isPending = updateMut.isPending || banMut.isPending || adminMut.isPending

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      const tasks: Promise<any>[] = []
      if (
        fullname !== (user.fullname ?? "") ||
        email !== user.email ||
        refId !== (user.refId ?? "")
      ) {
        tasks.push(
          updateMut.mutateAsync({
            id: user.id,
            data: {
              fullname: fullname.trim() || null,
              email: email.trim() || undefined,
              refId: refId.trim() || null,
            },
          })
        )
      }
      if (Number(bannedVal) !== user.banned) {
        tasks.push(banMut.mutateAsync({ id: user.id, banned: Number(bannedVal) }))
      }
      if (Number(adminVal) !== user.admin) {
        tasks.push(adminMut.mutateAsync({ id: user.id, admin: Number(adminVal) }))
      }
      if (tasks.length === 0) {
        toast.success("Không có thay đổi")
        return
      }
      await Promise.all(tasks)
      toast.success("Lưu thay đổi thành công")
      onSaved()
    } catch {
      // errors are reported by individual mutations
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm lg:col-span-2"
      >
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <span className="text-primary">{Ic.user}</span>
          <h3 className="text-base font-bold">Thông tin cá nhân</h3>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <Input id="username" value={user.username} disabled className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fullname">Họ và tên</Label>
            <Input
              id="fullname"
              value={fullname}
              onChange={(e) => setFullname(e.target.value)}
              placeholder="VD: Nguyễn Văn A"
              disabled={isPending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              disabled={isPending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="refId">Người giới thiệu (refId)</Label>
            <Input
              id="refId"
              value={refId}
              onChange={(e) => setRefId(e.target.value)}
              placeholder="username giới thiệu"
              disabled={isPending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role">Vai trò</Label>
            <select
              id="role"
              value={adminVal}
              onChange={(e) => setAdminVal(e.target.value)}
              disabled={isPending}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            >
              <option value="0">Thành viên</option>
              <option value="1">Quản trị viên</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="status">Trạng thái</Label>
            <select
              id="status"
              value={bannedVal}
              onChange={(e) => setBannedVal(e.target.value)}
              disabled={isPending}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            >
              <option value="0">Hoạt động</option>
              <option value="1">Đã khóa</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => {
              setFullname(user.fullname ?? "")
              setEmail(user.email ?? "")
              setRefId(user.refId ?? "")
              setBannedVal(String(user.banned ?? 0))
              setAdminVal(String(user.admin ?? 0))
            }}
          >
            Hủy
          </Button>
        </div>
      </form>

      {/* Side info */}
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Phiên đăng nhập
          </h3>
          <dl className="space-y-3 text-sm">
            <InfoRow label="IP gần nhất" value={user.ip || "—"} mono />
            <InfoRow label="Thiết bị" value={user.device || "—"} />
            <InfoRow
              label="Online"
              value={
                isOnline(user.lastSeen)
                  ? "Đang online"
                  : user.lastSeen
                  ? `${timeAgo(user.lastSeen)} (${formatDateTime(user.lastSeen)})`
                  : "Chưa từng đăng nhập"
              }
            />
            <InfoRow label="Tạo lúc" value={formatDateTime(user.createdAt)} />
            <InfoRow label="Cập nhật cuối" value={formatDateTime(user.updatedAt)} />
          </dl>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Affiliate
          </h3>
          <dl className="space-y-3 text-sm">
            <InfoRow label="Hoa hồng đã nhận" value={formatMoney(user.refMoney)} />
            <InfoRow label="Tổng hoa hồng" value={formatMoney(user.refTotalMoney)} />
            <InfoRow label="Click ref" value={formatNum(user.refClick)} />
            <InfoRow label="Đăng ký ref" value={formatNum(user.refAmount)} />
            <InfoRow label="Lượt rút" value={formatNum(user.refCk)} />
          </dl>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-xs font-medium text-muted-foreground">{label}</dt>
      <dd
        className={cn("min-w-0 truncate text-right text-sm", mono && "font-mono text-xs")}
        title={value}
      >
        {value}
      </dd>
    </div>
  )
}

// ═══ ACTIVITY LOGS TAB ═════════════════════════════════════════════════════
function ActivityLogsTab({ userId }: { userId: string }) {
  const trpc = useTRPC()
  const [page, setPage] = React.useState(1)
  const [keyword, setKeyword] = React.useState("")
  const [keywordInput, setKeywordInput] = React.useState("")

  React.useEffect(() => {
    const t = setTimeout(() => {
      setKeyword(keywordInput.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(t)
  }, [keywordInput])

  const { data, isLoading, isFetching } = useQuery(
    trpc.admin.getActivityLogs.queryOptions({
      page,
      limit: 20,
      userId,
      keyword: keyword || undefined,
    })
  ) as { data: any; isLoading: boolean; isFetching: boolean }

  const items: any[] = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-bold">Nhật ký hoạt động</h3>
          <p className="text-xs text-muted-foreground">
            Tổng {total.toLocaleString("vi-VN")} bản ghi
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {Ic.search}
          </span>
          <input
            type="text"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            placeholder="Lọc theo nội dung..."
            className="h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          />
          {isFetching && !isLoading && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
          )}
        </div>
      </div>

      <div className="divide-y divide-border">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 px-6 py-3">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-2 w-1/3" />
              </div>
            </div>
          ))
        ) : items.length > 0 ? (
          items.map((log: any) => (
            <div key={log._id} className="flex items-start gap-3 px-6 py-3 transition-colors hover:bg-muted/30">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                {Ic.activity}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-medium text-foreground">{log.action}</p>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                  <span className="font-mono">{log.ip || "—"}</span>
                  <span title={formatDateTime(log.createdAt)}>{timeAgo(log.createdAt)}</span>
                  {log.device && <span className="truncate" title={log.device}>{log.device.slice(0, 60)}</span>}
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            Chưa có hoạt động nào.
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      )}
    </div>
  )
}

// ═══ BALANCE LOGS TAB ══════════════════════════════════════════════════════
function BalanceLogsTab({ userId }: { userId: string }) {
  const trpc = useTRPC()
  const [page, setPage] = React.useState(1)
  const [keyword, setKeyword] = React.useState("")
  const [keywordInput, setKeywordInput] = React.useState("")

  React.useEffect(() => {
    const t = setTimeout(() => {
      setKeyword(keywordInput.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(t)
  }, [keywordInput])

  const { data, isLoading, isFetching } = useQuery(
    trpc.admin.getBalanceLogs.queryOptions({
      page,
      limit: 20,
      userId,
      keyword: keyword || undefined,
    })
  ) as { data: any; isLoading: boolean; isFetching: boolean }

  const items: any[] = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1

  // Sum
  const totalIn = items.reduce(
    (s: number, x: any) => (Number(x.moneyChange) > 0 ? s + Number(x.moneyChange) : s),
    0
  )
  const totalOut = items.reduce(
    (s: number, x: any) => (Number(x.moneyChange) < 0 ? s + Math.abs(Number(x.moneyChange)) : s),
    0
  )

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-bold">Biến động số dư</h3>
          <p className="text-xs text-muted-foreground">
            {total.toLocaleString("vi-VN")} bản ghi · Trang này: <span className="text-emerald-600 font-semibold">+{formatMoney(totalIn)}</span> / <span className="text-rose-600 font-semibold">−{formatMoney(totalOut)}</span>
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {Ic.search}
          </span>
          <input
            type="text"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            placeholder="Lọc theo nội dung..."
            className="h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          />
          {isFetching && !isLoading && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
          )}
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block">
        {isLoading ? (
          <div className="space-y-2 p-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-md" />
            ))}
          </div>
        ) : items.length > 0 ? (
          <div className="divide-y divide-border">
            <div className="grid grid-cols-12 gap-3 px-6 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <div className="col-span-1">#</div>
              <div className="col-span-5">Nội dung</div>
              <div className="col-span-2 text-right">Trước</div>
              <div className="col-span-2 text-right">Thay đổi</div>
              <div className="col-span-2 text-right">Sau</div>
            </div>
            {items.map((log: any, i: number) => {
              const change = Number(log.moneyChange)
              const positive = change >= 0
              return (
                <div
                  key={log._id}
                  className="grid grid-cols-12 items-center gap-3 px-6 py-3 text-sm transition-colors hover:bg-muted/30"
                >
                  <div className="col-span-1">
                    <span
                      className={cn(
                        "inline-flex size-7 items-center justify-center rounded-full",
                        positive ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"
                      )}
                    >
                      {positive ? Ic.arrowUp : Ic.arrowDown}
                    </span>
                  </div>
                  <div className="col-span-5 min-w-0">
                    <p className="truncate font-medium" title={log.content}>{log.content}</p>
                    <p className="text-[11px] text-muted-foreground">
                      <span title={formatDateTime(log.createdAt)}>{timeAgo(log.createdAt)}</span>
                    </p>
                  </div>
                  <div className="col-span-2 text-right tabular-nums text-muted-foreground">
                    {formatMoney(log.moneyBefore)}
                  </div>
                  <div
                    className={cn(
                      "col-span-2 text-right font-bold tabular-nums",
                      positive ? "text-emerald-600" : "text-rose-600"
                    )}
                  >
                    {positive ? "+" : ""}
                    {formatMoney(change)}
                  </div>
                  <div className="col-span-2 text-right font-semibold tabular-nums text-foreground">
                    {formatMoney(log.moneyAfter)}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="p-12 text-center text-sm text-muted-foreground">Chưa có biến động số dư.</div>
        )}
      </div>

      {/* Mobile cards */}
      <div className="divide-y divide-border lg:hidden">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-2 p-4">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))
          : items.length > 0
          ? items.map((log: any) => {
              const change = Number(log.moneyChange)
              const positive = change >= 0
              return (
                <div key={log._id} className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 flex-1 text-sm font-medium" title={log.content}>{log.content}</p>
                    <span
                      className={cn(
                        "shrink-0 text-sm font-bold tabular-nums",
                        positive ? "text-emerald-600" : "text-rose-600"
                      )}
                    >
                      {positive ? "+" : ""}
                      {formatMoney(change)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      {formatMoney(log.moneyBefore)} → <span className="font-semibold text-foreground">{formatMoney(log.moneyAfter)}</span>
                    </span>
                    <span title={formatDateTime(log.createdAt)}>{timeAgo(log.createdAt)}</span>
                  </div>
                </div>
              )
            })
          : (
              <div className="p-12 text-center text-sm text-muted-foreground">Chưa có biến động số dư.</div>
            )}
      </div>

      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onChange={setPage} />}
    </div>
  )
}

// ═══ DANGER TAB ════════════════════════════════════════════════════════════
function DangerTab({
  user,
  onSaved,
  onDeleted,
}: {
  user: any
  onSaved: () => void
  onDeleted: () => void
}) {
  const trpc = useTRPC()
  const [resetPwdOpen, setResetPwdOpen] = React.useState(false)
  const [reset2faConfirm, setReset2faConfirm] = React.useState(false)
  const [deleteConfirm, setDeleteConfirm] = React.useState(false)

  const reset2faMut = useMutation({
    ...trpc.adminUser.reset2fa.mutationOptions(),
    onSuccess: () => {
      toast.success("Đã reset 2FA")
      onSaved()
      setReset2faConfirm(false)
    },
    onError: (err: any) => toast.error(err.message || "Thao tác thất bại"),
  })

  const deleteMut = useMutation({
    ...trpc.adminUser.delete.mutationOptions(),
    onSuccess: () => {
      toast.success("Đã xóa tài khoản")
      onDeleted()
    },
    onError: (err: any) => toast.error(err.message || "Xóa thất bại"),
  })

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Security */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <span className="text-blue-600">{Ic.shield}</span>
          <h3 className="text-base font-bold">Bảo mật</h3>
        </div>
        <div className="mt-5 space-y-3">
          <ActionRow
            title="Đặt lại mật khẩu"
            hint="User sẽ tự động bị logout khỏi mọi thiết bị."
            action={
              <Button size="sm" variant="outline" onClick={() => setResetPwdOpen(true)}>
                Đặt lại
              </Button>
            }
          />
          <ActionRow
            title="Reset 2FA"
            hint={
              user.status2fa === 1
                ? "Tắt 2FA và xóa secret key. User cần setup lại."
                : "User chưa bật 2FA."
            }
            action={
              <Button
                size="sm"
                variant="outline"
                disabled={user.status2fa !== 1}
                onClick={() => setReset2faConfirm(true)}
              >
                Reset
              </Button>
            }
          />
        </div>
      </div>

      {/* Danger zone */}
      <div className="rounded-xl border border-rose-500/30 bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2 border-b border-rose-500/20 pb-3">
          <span className="text-rose-600">{Ic.alert}</span>
          <h3 className="text-base font-bold text-rose-600">Vùng nguy hiểm</h3>
        </div>
        <div className="mt-5 space-y-3">
          <ActionRow
            title="Xóa vĩnh viễn"
            hint="Sẽ chặn nếu là admin, còn tiền hoặc còn đơn hoạt động."
            action={
              <Button size="sm" variant="destructive" onClick={() => setDeleteConfirm(true)}>
                Xóa
              </Button>
            }
          />
        </div>
      </div>

      {resetPwdOpen && (
        <ResetPasswordDialog
          userId={user.id}
          username={user.username}
          onClose={() => setResetPwdOpen(false)}
          onSaved={onSaved}
        />
      )}

      <ConfirmDialog
        open={reset2faConfirm}
        onOpenChange={setReset2faConfirm}
        title="Reset 2FA"
        description={`Tắt 2FA và xóa secret của ${user.username}?`}
        variant="destructive"
        confirmText="Reset"
        cancelText="Hủy"
        isPending={reset2faMut.isPending}
        onConfirm={() => reset2faMut.mutate({ id: user.id })}
      />

      <ConfirmDialog
        open={deleteConfirm}
        onOpenChange={setDeleteConfirm}
        title="Xóa tài khoản"
        description={`Xóa vĩnh viễn ${user.username}? Hành động không thể hoàn tác.`}
        variant="destructive"
        confirmText="Xóa"
        cancelText="Hủy"
        isPending={deleteMut.isPending}
        onConfirm={() => deleteMut.mutate({ id: user.id })}
      />
    </div>
  )
}

function ActionRow({
  title,
  hint,
  action,
}: {
  title: string
  hint: string
  action: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-muted/20 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  )
}

// ═══ RESET PASSWORD DIALOG ═════════════════════════════════════════════════
function ResetPasswordDialog({
  userId,
  username,
  onClose,
  onSaved,
}: {
  userId: string
  username: string
  onClose: () => void
  onSaved: () => void
}) {
  const trpc = useTRPC()
  const [password, setPassword] = React.useState("")
  const [show, setShow] = React.useState(false)

  const mut = useMutation({
    ...trpc.adminUser.resetPassword.mutationOptions(),
    onSuccess: () => {
      toast.success(`Đã đổi mật khẩu cho ${username}. User đã bị logout.`)
      onSaved()
      onClose()
    },
    onError: (err: any) => toast.error(err.message || "Đổi mật khẩu thất bại"),
  })

  function generate() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
    let pwd = ""
    for (let i = 0; i < 10; i++) pwd += chars.charAt(Math.floor(Math.random() * chars.length))
    setPassword(pwd)
    setShow(true)
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !mut.isPending && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Đặt lại mật khẩu</DialogTitle>
          <DialogDescription>
            User <b className="text-foreground">{username}</b> sẽ tự động bị đăng xuất khỏi tất cả thiết bị.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="newpwd">Mật khẩu mới</Label>
            <div className="flex items-center gap-2">
              <Input
                id="newpwd"
                type={show ? "text" : "password"}
                placeholder="Tối thiểu 6 ký tự"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={mut.isPending}
                className="font-mono"
              />
              <Button type="button" variant="outline" onClick={() => setShow((v) => !v)}>
                {show ? "Ẩn" : "Hiện"}
              </Button>
            </div>
            <Button type="button" variant="link" onClick={generate} className="px-0 text-xs">
              Tạo mật khẩu ngẫu nhiên
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mut.isPending}>
            Hủy
          </Button>
          <Button
            onClick={() => mut.mutate({ id: userId, password })}
            disabled={mut.isPending || password.length < 6}
          >
            {mut.isPending ? "Đang xử lý..." : "Đặt lại"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ═══ PAGINATION ════════════════════════════════════════════════════════════
function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number
  totalPages: number
  onChange: (n: number) => void
}) {
  return (
    <div className="flex items-center justify-between border-t border-border px-6 py-3">
      <span className="text-xs text-muted-foreground">
        Trang {page} / {totalPages}
      </span>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="outline"
          disabled={page === 1}
          onClick={() => onChange(Math.max(1, page - 1))}
        >
          Trước
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={page === totalPages}
          onClick={() => onChange(Math.min(totalPages, page + 1))}
        >
          Sau
        </Button>
      </div>
    </div>
  )
}
