"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider, useSidebar } from "@/components/sidebar-context"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import {
  IconWallet,
  IconTrendingUp,
  IconUsers,
  IconDollarCircle,
  IconArrowDownToLine,
  IconCopy,
  IconCheck,
  IconLink2,
  IconChevronRight,
} from "@/components/icons"
import Link from "next/link"
import {
  useAffiliateOverview,
  useAffiliateHistory,
} from "@/hooks/use-affiliate"

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatMoney(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n) + "đ"
}

function formatDate(d: Date | string | undefined | null) {
  if (!d) return "—"
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return "—"
  const time = date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
  const day = date.toLocaleDateString("vi-VN")
  return `${time} ${day}`
}

// ─── View ───────────────────────────────────────────────────────────────────

function AffiliateOverviewContent() {
  const { collapsed } = useSidebar()
  const a = useAffiliateOverview()

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div
        className={`flex flex-1 flex-col transition-all duration-300 ease-in-out ${
          collapsed ? "lg:ml-[72px]" : "lg:ml-[260px]"
        }`}
      >
        <DashboardHeader />
        <main className="flex-1 p-4 sm:p-6">
          <div className="space-y-6">
            <PageHeader rate={a.stats?.refRate ?? 0} />

            {a.isLoadingStats ? (
              <SkeletonOverview />
            ) : (
              <>
                <StatsGrid stats={a.stats} />
                <RefLinkBar
                  refLink={a.refLink}
                  copied={a.copied}
                  onCopy={a.copyRefLink}
                />
              </>
            )}

            <RecentHistorySection />
          </div>
        </main>
      </div>
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function PageHeader({ rate }: { rate: number }) {
  return (
    <div>
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2">
        <a href="/dashboard" className="hover:text-foreground transition-colors">
          Trang chủ
        </a>
        <span>/</span>
        <span className="text-foreground font-medium">Tiếp thị liên kết</span>
      </nav>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Tiếp thị liên kết</h1>
        {rate > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            <IconTrendingUp size={12} /> Hoa hồng {rate}%
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground mt-0.5">
        Chia sẻ liên kết và nhận hoa hồng trọn đời từ mỗi giao dịch của thành viên.
      </p>
    </div>
  )
}

function SkeletonOverview() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-24 rounded-xl" />
    </div>
  )
}

function StatsGrid({ stats }: { stats: any }) {
  const cards = [
    {
      Icon: IconWallet,
      value: formatMoney(stats?.refMoney ?? 0),
      label: "Số dư hoa hồng",
      color: "text-emerald-500",
    },
    {
      Icon: IconTrendingUp,
      value: formatMoney(stats?.refTotalMoney ?? 0),
      label: "Tổng hoa hồng",
      color: "text-blue-500",
    },
    {
      Icon: IconDollarCircle,
      value: formatMoney(stats?.refAmount ?? 0),
      label: "Tổng doanh thu",
      color: "text-violet-500",
    },
    {
      Icon: IconUsers,
      value: String(stats?.memberCount ?? 0),
      label: "Tổng giới thiệu",
      color: "text-amber-500",
    },
    {
      Icon: IconLink2,
      value: new Intl.NumberFormat("vi-VN").format(stats?.refClick ?? 0),
      label: "Lượt nhấp link",
      color: "text-sky-500",
    },
    {
      Icon: IconArrowDownToLine,
      value: formatMoney(stats?.totalWithdrawn ?? 0),
      label: "Tổng đã rút",
      color: "text-cyan-500",
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {cards.map((c, i) => (
        <div
          key={i}
          className="rounded-xl border bg-card p-5 shadow-sm transition-all hover:shadow-md"
        >
          <div className="flex items-center gap-4">
            <div className={`shrink-0 rounded-lg bg-muted/40 p-3 ${c.color}`}>
              <c.Icon size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xl font-bold tabular-nums truncate">
                {c.value}
              </div>
              <div className="text-xs text-muted-foreground truncate">{c.label}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function RefLinkBar({
  refLink,
  copied,
  onCopy,
}: {
  refLink: string
  copied: boolean
  onCopy: () => void
}) {
  return (
    <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-transparent p-5 sm:p-6 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-tight">
            <IconLink2 size={16} className="text-primary" />
            Liên kết giới thiệu
          </div>
          <p className="text-xs text-muted-foreground">
            Sao chép và chia sẻ để nhận hoa hồng từ giao dịch của người được giới thiệu.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto md:max-w-md">
          <Input
            readOnly
            value={refLink}
            placeholder="Đang tải..."
            onClick={(e: any) => e.target.select()}
            className="h-10 font-mono text-xs bg-background flex-1"
          />
          <Button
            onClick={onCopy}
            disabled={!refLink}
            size="default"
            className="h-10 shrink-0"
          >
            {copied ? (
              <>
                <IconCheck size={16} className="mr-1" /> Đã sao chép
              </>
            ) : (
              <>
                <IconCopy size={16} className="mr-1" /> Sao chép
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── History snippet (5 dòng gần nhất, layout giống full history page) ──────

function RecentHistorySection() {
  const h = useAffiliateHistory()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-bold">Hoa hồng gần đây</h3>
        <Button asChild variant="ghost" size="sm">
          <Link href="/customer/history/affiliate" className="text-xs">
            Xem tất cả
            <IconChevronRight size={14} className="ml-1" />
          </Link>
        </Button>
      </div>

      <DesktopTable items={h.items} isLoading={h.isLoading} startRow={h.startRow} />
      <MobileCards items={h.items} isLoading={h.isLoading} />
    </div>
  )
}

function DesktopTable({
  items,
  isLoading,
  startRow,
}: {
  items: any[]
  isLoading: boolean
  startRow: number
}) {
  return (
    <div className="hidden md:block rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[60px]">#</TableHead>
            <TableHead>Nội dung</TableHead>
            <TableHead className="text-right">Hoa hồng cũ</TableHead>
            <TableHead className="text-right">Thay đổi</TableHead>
            <TableHead className="text-right">Hoa hồng mới</TableHead>
            <TableHead>Thời gian</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-6" /></TableCell>
                <TableCell><Skeleton className="h-4 w-64" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
              </TableRow>
            ))
          ) : items.length > 0 ? (
            items.slice(0, 5).map((it: any, i: number) => (
              <TableRow key={it.id}>
                <TableCell>
                  <span className="font-mono text-sm text-muted-foreground">
                    {startRow + i}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-sm">{it.content}</span>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground tabular-nums block text-right">
                    {formatMoney(it.moneyBefore)}
                  </span>
                </TableCell>
                <TableCell>
                  <span
                    className={`text-sm font-semibold tabular-nums block text-right ${
                      it.moneyChange >= 0 ? "text-emerald-600" : "text-red-500"
                    }`}
                  >
                    {it.moneyChange >= 0 ? "+" : ""}
                    {formatMoney(it.moneyChange)}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-sm font-semibold tabular-nums block text-right">
                    {formatMoney(it.moneyAfter)}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {formatDate(it.createdAt)}
                  </span>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                Chưa có hoa hồng nào.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function MobileCards({ items, isLoading }: { items: any[]; isLoading: boolean }) {
  return (
    <div className="md:hidden space-y-3">
      {isLoading ? (
        Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-4 space-y-3">
            <Skeleton className="h-4 w-48" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        ))
      ) : items.length > 0 ? (
        items.slice(0, 5).map((it: any) => (
          <div key={it.id} className="rounded-lg border bg-card p-4 space-y-3">
            <p className="text-sm font-medium">{it.content}</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Thay đổi</p>
                <p
                  className={`mt-0.5 font-semibold tabular-nums ${
                    it.moneyChange >= 0 ? "text-emerald-600" : "text-red-500"
                  }`}
                >
                  {it.moneyChange >= 0 ? "+" : ""}
                  {formatMoney(it.moneyChange)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Hoa hồng mới</p>
                <p className="mt-0.5 font-semibold tabular-nums">
                  {formatMoney(it.moneyAfter)}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Thời gian</p>
                <p className="mt-0.5 text-xs">{formatDate(it.createdAt)}</p>
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground text-sm">
          Chưa có hoa hồng nào.
        </div>
      )}
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

export function AffiliateOverviewClient() {
  return (
    <SidebarProvider>
      <AffiliateOverviewContent />
    </SidebarProvider>
  )
}
