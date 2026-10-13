"use client"

import { useEffect, useMemo, useState } from "react"
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { IconMonitor } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SelectCustom } from "@/components/ui/select-custom"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import { useTRPC } from "@/trpc/client"

type AaPanelStatus = "active" | "disabled"

interface AaPanelServerRow {
  id: string
  name: string
  panelUrl: string
  apiKey: string
  rootPath: string
  dbHost: string
  serverIp: string
  priority: number
  maxSites: number
  status: AaPanelStatus
  notes: string | null
  createdAt: string
}

interface AaPanelRealtimeStatus {
  success: boolean
  cpuPercent: number
  ramPercent: number
  diskPercent: number
  websiteCount: number
  loadAverage: string | null
  loadStatus: string | null
  uptime: string | null
  os: string | null
  panelVersion: string | null
  cpuInfo: string | null
  memoryUsed: string | null
  memoryTotal: string | null
  diskUsed: string | null
  diskTotal: string | null
  networkUp: string | null
  networkDown: string | null
}

interface AaPanelFormState {
  name: string
  panelUrl: string
  apiKey: string
  rootPath: string
  dbHost: string
  serverIp: string
  priority: number
  maxSites: number
  status: AaPanelStatus
  notes: string
}

interface AaPanelPayload extends Omit<AaPanelFormState, "notes"> {
  notes: string | null
}

interface ValidationResult {
  data: AaPanelPayload
  error: string | null
}
const EMPTY_FORM: AaPanelFormState = {
  name: "",
  panelUrl: "",
  apiKey: "",
  rootPath: "/www/wwwroot",
  dbHost: "127.0.0.1",
  serverIp: "",
  priority: 100,
  maxSites: 0,
  status: "active",
  notes: "",
}

const STATUS_OPTIONS = [
  { value: "active", label: "Đang dùng" },
  { value: "disabled", label: "Tạm tắt" },
]

function toForm(server?: AaPanelServerRow | null): AaPanelFormState {
  if (!server) return EMPTY_FORM
  return {
    name: server.name,
    panelUrl: server.panelUrl,
    apiKey: "",
    rootPath: server.rootPath,
    dbHost: server.dbHost,
    serverIp: server.serverIp,
    priority: server.priority,
    maxSites: server.maxSites,
    status: server.status,
    notes: server.notes ?? "",
  }
}

function validateForm(form: AaPanelFormState, isEditing: boolean): ValidationResult {
  const data = {
    ...form,
    name: form.name.trim(),
    panelUrl: form.panelUrl.trim(),
    apiKey: form.apiKey.trim(),
    rootPath: form.rootPath.trim() || "/www/wwwroot",
    dbHost: form.dbHost.trim() || "127.0.0.1",
    serverIp: form.serverIp.trim(),
    priority: Number(form.priority),
    maxSites: Number(form.maxSites),
    notes: form.notes.trim() || null,
  }

  if (!data.name) return { data, error: "Vui lòng nhập tên server" }
  if (!data.panelUrl) return { data, error: "Vui lòng nhập Panel URL" }
  try {
    new URL(data.panelUrl)
  } catch {
    return { data, error: "Panel URL phải có dạng https://ip:port" }
  }
  if (!data.serverIp) return { data, error: "Vui lòng nhập Server IP" }
  if (!isEditing && !data.apiKey) return { data, error: "Vui lòng nhập API key" }
  if (!Number.isInteger(data.priority) || data.priority < 0) return { data, error: "Priority phải là số nguyên từ 0" }
  if (!Number.isInteger(data.maxSites) || data.maxSites < 0) return { data, error: "Max sites phải là số nguyên từ 0" }
  return { data, error: null }
}

function formatDateTime(input: unknown): string {
  if (!input) return "-"
  const date = new Date(String(input))
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString("vi-VN")
}

function getLoadTone(percent: number): string {
  if (percent >= 85) return "text-destructive"
  if (percent >= 65) return "text-amber-500"
  return "text-primary"
}

function getLoadLabel(percent: number): string {
  if (percent >= 85) return "High"
  if (percent >= 65) return "Medium"
  return "Normal"
}

function getStrokeDash(percent: number): string {
  const clamped = Math.max(0, Math.min(100, percent))
  return `${Math.round((clamped / 100) * 88)} 88`
}

function getLoadStatusTone(status?: string | null): string {
  if (!status) return "text-primary"
  if (/busy|high|danger|critical|error|overload|fail/i.test(status)) return "text-destructive"
  if (/slow|warning|medium|caution|normal/i.test(status)) return "text-amber-500"
  return "text-primary"
}

export function AdminAaPanelClient() {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const [searchInput, setSearchInput] = useState("")
  const [keyword, setKeyword] = useState("")
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<AaPanelServerRow | null>(null)
  const [deleting, setDeleting] = useState<AaPanelServerRow | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setKeyword(searchInput.trim()), 350)
    return () => clearTimeout(timer)
  }, [searchInput])

  const { data, isLoading, isFetching } = useQuery(
    trpc.adminWebsite.listAaPanelServers.queryOptions({ page: 1, limit: 50, keyword: keyword || undefined })
  ) as { data: { items: AaPanelServerRow[] } | undefined; isLoading: boolean; isFetching: boolean }

  const servers = data?.items ?? []
  const statusQueries = useQueries({
    queries: servers.map((server) => ({
      ...trpc.adminWebsite.getAaPanelServerStatus.queryOptions({ id: server.id }),
      enabled: server.status === "active",
      staleTime: 0,
      refetchInterval: 5_000,
      refetchOnWindowFocus: true,
      retry: 1,
    })),
  })
  const statusByServerId = useMemo(() => {
    return servers.reduce<Record<string, { data?: AaPanelRealtimeStatus; isLoading: boolean; isError: boolean }>>((acc, server, index) => {
      const query = statusQueries[index]
      acc[server.id] = {
        data: query?.data as AaPanelRealtimeStatus | undefined,
        isLoading: query?.isLoading ?? false,
        isError: query?.isError ?? false,
      }
      return acc
    }, {})
  }, [servers, statusQueries])
  const deleteMut = useMutation({
    ...trpc.adminWebsite.deleteAaPanelServer.mutationOptions(),
    onSuccess: () => {
      toast.success("Đã xóa server")
      setDeleting(null)
      qc.invalidateQueries({ queryKey: trpc.adminWebsite.listAaPanelServers.queryKey() })
    },
    onError: (err) => toast.error(err.message || "Xóa thất bại"),
  })
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <IconMonitor size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Server aaPanel</h1>
            <p className="text-sm text-muted-foreground">Quản lý nhiều server để auto tạo website theo ưu tiên và số slot.</p>
          </div>
        </div>
        <Button onClick={() => setCreating(true)}>Thêm server</Button>
      </div>

      <div className="relative max-w-sm">
        <Input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Tìm theo tên server..." />
        {isFetching && !isLoading && <span className="absolute right-3 top-1/2 size-3 -translate-y-1/2 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />}
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="p-4 sm:p-6">
          {isLoading ? (
            <ServerSkeletonGrid />
          ) : servers.length > 0 ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {servers.map((server) => (
                <ServerConsoleCard
                  key={server.id}
                  server={server}
                  status={statusByServerId[server.id]}
                  onEdit={() => setEditing(server)}
                  onDelete={() => setDeleting(server)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">Chưa có server aaPanel.</div>
          )}
        </div>
      </div>

      {(creating || editing) && (
        <AaPanelFormDialog
          editing={editing}
          onClose={() => { setCreating(false); setEditing(null) }}
          onSaved={() => qc.invalidateQueries({ queryKey: trpc.adminWebsite.listAaPanelServers.queryKey() })}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Xóa server aaPanel"
        description={`Xóa server "${deleting?.name ?? ""}" khỏi danh sách auto tạo website?`}
        variant="destructive"
        confirmText="Xóa"
        cancelText="Hủy"
        isPending={deleteMut.isPending}
        onConfirm={() => deleting && deleteMut.mutate({ id: deleting.id })}
      />
    </div>
  )
}

function AaPanelFormDialog({ editing, onClose, onSaved }: { editing: AaPanelServerRow | null; onClose: () => void; onSaved: () => void }) {
  const trpc = useTRPC()
  const [form, setForm] = useState<AaPanelFormState>(() => toForm(editing))
  const isEditing = !!editing
  const title = isEditing ? "Cập nhật server aaPanel" : "Thêm server aaPanel"
  const createMut = useMutation({
    ...trpc.adminWebsite.createAaPanelServer.mutationOptions(),
    onSuccess: () => { toast.success("Đã thêm server"); onSaved(); onClose() },
    onError: (err) => toast.error(err.message || "Tạo thất bại"),
  })
  const updateMut = useMutation({
    ...trpc.adminWebsite.updateAaPanelServer.mutationOptions(),
    onSuccess: () => { toast.success("Đã cập nhật server"); onSaved(); onClose() },
    onError: (err) => toast.error(err.message || "Cập nhật thất bại"),
  })
  const isPending = createMut.isPending || updateMut.isPending
  const apiHint = useMemo(() => isEditing ? "Để trống nếu không đổi API key" : "API key lấy trong aaPanel > Settings > API", [isEditing])

  function set<K extends keyof AaPanelFormState>(key: K, value: AaPanelFormState[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(): void {
    const validated = validateForm(form, isEditing)
    if (validated.error) {
      toast.error(validated.error)
      return
    }
    if (isEditing) {
      updateMut.mutate({ id: editing.id, data: validated.data })
      return
    }
    createMut.mutate(validated.data)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !isPending && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <Field label="Tên server" value={form.name} onChange={(value) => set("name", value)} placeholder="VD: VN Node 01" required />
          <Field label="Panel URL" value={form.panelUrl} onChange={(value) => set("panelUrl", value)} placeholder="https://1.2.3.4:7800" required />
          <Field label="API key" value={form.apiKey} onChange={(value) => set("apiKey", value)} placeholder={apiHint} required={!isEditing} />
          <Field label="Server IP" value={form.serverIp} onChange={(value) => set("serverIp", value)} placeholder="1.2.3.4" required />
          <Field label="Root path" value={form.rootPath} onChange={(value) => set("rootPath", value)} placeholder="/www/wwwroot" />
          <Field label="Database host" value={form.dbHost} onChange={(value) => set("dbHost", value)} placeholder="127.0.0.1" />
          <NumberField label="Priority" value={form.priority} onChange={(value) => set("priority", value)} min={0} />
          <NumberField label="Max sites" value={form.maxSites} onChange={(value) => set("maxSites", value)} min={0} helper="0 = không giới hạn" />
          <div className="flex flex-col gap-1.5">
            <Label>Trạng thái</Label>
            <SelectCustom value={form.status} onValueChange={(value) => set("status", value as AaPanelStatus)} options={STATUS_OPTIONS} />
          </div>
          <Field label="Ghi chú" value={form.notes} onChange={(value) => set("notes", value)} placeholder="VD: server chính, chỉ chạy shop..." />
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>Hủy</Button>
          <Button type="button" onClick={handleSubmit} disabled={isPending}>{isPending ? "Đang lưu..." : "Lưu"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}{required && <span className="text-destructive"> *</span>}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </div>
  )
}

function NumberField({ label, value, onChange, min, helper }: { label: string; value: number; onChange: (value: number) => void; min: number; helper?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <Input type="number" min={min} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
    </div>
  )
}

function ServerConsoleCard({ server, status, onEdit, onDelete }: { server: AaPanelServerRow; status?: { data?: AaPanelRealtimeStatus; isLoading: boolean; isError: boolean }; onEdit: () => void; onDelete: () => void }) {
  const isOnline = !!status?.data?.success
  const isDisabled = server.status === "disabled"
  const cpu = status?.data?.cpuPercent ?? 0
  const ram = status?.data?.ramPercent ?? 0
  const disk = status?.data?.diskPercent ?? 0

  return (
    <article className="overflow-hidden rounded-2xl border bg-background shadow-sm transition-colors hover:border-primary/40">
      <div className="flex flex-col gap-4 border-b bg-muted/20 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <RealtimeStatusRing isOnline={isOnline} isLoading={status?.isLoading ?? false} isError={status?.isError ?? false} isDisabled={isDisabled} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold">{server.name}</h2>
              <StatusBadge status={server.status} />
            </div>
            <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{server.panelUrl}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={onEdit}>Sửa</Button>
          <Button variant="destructive" size="sm" onClick={onDelete}>Xóa</Button>
        </div>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[1fr_220px]">
        <div className="grid gap-3 sm:grid-cols-3">
          <LoadDial label="CPU" value={cpu} />
          <LoadDial label="RAM" value={ram} detail={status?.data?.memoryUsed && status.data.memoryTotal ? `${status.data.memoryUsed}/${status.data.memoryTotal}` : undefined} />
          <LoadDial label="Disk" value={disk} detail={status?.data?.diskUsed && status.data.diskTotal ? `${status.data.diskUsed}/${status.data.diskTotal}` : undefined} />
        </div>
        <div className="rounded-xl border bg-muted/20 p-3">
          <LoadStatusPanel status={status?.data} />
          <div className="mt-4 border-t pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Websites</p>
            <p className="mt-2 text-3xl font-bold">{status?.data?.websiteCount ?? "--"}</p>
            <p className="mt-1 text-xs text-muted-foreground">Slot: {server.maxSites > 0 ? server.maxSites : "Không giới hạn"}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 border-t p-4 text-sm sm:grid-cols-4 lg:grid-cols-6">
        <Info label="IP" value={server.serverIp} />
        <Info label="OS" value={status?.data?.os ?? "--"} />
        <Info label="Panel" value={status?.data?.panelVersion ?? "--"} />
        <Info label="Network" value={`${status?.data?.networkUp ?? "--"} / ${status?.data?.networkDown ?? "--"}`} />
        <Info label="Priority" value={String(server.priority)} />
        <Info label="Root" value={server.rootPath} />
      </div>
    </article>
  )
}

function LoadStatusPanel({ status }: { status?: AaPanelRealtimeStatus }) {
  const loadStatus = status?.loadStatus ?? "Smooth operation"
  const loadAverage = status?.loadAverage ?? "-- / -- / --"
  const tone = getLoadStatusTone(loadStatus)

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Load status</p>
      <p className={`mt-2 text-sm font-semibold ${tone}`}>{loadStatus}</p>
      <p className="mt-1 font-mono text-xl font-bold tracking-tight">{loadAverage}</p>
      <p className="mt-1 text-xs text-muted-foreground">1 / 5 / 15 min</p>
    </div>
  )
}

function RealtimeStatusRing({ isOnline, isLoading, isError, isDisabled }: { isOnline: boolean; isLoading: boolean; isError: boolean; isDisabled: boolean }) {
  const label = isDisabled ? "Disabled" : isLoading ? "Checking" : isError ? "Error" : isOnline ? "Online" : "Offline"
  const dotClass = isDisabled ? "bg-muted-foreground" : isError ? "bg-destructive" : isOnline ? "bg-primary" : "bg-amber-500"
  const ringClass = isOnline && !isDisabled ? "ring-primary/30" : "ring-muted-foreground/20"

  return (
    <div className={`relative flex size-14 shrink-0 items-center justify-center rounded-full bg-card ring-4 ${ringClass}`} aria-label={`Server status ${label}`}>
      <span className={`size-5 rounded-full ${dotClass}`} />
      {isLoading && <span className="absolute inset-0 animate-ping rounded-full border border-primary/40" />}
      <span className="sr-only">{label}</span>
    </div>
  )
}

function LoadDial({ label, value, detail }: { label: string; value: number; detail?: string }) {
  const tone = getLoadTone(value)

  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative mx-auto size-24">
        <svg className="size-24 -rotate-90 transition-transform duration-700" viewBox="0 0 36 36" aria-hidden="true">
          <circle className="text-muted" cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="3" />
          <circle className={`${tone} origin-center animate-spin transition-all duration-700 motion-reduce:animate-none`} cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeDasharray={getStrokeDash(value)} strokeLinecap="round" strokeWidth="3" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-xl font-bold">{value}%</span>
          <span className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</span>
        </div>
      </div>
      <p className={`mt-2 text-xs font-semibold ${tone}`}>{getLoadLabel(value)}</p>
      {detail && <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>}
    </div>
  )
}

function ServerSkeletonGrid() {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="rounded-2xl border bg-background p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-14 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-64 max-w-full" />
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  )
}

function StatusBadge({ status }: { status: AaPanelStatus }) {
  const label = status === "active" ? "Đang dùng" : "Tạm tắt"
  const className = status === "active" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>{label}</span>
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-muted/20 p-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate font-medium">{value}</p>
    </div>
  )
}
