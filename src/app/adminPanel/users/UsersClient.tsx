"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/client"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import { SelectCustom } from "@/components/ui/select-custom"
import { ConfirmDialog } from "@/components/confirm-dialog"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "@/components/ui/toast"
import { IconUsers } from "@/components/icons"

// ─── Stat icons ──────────────────────────────────────────────────────────────

const Ic = {
  user: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
  ),
  shield: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /></svg>
  ),
  online: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><circle cx="12" cy="12" r="9" /></svg>
  ),
  ban: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="m4.9 4.9 14.2 14.2" /></svg>
  ),
  wallet: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg>
  ),
  trophy: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></svg>
  ),
  rocket: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" /></svg>
  ),
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMoney(n: number | null | undefined) {
  const num = Number(n)
  return new Intl.NumberFormat("vi-VN").format(Number.isFinite(num) ? num : 0) + "đ"
}

function formatDateTime(input: any) {
  if (!input) return "—"
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return "—"
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function isOnline(lastSeen: string | Date | null | undefined): boolean {
  if (!lastSeen) return false
  const t = new Date(lastSeen).getTime()
  if (!Number.isFinite(t)) return false
  return Date.now() - t < 5 * 60_000
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function AdminUsersClient() {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const router = useRouter()

  const [searchInput, setSearchInput] = useState("")
  const [keyword, setKeyword] = useState("")
  const [bannedFilter, setBannedFilter] = useState("")
  const [adminFilter, setAdminFilter] = useState("")
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)

  const [adjusting, setAdjusting] = useState<any | null>(null)
  const [deletingUser, setDeletingUser] = useState<any | null>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      setKeyword(searchInput.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(t)
  }, [searchInput])

  // Stats: refetch mỗi 30s để có online count tươi
  const { data: stats } = useQuery({
    ...trpc.adminUser.stats.queryOptions(),
    refetchInterval: 30_000,
  }) as { data: any }

  const { data, isLoading, isFetching } = useQuery(
    trpc.adminUser.list.queryOptions({
      page,
      limit,
      keyword: keyword || undefined,
      banned: bannedFilter !== "" ? Number(bannedFilter) : undefined,
      admin: adminFilter !== "" ? Number(adminFilter) : undefined,
    })
  ) as { data: any; isLoading: boolean; isFetching: boolean }

  const items: any[] = data?.items ?? []
  const total: number = data?.total ?? 0
  const totalPages: number = data?.totalPages ?? 1
  const startRow = (page - 1) * limit + 1
  const endRow = Math.min(page * limit, total)

  const banMut = useMutation({
    ...trpc.adminUser.setBanned.mutationOptions(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: trpc.adminUser.list.queryKey() })
      qc.invalidateQueries({ queryKey: trpc.adminUser.stats.queryKey() })
    },
    onError: (err: any) => toast.error(err.message || "Thao tác thất bại"),
  })

  const deleteMut = useMutation({
    ...trpc.adminUser.delete.mutationOptions(),
    onSuccess: () => {
      toast.success("Đã xóa user")
      setDeletingUser(null)
      qc.invalidateQueries({ queryKey: trpc.adminUser.list.queryKey() })
      qc.invalidateQueries({ queryKey: trpc.adminUser.stats.queryKey() })
    },
    onError: (err: any) => toast.error(err.message || "Xóa thất bại"),
  })

  const statCards = [
    { label: "Tổng người dùng", value: stats?.totalAll ?? 0, icon: Ic.user, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Đang online", value: stats?.totalOnline ?? 0, icon: Ic.online, color: "text-emerald-500", bg: "bg-emerald-500/10", live: true },
    { label: "Mới hôm nay", value: stats?.totalToday ?? 0, icon: Ic.rocket, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Tài khoản bị khóa", value: stats?.totalBanned ?? 0, icon: Ic.ban, color: "text-rose-500", bg: "bg-rose-500/10" },
    { label: "Hoạt động", value: stats?.totalActive ?? 0, icon: Ic.shield, color: "text-cyan-500", bg: "bg-cyan-500/10" },
    { label: "Admin", value: stats?.totalAdmin ?? 0, icon: Ic.shield, color: "text-purple-500", bg: "bg-purple-500/10" },
    { label: "Tổng số dư", value: formatMoney(stats?.totalBalance ?? 0), icon: Ic.wallet, color: "text-indigo-500", bg: "bg-indigo-500/10" },
    { label: "Tổng đã chi", value: formatMoney(stats?.totalSpent ?? 0), icon: Ic.trophy, color: "text-orange-500", bg: "bg-orange-500/10" },
  ]

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <a href="/adminPanel/dashboard" className="hover:text-foreground transition-colors">Admin</a>
          <ChevronRight />
          <span className="text-foreground">Khách hàng</span>
        </nav>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-600">
            <IconUsers size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Khách hàng</h1>
            <p className="text-sm text-muted-foreground">
              Quản lý thành viên · cộng/trừ tiền · phân quyền · khóa tài khoản.
            </p>
          </div>
        </div>
      </div>

      {/* Stats grid 8 cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-2 lg:grid-cols-4">
        {(stats === undefined ? Array.from({ length: 8 }) : statCards).map((s: any, i: number) => (
          <div key={s?.label ?? i} className="rounded-lg border bg-card p-3 relative overflow-hidden">
            {s ? (
              <div className="flex items-center gap-3">
                <div className={`size-12 rounded-xl flex items-center justify-center shrink-0 ${s.bg} ${s.color} relative`}>
                  {s.icon}
                  {s.live && (
                    <span className="absolute top-1 right-1 size-2 rounded-full bg-emerald-500 ring-2 ring-card animate-pulse" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-muted-foreground text-[10px] truncate font-bold uppercase tracking-wider mb-0.5">{s.label}</p>
                  <p className="text-foreground max-w-full truncate text-lg font-bold tabular-nums leading-tight">
                    {typeof s.value === "number" ? s.value.toLocaleString("vi-VN") : s.value}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Skeleton className="size-12 rounded-xl shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-2.5 w-16" />
                  <Skeleton className="h-5 w-10" />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <SearchIcon />
          <input
            type="text"
            placeholder="Tìm theo username, email, fullname..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 ps-9 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          />
          {isFetching && !isLoading && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
          )}
        </div>
        <SelectCustom
          value={bannedFilter}
          onValueChange={(v) => { setBannedFilter(v); setPage(1) }}
          className="w-full sm:w-[160px]"
          options={[
            { value: "", label: "Tất cả TT" },
            { value: "0", label: "Hoạt động" },
            { value: "1", label: "Đã khóa" },
          ]}
        />
        <SelectCustom
          value={adminFilter}
          onValueChange={(v) => { setAdminFilter(v); setPage(1) }}
          className="w-full sm:w-[160px]"
          options={[
            { value: "", label: "Tất cả vai trò" },
            { value: "0", label: "User" },
            { value: "1", label: "Admin" },
          ]}
        />
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">#</TableHead>
              <TableHead>Tài khoản</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-right">Số dư</TableHead>
              <TableHead className="text-right">Tổng nạp</TableHead>
              <TableHead className="text-center">Vai trò</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Đăng ký</TableHead>
              <TableHead className="text-end">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 9 }).map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : items.length > 0 ? (
              items.map((u: any, i: number) => {
                const online = isOnline(u.lastSeen)
                return (
                  <TableRow key={u.id}>
                    <TableCell><span className="font-mono text-sm text-muted-foreground">{startRow + i}</span></TableCell>
                    <TableCell>
                      <Link href={`/adminPanel/users/${u.id}`} className="flex items-center gap-2 hover:text-primary transition-colors min-w-0">
                        <div className="relative shrink-0">
                          {u.avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={u.avatar} alt={u.username} className="h-8 w-8 rounded-full object-cover" />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                              {u.username.charAt(0).toUpperCase()}
                            </div>
                          )}
                          {online && (
                            <span title="Đang online" className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{u.username}</p>
                          {u.fullname && <p className="text-xs text-muted-foreground truncate">{u.fullname}</p>}
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">{u.email}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm font-bold tabular-nums">{formatMoney(u.money)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm font-semibold text-emerald-600 tabular-nums">{formatMoney(u.totalMoney)}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      {u.admin === 1 ? (
                        <span className="inline-flex rounded-full bg-purple-500/15 px-2 py-0.5 text-[11px] font-bold text-purple-600">ADMIN</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">User</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {u.banned === 1 ? (
                        <span className="inline-flex rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-medium text-rose-600">Đã khóa</span>
                      ) : online ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
                          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Online
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Offline</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(u.createdAt)}</span>
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setAdjusting(u)}
                          className="text-emerald-600 hover:text-emerald-700"
                        >
                          <CoinIcon /> Nạp
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/adminPanel/users/${u.id}`)}
                        >
                          <EyeIcon /> Chi tiết
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">Không tìm thấy user nào.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile */}
      <div className="md:hidden space-y-3">
        {items.map((u: any) => {
          const online = isOnline(u.lastSeen)
          return (
            <div key={u.id} className="rounded-lg border bg-card p-4 space-y-3">
              <Link href={`/adminPanel/users/${u.id}`} className="flex items-center gap-3">
                <div className="relative">
                  {u.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={u.avatar} alt={u.username} className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
                      {u.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {online && (
                    <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-emerald-500 ring-2 ring-card" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{u.username} {u.admin === 1 && <span className="ml-1 text-[10px] rounded bg-purple-500/15 text-purple-600 px-1 py-0.5 font-bold">ADMIN</span>}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                </div>
                {u.banned === 1 ? (
                  <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-medium text-rose-600">Khóa</span>
                ) : online ? (
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-600">Online</span>
                ) : null}
              </Link>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Số dư</p>
                  <p className="font-bold mt-0.5 tabular-nums">{formatMoney(u.money)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tổng nạp</p>
                  <p className="font-bold mt-0.5 tabular-nums text-emerald-600">{formatMoney(u.totalMoney)}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1 text-emerald-600" onClick={() => setAdjusting(u)}>
                  <CoinIcon /> Nạp tiền
                </Button>
                <Button size="sm" variant="outline" className="flex-1" asChild>
                  <Link href={`/adminPanel/users/${u.id}`}>
                    <EyeIcon /> Chi tiết
                  </Link>
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Pagination */}
      {!isLoading && total > 0 && (
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="text-sm text-muted-foreground">Hiển thị {startRow}-{endRow} / {total} user</div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Dòng</span>
              <SelectCustom
                value={String(limit)}
                onValueChange={(v) => { setLimit(Number(v)); setPage(1) }}
                size="sm"
                className="w-[80px]"
                options={[
                  { value: "10", label: "10" },
                  { value: "20", label: "20" },
                  { value: "50", label: "50" },
                ]}
              />
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Trước</Button>
              <span className="text-sm text-muted-foreground px-2">{page} / {totalPages}</span>
              <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Sau</Button>
            </div>
          </div>
        </div>
      )}

      {adjusting && (
        <BalanceDialog
          user={adjusting}
          onClose={() => setAdjusting(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: trpc.adminUser.list.queryKey() })
            qc.invalidateQueries({ queryKey: trpc.adminUser.stats.queryKey() })
          }}
        />
      )}

      <ConfirmDialog
        open={!!deletingUser}
        onOpenChange={(o) => !o && setDeletingUser(null)}
        title="Xóa người dùng"
        description={`Xóa "${deletingUser?.username}"? Hành động không thể hoàn tác.`}
        variant="destructive"
        confirmText="Xóa"
        cancelText="Hủy"
        isPending={deleteMut.isPending}
        onConfirm={() => deleteMut.mutate({ id: deletingUser.id })}
      />
    </div>
  )
}

// ─── Balance dialog ─────────────────────────────────────────────────────────

export function BalanceDialog({ user, onClose, onSaved }: { user: any; onClose: () => void; onSaved: () => void }) {
  const trpc = useTRPC()
  const [mode, setMode] = useState<"add" | "subtract">("add")
  const [amount, setAmount] = useState<number>(0)
  const [content, setContent] = useState("")

  const mut = useMutation({
    ...trpc.adminUser.adjustBalance.mutationOptions(),
    onSuccess: (res: any) => {
      toast.success(`Số dư mới: ${new Intl.NumberFormat("vi-VN").format(res.moneyAfter)}đ`)
      onSaved()
      onClose()
    },
    onError: (err: any) => toast.error(err.message || "Thao tác thất bại"),
  })

  function handleSubmit() {
    if (!content.trim()) return toast.error("Vui lòng nhập lý do")
    if (amount <= 0) return toast.error("Số tiền phải > 0")
    mut.mutate({
      id: user.id,
      amount: mode === "add" ? amount : -amount,
      content: content.trim(),
    })
  }

  const QUICK = [10000, 50000, 100000, 500000, 1000000]

  return (
    <Dialog open onOpenChange={(o) => !o && !mut.isPending && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md">
        <DialogHeader className="min-w-0">
          <DialogTitle className="flex flex-col gap-1">
            <span className="text-base font-semibold">Điều chỉnh số dư</span>
            <span className="text-[13px] font-normal text-muted-foreground truncate">
              {user.username} · Hiện tại: <b className="font-mono text-foreground">{new Intl.NumberFormat("vi-VN").format(user.money ?? 0)}đ</b>
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-2 rounded-md border bg-muted/30 p-1 h-10">
            <button
              type="button"
              onClick={() => setMode("add")}
              className={`rounded-sm text-sm font-bold transition-all ${mode === "add" ? "bg-emerald-500 text-white shadow-sm" : "text-muted-foreground"}`}
            >
              + Cộng
            </button>
            <button
              type="button"
              onClick={() => setMode("subtract")}
              className={`rounded-sm text-sm font-bold transition-all ${mode === "subtract" ? "bg-rose-500 text-white shadow-sm" : "text-muted-foreground"}`}
            >
              − Trừ
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Số tiền (đ) <span className="text-rose-500">*</span></label>
            <input
              type="number"
              min={0}
              value={amount === 0 ? "" : amount}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
              placeholder="Nhập số tiền..."
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-bold tabular-nums outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            />
            <div className="flex flex-wrap gap-1.5">
              {QUICK.map((q) => (
                <Button key={q} type="button" size="xs" variant="outline" onClick={() => setAmount((p) => p + q)}>
                  +{(q / 1000).toLocaleString("vi-VN")}k
                </Button>
              ))}
              <Button type="button" size="xs" variant="destructive" onClick={() => setAmount(0)}>
                Reset
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Lý do <span className="text-rose-500">*</span></label>
            <textarea
              rows={2}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="VD: Hoàn tiền giao dịch lỗi #1234"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            />
          </div>

          {amount > 0 && (
            <div className={`rounded-md border-2 p-3 text-center ${mode === "add" ? "border-emerald-500/30 bg-emerald-500/5" : "border-rose-500/30 bg-rose-500/5"}`}>
              <p className="text-[11px] text-muted-foreground mb-1">Số dư sau khi {mode === "add" ? "cộng" : "trừ"}</p>
              <p className={`text-lg font-bold tabular-nums ${mode === "add" ? "text-emerald-600" : "text-rose-600"}`}>
                {new Intl.NumberFormat("vi-VN").format((user.money ?? 0) + (mode === "add" ? amount : -amount))}đ
              </p>
            </div>
          )}
        </div>
        <DialogFooter className="flex-row gap-2 sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={mut.isPending}>Hủy</Button>
          <Button
            onClick={handleSubmit}
            disabled={mut.isPending || amount <= 0}
            className={`${mode === "add" ? "bg-emerald-500 hover:bg-emerald-600" : "bg-rose-500 hover:bg-rose-600"} text-white`}
          >
            {mut.isPending ? "Đang xử lý..." : "Xác nhận"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ChevronRight() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/50"><path d="m9 18 6-6-6-6" /></svg> }
function SearchIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.34-4.34" /></svg> }
function CoinIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" /><path d="M12 18V6" /></svg> }
function EyeIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg> }
