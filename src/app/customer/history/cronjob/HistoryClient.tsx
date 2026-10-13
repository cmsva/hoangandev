"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { useSidebar } from "@/components/sidebar-context"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import { SelectCustom } from "@/components/ui/select-custom"
import { Play, Pause, Pencil, CalendarPlus, Trash2, Copy, X } from "lucide-react"
import { useCronjobHistory, type CronjobSortField } from "@/hooks/use-cronjob-history"

type SortDir = "asc" | "desc"

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: "Đang chạy", color: "bg-green-500/10 text-green-600 dark:text-green-400 ring-1 ring-green-500/20" },
  paused: { label: "Tạm dừng", color: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 ring-1 ring-yellow-500/20" },
  expired: { label: "Hết hạn", color: "bg-gray-500/10 text-gray-600 dark:text-gray-400 ring-1 ring-gray-500/20" },
}

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "Tất cả" },
  { value: "active", label: "Đang chạy" },
  { value: "paused", label: "Tạm dừng" },
  { value: "expired", label: "Hết hạn" },
] as const

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDateTime(input: any) {
  if (!input) return "—"
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return "—"
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatPrice(n: number | undefined | null) {
  return new Intl.NumberFormat("vi-VN").format(Number(n) || 0) + "đ"
}

function formatRelative(input: any) {
  if (!input) return null
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return null
  const diff = Date.now() - d.getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 5) return "vừa xong"
  if (sec < 60) return `${sec}s trước`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} phút trước`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} giờ trước`
  const day = Math.floor(h / 24)
  if (day < 7) return `${day} ngày trước`
  return formatDateTime(input)
}

function truncate(s: string, max = 50) {
  const v = String(s || "")
  return v.length <= max ? v : v.slice(0, max - 1) + "…"
}

// ─── View ───────────────────────────────────────────────────────────────────

export function CronjobHistoryClient() {
  const { collapsed } = useSidebar()
  const c = useCronjobHistory()

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className={`flex flex-1 flex-col transition-all duration-300 ease-in-out ${collapsed ? "lg:ml-[72px]" : "lg:ml-[260px]"}`}>
        <DashboardHeader />
        <main className="flex-1 p-4 sm:p-6">
          <div className="space-y-6">
            <PageHeader />
            <SearchBar
              searchInput={c.searchInput}
              setSearchInput={c.setSearchInput}
              statusFilter={c.statusFilter}
              setStatusFilter={c.setStatusFilter}
              isFetching={c.isFetching}
              isLoading={c.isLoading}
            />
            <DesktopTable c={c} />
            <MobileCards c={c} />
            {!c.isLoading && c.total > 0 && (
              <Pagination
                page={c.page}
                setPage={c.setPage}
                limit={c.limit}
                setLimit={c.setLimit}
                total={c.total}
                totalPages={c.totalPages}
                startRow={c.startRow}
                endRow={c.endRow}
              />
            )}
          </div>
        </main>
      </div>

      {/* Edit Modal */}
      {c.editingJob && (
        <Modal onClose={() => !c.isSavingEdit && c.setEditingJob(null)}>
          <EditModalContent c={c} />
        </Modal>
      )}

      {/* Extend Modal */}
      {c.extendingJob && (
        <Modal onClose={() => !c.isExtending && c.setExtendingJob(null)}>
          <ExtendModalContent c={c} />
        </Modal>
      )}

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!c.deletingJob}
        onOpenChange={(o) => { if (!o) c.setDeletingJob(null) }}
        title="Xác nhận xóa cronjob"
        description="Hành động này không thể hoàn tác. Cronjob sẽ bị xóa vĩnh viễn."
        variant="destructive"
        confirmText="Xác nhận xóa"
        cancelText="Hủy"
        isPending={c.isDeleting}
        onConfirm={c.handleConfirmDelete}
      >
        {c.deletingJob && (
          <div className="rounded-md bg-muted/40 border p-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted border tracking-tighter font-mono">{c.deletingJob.method}</span>
              <span className="font-mono break-all">{truncate(c.deletingJob.url, 48)}</span>
            </div>
          </div>
        )}
      </ConfirmDialog>
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function PageHeader() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <a href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</a>
          <ChevronRight />
          <span className="text-foreground font-normal">Cronjob đang chạy</span>
        </nav>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Cronjob đang chạy</h1>
        <p className="text-sm text-muted-foreground">Quản lý các cronjob đã thuê. Bật/tạm dừng, chỉnh sửa, gia hạn hoặc xóa.</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <a href="/cronjob" className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 h-9">
          <PlusIcon /> Thuê thêm
        </a>
      </div>
    </div>
  )
}

function SearchBar({ searchInput, setSearchInput, statusFilter, setStatusFilter, isFetching, isLoading }: {
  searchInput: string
  setSearchInput: (v: string) => void
  statusFilter: string
  setStatusFilter: (v: string) => void
  isFetching: boolean
  isLoading: boolean
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <SearchIcon />
          <input
            type="text"
            placeholder="Tìm kiếm theo URL..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 ps-9 text-sm shadow-xs transition-colors placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          />
          {isFetching && !isLoading && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
          )}
        </div>
        <SelectCustom
          value={statusFilter}
          onValueChange={setStatusFilter}
          className="w-[160px]"
          placeholder="Trạng thái"
          options={STATUS_FILTER_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        />
      </div>
    </div>
  )
}

type C = ReturnType<typeof useCronjobHistory>

function DesktopTable({ c }: { c: C }) {
  return (
    <div className="hidden md:block rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[60px]">#</TableHead>
            <TableHead><SortBtn field="url" current={c.sortField} dir={c.sortDir} onClick={c.toggleSort}>URL Cronjob</SortBtn></TableHead>
            <TableHead>Số giây</TableHead>
            <TableHead>Response</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead><SortBtn field="payment" current={c.sortField} dir={c.sortDir} onClick={c.toggleSort}>Đã trả</SortBtn></TableHead>
            <TableHead><SortBtn field="lastRun" current={c.sortField} dir={c.sortDir} onClick={c.toggleSort}>Chạy gần đây</SortBtn></TableHead>
            <TableHead><SortBtn field="expiresAt" current={c.sortField} dir={c.sortDir} onClick={c.toggleSort}>Hết hạn</SortBtn></TableHead>
            <TableHead className="text-end">Thao tác</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {c.isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 9 }).map((__, j) => (
                  <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                ))}
              </TableRow>
            ))
          ) : c.items.length > 0 ? (
            c.items.map((j: any, index: number) => (
              <CronjobRow key={j.id} job={j} index={index} c={c} />
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                Chưa có cronjob nào.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function CronjobRow({ job: j, index, c }: { job: any; index: number; c: C }) {
  const st = STATUS_LABELS[j.status] ?? { label: j.status, color: "bg-gray-500/10 text-gray-500" }
  const canRun = j.status === "paused"
  const canPause = j.status === "active"
  const canEdit = j.status !== "expired"
  const canDelete = j.status === "paused" || j.status === "expired"
  const code = j.statusCode
  const isSuccess = code && code >= 200 && code < 300

  return (
    <TableRow>
      <TableCell>
        <span className="font-mono text-sm font-medium text-muted-foreground">{c.startRow + index}</span>
      </TableCell>
      <TableCell>
        <div className="min-w-[240px] max-w-[360px]">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted border tracking-tighter font-mono">{j.method}</span>
            <span className="font-medium text-sm font-mono break-all" title={j.url}>{truncate(j.url, 64)}</span>
          </div>
          <button
            onClick={() => c.onCopy(j.url)}
            className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <Copy className="h-3 w-3" /> Copy URL
          </button>
        </div>
      </TableCell>
      <TableCell><span className="text-sm font-medium font-mono">{j.intervalSeconds}s</span></TableCell>
      <TableCell>
        {code ? (
          <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium font-mono ring-1 ring-inset ${
            isSuccess
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20"
              : "bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-rose-500/20"
          }`}>{code}</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${st.color}`}>{st.label}</span>
      </TableCell>
      <TableCell><span className="text-sm font-semibold">{formatPrice(j.payment)}</span></TableCell>
      <TableCell>
        <div className="flex flex-col gap-0.5">
          {j.lastRun ? (
            <>
              <span className="text-xs font-medium text-foreground">{formatRelative(j.lastRun)}</span>
              <span className="text-[10px] text-muted-foreground font-mono">{formatDateTime(j.lastRun)}</span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground italic">Chưa chạy</span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(j.expiresAt)}</div>
      </TableCell>
      <TableCell className="text-end">
        <div className="flex items-center justify-end gap-1">
          {canRun && (
            <ActionButton onClick={() => c.handleToggleStatus(j.id)} disabled={c.isTogglingStatus} variant="success" title="Chạy">
              <Play className="h-3.5 w-3.5" />
            </ActionButton>
          )}
          {canPause && (
            <ActionButton onClick={() => c.handleToggleStatus(j.id)} disabled={c.isTogglingStatus} variant="warn" title="Tạm dừng">
              <Pause className="h-3.5 w-3.5" />
            </ActionButton>
          )}
          {canEdit && (
            <ActionButton onClick={() => c.openEdit(j)} variant="default" title="Chỉnh sửa">
              <Pencil className="h-3.5 w-3.5" />
            </ActionButton>
          )}
          <ActionButton onClick={() => c.openExtend(j)} variant="primary" title="Gia hạn">
            <CalendarPlus className="h-3.5 w-3.5" />
          </ActionButton>
          {canDelete && (
            <ActionButton onClick={() => c.setDeletingJob(j)} variant="danger" title="Xóa">
              <Trash2 className="h-3.5 w-3.5" />
            </ActionButton>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}

function MobileCards({ c }: { c: C }) {
  return (
    <div className="md:hidden space-y-3">
      {c.isLoading ? (
        Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-4 space-y-3">
            <Skeleton className="h-4 w-32" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        ))
      ) : c.items.length > 0 ? (
        c.items.map((j: any) => <CronjobCard key={j.id} job={j} c={c} />)
      ) : (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          Chưa có cronjob nào.
        </div>
      )}
    </div>
  )
}

function CronjobCard({ job: j, c }: { job: any; c: C }) {
  const st = STATUS_LABELS[j.status] ?? { label: j.status, color: "bg-gray-500/10 text-gray-500" }
  const canRun = j.status === "paused"
  const canPause = j.status === "active"
  const canEdit = j.status !== "expired"
  const canDelete = j.status === "paused" || j.status === "expired"

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted border tracking-tighter font-mono shrink-0">{j.method}</span>
          <span className="text-sm font-mono break-all">{truncate(j.url, 40)}</span>
        </div>
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium shrink-0 ${st.color}`}>{st.label}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Vòng lặp</p>
          <div className="mt-0.5 font-medium font-mono">{j.intervalSeconds}s</div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Đã trả</p>
          <div className="mt-0.5 font-semibold">{formatPrice(j.payment)}</div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Hết hạn</p>
          <div className="mt-0.5 font-medium text-xs">{formatDateTime(j.expiresAt)}</div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Chạy gần đây</p>
          <div className="mt-0.5 font-medium text-xs">
            {j.lastRun ? <span className="text-foreground">{formatRelative(j.lastRun)}</span> : <span className="text-muted-foreground italic">Chưa chạy</span>}
            {j.statusCode && (
              <span className={`ml-1.5 inline-flex items-center rounded px-1 py-0 text-[10px] font-mono ring-1 ring-inset ${
                j.statusCode >= 200 && j.statusCode < 300
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-rose-500/20"
              }`}>{j.statusCode}</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 pt-1">
        {canRun && (
          <button onClick={() => c.handleToggleStatus(j.id)} className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-1 text-xs font-medium ring-1 ring-emerald-500/20 hover:bg-emerald-500/20">
            <Play className="h-3 w-3" /> Chạy
          </button>
        )}
        {canPause && (
          <button onClick={() => c.handleToggleStatus(j.id)} className="inline-flex items-center gap-1 rounded-md bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 px-2 py-1 text-xs font-medium ring-1 ring-yellow-500/20 hover:bg-yellow-500/20">
            <Pause className="h-3 w-3" /> Tạm dừng
          </button>
        )}
        {canEdit && (
          <button onClick={() => c.openEdit(j)} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium hover:bg-accent">
            <Pencil className="h-3 w-3" /> Sửa
          </button>
        )}
        <button onClick={() => c.openExtend(j)} className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary px-2 py-1 text-xs font-medium ring-1 ring-primary/20 hover:bg-primary/20">
          <CalendarPlus className="h-3 w-3" /> Gia hạn
        </button>
        {canDelete && (
          <button onClick={() => c.setDeletingJob(j)} className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2 py-1 text-xs font-medium ring-1 ring-rose-500/20 hover:bg-rose-500/20">
            <Trash2 className="h-3 w-3" /> Xóa
          </button>
        )}
      </div>
    </div>
  )
}

function EditModalContent({ c }: { c: C }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold">Chỉnh sửa cronjob</h2>
          <p className="mt-1 text-sm text-muted-foreground">Cập nhật URL, phương thức và vòng lặp</p>
        </div>
        <button onClick={() => c.setEditingJob(null)} disabled={c.isSavingEdit} className="rounded-md p-1 hover:bg-accent">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-3">
        <Field label="URL Cronjob">
          <input
            type="text"
            value={c.editUrl}
            onChange={(e) => c.setEditUrl(e.target.value)}
            placeholder="https://example.com/api/cron"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-mono shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phương thức">
            <SelectCustom
              value={c.editMethod}
              onValueChange={(v) => c.setEditMethod(v as "GET" | "POST")}
              options={[
                { value: "GET", label: "GET" },
                { value: "POST", label: "POST" },
              ]}
            />
          </Field>
          <Field label={`Vòng lặp (≥${c.editingServer?.timeloop ?? 30}s)`}>
            <input
              type="number"
              value={c.editInterval}
              onChange={(e) => c.setEditInterval(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            />
          </Field>
        </div>
        <Field label="Headers (JSON, optional)">
          <textarea
            value={c.editHeaders}
            onChange={(e) => c.setEditHeaders(e.target.value)}
            rows={2}
            placeholder='{"Authorization": "Bearer xxx"}'
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          />
        </Field>
        {c.editMethod === "POST" && (
          <Field label="Body (raw, optional)">
            <textarea
              value={c.editBody}
              onChange={(e) => c.setEditBody(e.target.value)}
              rows={2}
              placeholder='{"key": "value"}'
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            />
          </Field>
        )}
      </div>
      <div className="flex gap-2 pt-2">
        <button
          onClick={() => c.setEditingJob(null)}
          disabled={c.isSavingEdit}
          className="flex-1 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
        >
          Hủy
        </button>
        <button
          onClick={c.handleSubmitEdit}
          disabled={c.isSavingEdit || !c.editUrl.trim() || !c.editInterval}
          className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {c.isSavingEdit ? "Đang lưu..." : "Cập nhật"}
        </button>
      </div>
    </div>
  )
}

function ExtendModalContent({ c }: { c: C }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold">Gia hạn cronjob</h2>
          <p className="mt-1 text-sm text-muted-foreground break-all">
            <span className="font-mono">{c.extendingJob && truncate(c.extendingJob.url, 48)}</span>
          </p>
        </div>
        <button onClick={() => c.setExtendingJob(null)} disabled={c.isExtending} className="rounded-md p-1 hover:bg-accent">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-3">
        <Field label="Số tháng gia hạn">
          <SelectCustom
            value={c.extendMonths}
            onValueChange={c.setExtendMonths}
            options={Array.from({ length: 12 }).map((_, i) => {
              const m = i + 1
              const cost = (c.extendingServer?.price || 0) * m
              return {
                value: String(m),
                label: `${m} tháng`,
                triggerLabel: `${m} tháng - ${formatPrice(cost)}`,
                description: formatPrice(cost),
              }
            })}
          />
        </Field>
        <div className="rounded-md bg-muted/50 p-3 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Hết hạn hiện tại:</span>
            <span className="font-medium">{c.extendingJob && formatDateTime(c.extendingJob.expiresAt)}</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>Tổng thanh toán:</span>
            <span className="text-primary">{formatPrice(c.extendCost)}</span>
          </div>
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <button
          onClick={() => c.setExtendingJob(null)}
          disabled={c.isExtending}
          className="flex-1 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
        >
          Hủy
        </button>
        <button
          onClick={c.handleSubmitExtend}
          disabled={c.isExtending || !c.extendingServer}
          className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {c.isExtending ? "Đang xử lý..." : `Gia hạn ${formatPrice(c.extendCost)}`}
        </button>
      </div>
    </div>
  )
}

function Pagination({ page, setPage, limit, setLimit, total, totalPages, startRow, endRow }: {
  page: number
  setPage: (p: number | ((prev: number) => number)) => void
  limit: number
  setLimit: (n: number) => void
  total: number
  totalPages: number
  startRow: number
  endRow: number
}) {
  return (
    <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>Hiển thị {startRow}-{endRow} / {total} kết quả</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Dòng</span>
          <SelectCustom
            value={String(limit)}
            onValueChange={(v) => setLimit(Number(v))}
            size="sm"
            className="w-[80px]"
            options={[
              { value: "5", label: "5" },
              { value: "10", label: "10" },
              { value: "20", label: "20" },
              { value: "50", label: "50" },
            ]}
          />
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage((p: number) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="inline-flex items-center justify-center rounded-md border bg-background px-3 h-8 text-sm font-medium shadow-xs hover:bg-accent disabled:opacity-50 disabled:pointer-events-none transition-all"
          >
            Trước
          </button>
          <span className="hidden sm:contents">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .map((p, idx, arr) => (
                <span key={p}>
                  {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-muted-foreground text-sm">...</span>}
                  <button
                    onClick={() => setPage(p)}
                    className={`inline-flex items-center justify-center rounded-md h-8 min-w-8 px-3 text-sm font-medium transition-all ${
                      p === page
                        ? "bg-primary text-primary-foreground"
                        : "border bg-background shadow-xs hover:bg-accent"
                    }`}
                  >
                    {p}
                  </button>
                </span>
              ))}
          </span>
          <span className="sm:hidden text-sm text-muted-foreground px-2">{page} / {totalPages}</span>
          <button
            onClick={() => setPage((p: number) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="inline-flex items-center justify-center rounded-md border bg-background px-3 h-8 text-sm font-medium shadow-xs hover:bg-accent disabled:opacity-50 disabled:pointer-events-none transition-all"
          >
            Sau
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Helpers / icons ────────────────────────────────────────────────────────

function ActionButton({ onClick, disabled, variant, title, children }: {
  onClick: () => void
  disabled?: boolean
  variant: "default" | "primary" | "success" | "warn" | "danger"
  title: string
  children: React.ReactNode
}) {
  const variants = {
    default: "border bg-background hover:bg-accent",
    primary: "bg-primary/10 text-primary ring-1 ring-primary/20 hover:bg-primary/20",
    success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20 hover:bg-emerald-500/20",
    warn: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 ring-1 ring-yellow-500/20 hover:bg-yellow-500/20",
    danger: "bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-1 ring-rose-500/20 hover:bg-rose-500/20",
  } as const
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center justify-center rounded-md p-1.5 text-xs font-medium transition-all disabled:pointer-events-none disabled:opacity-50 ${variants[variant]}`}
    >
      {children}
    </button>
  )
}

function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-2xl border bg-card p-6 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
    </label>
  )
}

function SortBtn({ field, current, dir, onClick, children }: {
  field: CronjobSortField
  current: CronjobSortField
  dir: SortDir
  onClick: (f: CronjobSortField) => void
  children: React.ReactNode
}) {
  return (
    <button onClick={() => onClick(field)} className="inline-flex items-center gap-1 hover:text-foreground -ms-2 px-2 py-1 rounded-md transition-colors">
      {children}
      <SortIcon active={current === field} dir={current === field ? dir : undefined} />
    </button>
  )
}

function SortIcon({ active, dir }: { active: boolean; dir?: SortDir }) {
  return (
    <span className="text-muted-foreground">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`size-3.5 ${active ? "opacity-100" : "opacity-40"}`}>
        {dir === "asc" ? (
          <path d="m3 8 4-4 4 4M7 4v16" />
        ) : dir === "desc" ? (
          <path d="m3 16 4 4 4-4M7 20V4" />
        ) : (
          <>
            <path d="m21 16-4 4-4-4" /><path d="M17 20V4" /><path d="m3 8 4-4 4 4" /><path d="M7 4v16" />
          </>
        )}
      </svg>
    </span>
  )
}

function ChevronRight() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/50"><path d="m9 18 6-6-6-6" /></svg>
}

function PlusIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
}

function SearchIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" {...props}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.34-4.34" />
    </svg>
  )
}



