 "use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { IconShield } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SelectCustom } from "@/components/ui/select-custom"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import { useTRPC } from "@/trpc/client"

type CloudflareStatus = "active" | "disabled"
type AnalyticsRange = "24h" | "7d" | "30d"
type DnsRecordType = "A" | "AAAA" | "CNAME" | "TXT" | "MX"

interface CloudflareAccountRow {
  id: string
  name: string
  accountId: string | null
  authEmail: string | null
  authMode: "apiToken" | "globalKey"
  apiToken: string
  defaultNs1: string | null
  defaultNs2: string | null
  status: CloudflareStatus
  notes: string | null
  createdAt: string
}

interface CloudflareFormState {
  name: string
  accountId: string
  authEmail: string
  authMode: "apiToken" | "globalKey"
  apiToken: string
  defaultNs1: string
  defaultNs2: string
  status: CloudflareStatus
  notes: string
}
interface AnalyticsSummary {
  uniqueVisitors: number
  uniqueIps: number
  requests: number
  bandwidthBytes: number
  cachedPercent: number
  cachedBytes: number
  requestSeries: Array<{ label: string; requests: number; visitors: number }>
  trafficSeries: Array<{ label: string; bandwidthBytes: number; cachedBytes: number }>
}

interface ZoneSummary {
  id: string
  name: string
  status: string
  paused: boolean
  type: string
  nameServers: string[]
}

interface DnsRecordSummary {
  id: string
  type: string
  name: string
  content: string
  proxied: boolean
  ttl: number
}

const EMPTY_FORM: CloudflareFormState = { name: "Cloudflare Global", accountId: "", authEmail: "", authMode: "globalKey", apiToken: "", defaultNs1: "", defaultNs2: "", status: "active", notes: "" }
const RANGE_OPTIONS: Array<{ value: AnalyticsRange; label: string }> = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
]
const DNS_TYPE_OPTIONS = ["A", "AAAA", "CNAME", "TXT", "MX"] as const
const EMPTY_DNS_FORM = { type: "A" as DnsRecordType, name: "", content: "", proxied: true, ttl: 1 }
const STATUS_OPTIONS = [
  { value: "active", label: "Đang dùng" },
  { value: "disabled", label: "Tạm tắt" },
]

function formatCompact(value: number): string {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value)
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ["KB", "MB", "GB", "TB"]
  let value = bytes / 1024
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[index]}`
}

function toForm(account?: CloudflareAccountRow | null): CloudflareFormState {
  if (!account) return EMPTY_FORM
  return { name: account.name, accountId: account.accountId ?? "", authEmail: account.authEmail ?? "", authMode: account.authMode ?? "globalKey", apiToken: "", defaultNs1: account.defaultNs1 ?? "", defaultNs2: account.defaultNs2 ?? "", status: account.status, notes: account.notes ?? "" }
}
export function AdminCloudflareClient() {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const [configOpen, setConfigOpen] = useState(false)
  const [editing, setEditing] = useState<CloudflareAccountRow | null>(null)
  const [range, setRange] = useState<AnalyticsRange>("24h")
  const [selectedZone, setSelectedZone] = useState<ZoneSummary | null>(null)

  const accountsQuery = useQuery(trpc.adminWebsite.listCloudflareAccounts.queryOptions({ page: 1, limit: 50 })) as { data?: { items: CloudflareAccountRow[] }; isLoading: boolean }
  const accounts = accountsQuery.data?.items ?? []
  const activeAccount = accounts.find((account) => account.status === "active") ?? accounts[0]

  const dashboardQuery = useQuery({
    ...trpc.adminWebsite.getCloudflareDashboard.queryOptions({ accountId: activeAccount?.id ?? "", zoneId: selectedZone?.id, range }),
    enabled: !!activeAccount,
    staleTime: 30_000,
  }) as { data?: { analytics: AnalyticsSummary; zones: ZoneSummary[]; selectedZoneId: string | null }; isLoading: boolean; isError: boolean }

  const analytics = dashboardQuery.data?.analytics
  const zones = dashboardQuery.data?.zones ?? []
  const selectedZoneId = selectedZone?.id ?? dashboardQuery.data?.selectedZoneId ?? undefined
  const selectedZoneForDns = selectedZone ?? zones.find((zone) => zone.id === selectedZoneId) ?? null

  const dnsQuery = useQuery({
    ...trpc.adminWebsite.listCloudflareDnsRecords.queryOptions({ accountId: activeAccount?.id ?? "", zoneId: selectedZoneId ?? "" }),
    enabled: !!activeAccount && !!selectedZoneId,
    staleTime: 30_000,
  }) as { data?: DnsRecordSummary[]; isLoading: boolean }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-orange-500/15 text-orange-600"><IconShield size={20} /></div>
          <div><h1 className="text-2xl font-bold tracking-tight">Cloudflare</h1><p className="text-sm text-muted-foreground">Cloudflare thu nhỏ: traffic analytics, zone và DNS trong một màn hình.</p></div>
        </div>
        <Button onClick={() => { setEditing(activeAccount ?? null); setConfigOpen(true) }}>Cấu hình</Button>
      </div>

      {!activeAccount ? <EmptyCloudflare onConfigure={() => setConfigOpen(true)} /> : (
        <>
          <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="font-semibold">{activeAccount.name}</p><p className="text-sm text-muted-foreground">Chọn domain bên dưới để xem analytics theo zone.</p></div>
            <RangeTabs value={range} onChange={setRange} />
          </div>
          <ZonePicker zones={zones} selectedZoneId={selectedZoneId} onSelect={setSelectedZone} />
          <ProtectionPanel accountId={activeAccount.id} zone={selectedZoneForDns} />
          {dashboardQuery.isLoading ? <DashboardSkeleton /> : analytics ? <CloudflareDashboard analytics={analytics} /> : <EmptyAnalytics />}
          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <ZonesPanel zones={zones} onSelect={setSelectedZone} selectedZoneId={selectedZoneId} />
            <DnsPanel accountId={activeAccount.id} zone={selectedZoneForDns} records={dnsQuery.data ?? []} isLoading={dnsQuery.isLoading} onChanged={() => qc.invalidateQueries({ queryKey: trpc.adminWebsite.listCloudflareDnsRecords.queryKey() })} />
          </div>
        </>
      )}

      <ConfigDialog open={configOpen} editing={editing} onOpenChange={setConfigOpen} onSaved={() => qc.invalidateQueries({ queryKey: trpc.adminWebsite.listCloudflareAccounts.queryKey() })} />
    </div>
  )
}
function CloudflareDashboard({ analytics }: { analytics: AnalyticsSummary }) {
  const cards = [
    { label: "Unique Visitors", value: formatCompact(analytics.uniqueVisitors), helper: "Unique IPs" },
    { label: "Total Requests", value: formatCompact(analytics.requests), helper: "HTTP Requests" },
    { label: "Data Served", value: formatBytes(analytics.bandwidthBytes), helper: "Total Bandwidth" },
    { label: "Cached", value: `${analytics.cachedPercent}%`, helper: `${formatBytes(analytics.cachedBytes)} Data Cached` },
  ]
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map((card) => <MetricCard key={card.label} {...card} />)}</div>
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Requests & Visitors" series={analytics.requestSeries.map((item) => ({ label: item.label, primary: item.requests, secondary: item.visitors }))} primaryLabel="Requests" secondaryLabel="Visitors" />
        <ChartCard title="Data Traffic" series={analytics.trafficSeries.map((item) => ({ label: item.label, primary: item.bandwidthBytes, secondary: item.cachedBytes }))} primaryLabel="Served" secondaryLabel="Cached" isBytes />
      </div>
    </div>
  )
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return <Card><CardContent><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-bold tracking-tight">{value}</p><p className="mt-1 text-xs text-muted-foreground">{helper}</p></CardContent></Card>
}

function ChartCard({ title, series, primaryLabel, secondaryLabel, isBytes }: { title: string; series: Array<{ label: string; primary: number; secondary: number }>; primaryLabel: string; secondaryLabel: string; isBytes?: boolean }) {
  const max = Math.max(...series.flatMap((item) => [item.primary, item.secondary]), 1)
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>
        <div className="flex h-56 items-end gap-2 overflow-hidden rounded-xl border bg-muted/20 p-3">
          {series.slice(-16).map((item, index) => (
            <div key={`${item.label}-${index}`} className="flex min-w-6 flex-1 flex-col items-center gap-1">
              <div className="flex h-40 w-full items-end gap-1">
                <div className="w-full rounded-t bg-primary transition-all" style={{ height: `${Math.max(4, (item.primary / max) * 100)}%` }} />
                <div className="w-full rounded-t bg-orange-500 transition-all" style={{ height: `${Math.max(4, (item.secondary / max) * 100)}%` }} />
              </div>
              <span className="truncate text-[10px] text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-4 text-xs text-muted-foreground"><span>{primaryLabel}</span><span>{secondaryLabel}</span>{isBytes && <span>{formatBytes(series.reduce((t, i) => t + i.primary, 0))}</span>}</div>
      </CardContent>
    </Card>
  )
}
function ZonePicker({ zones, selectedZoneId, onSelect }: { zones: ZoneSummary[]; selectedZoneId?: string; onSelect: (zone: ZoneSummary) => void }) {
  if (zones.length === 0) return null
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {zones.map((zone) => (
        <button key={zone.id} className={`rounded-2xl border bg-card p-4 text-left transition-colors hover:border-primary/50 ${selectedZoneId === zone.id ? "border-primary ring-2 ring-primary/20" : ""}`} onClick={() => onSelect(zone)}>
          <p className="truncate font-semibold">{zone.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">{zone.status} · {zone.type}</p>
        </button>
      ))}
    </div>
  )
}

function RangeTabs({ value, onChange }: { value: AnalyticsRange; onChange: (value: AnalyticsRange) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-xl border bg-background p-1">
      {RANGE_OPTIONS.map((option) => (
        <button key={option.value} className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${value === option.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  )
}

function ProtectionPanel({ accountId, zone }: { accountId: string; zone: ZoneSummary | null }) {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const protectionQuery = useQuery({
    ...trpc.adminWebsite.getCloudflareProtection.queryOptions({ accountId, zoneId: zone?.id ?? "" }),
    enabled: !!zone,
    staleTime: 15_000,
  }) as { data?: { challengeEnabled: boolean; rateLimitEnabled: boolean; securityLevel: string }; isLoading: boolean }
  const guardMut = useMutation({
    ...trpc.adminWebsite.setCloudflareProtection.mutationOptions(),
    onSuccess: () => {
      toast.success("Đã cập nhật bảo vệ")
      qc.invalidateQueries({ queryKey: trpc.adminWebsite.getCloudflareProtection.queryKey() })
    },
    onError: (err) => toast.error(err.message || "Cập nhật thất bại"),
  })
  function setMode(mode: "challenge" | "rate", enabled: boolean): void {
    if (!zone) { toast.error("Chọn domain trước"); return }
    guardMut.mutate({ accountId, zoneId: zone.id, mode, enabled })
  }
  const challengeStatus = protectionQuery.data?.challengeEnabled ? "ON" : "OFF"
  const rateStatus = protectionQuery.data?.rateLimitEnabled ? "ON" : "OFF"
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Card><CardContent className="flex items-center justify-between gap-4"><div><div className="flex items-center gap-2"><p className="font-semibold">Challenge</p><span className={protectionQuery.data?.challengeEnabled ? "rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-semibold text-green-600" : "rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground"}>{protectionQuery.isLoading ? "..." : challengeStatus}</span></div><p className="text-sm text-muted-foreground">Security level: {protectionQuery.data?.securityLevel ?? "--"}</p></div><div className="flex gap-2"><Button size="sm" onClick={() => setMode("challenge", true)} disabled={!zone || guardMut.isPending}>Bật</Button><Button size="sm" variant="outline" onClick={() => setMode("challenge", false)} disabled={!zone || guardMut.isPending}>Tắt</Button></div></CardContent></Card>
      <Card><CardContent className="flex items-center justify-between gap-4"><div><div className="flex items-center gap-2"><p className="font-semibold">Traffic Guard</p><span className={protectionQuery.data?.rateLimitEnabled ? "rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-semibold text-green-600" : "rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground"}>{protectionQuery.isLoading ? "..." : rateStatus}</span></div><p className="text-sm text-muted-foreground">Block 150 requests / 10 giây theo IP.</p></div><div className="flex gap-2"><Button size="sm" onClick={() => setMode("rate", true)} disabled={!zone || guardMut.isPending}>Bật</Button><Button size="sm" variant="outline" onClick={() => setMode("rate", false)} disabled={!zone || guardMut.isPending}>Tắt</Button></div></CardContent></Card>
    </div>
  )
}

function ZonesPanel({ zones, selectedZoneId, onSelect }: { zones: ZoneSummary[]; selectedZoneId?: string; onSelect: (zone: ZoneSummary) => void }) {
  return <Card><CardHeader><CardTitle>Zones</CardTitle></CardHeader><CardContent className="space-y-2">{zones.length === 0 ? <p className="text-sm text-muted-foreground">Chưa có zone.</p> : zones.map((zone) => <button key={zone.id} className={`w-full rounded-xl border p-3 text-left transition-colors hover:border-primary/50 ${selectedZoneId === zone.id ? "border-primary bg-primary/5" : "bg-background"}`} onClick={() => onSelect(zone)}><div className="flex items-center justify-between gap-3"><p className="font-semibold">{zone.name}</p><span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{zone.status}</span></div><p className="mt-1 text-xs text-muted-foreground">NS: {zone.nameServers.join(", ") || "--"}</p></button>)}</CardContent></Card>
}

function DnsPanel({ accountId, zone, records, isLoading, onChanged }: { accountId: string; zone: ZoneSummary | null; records: DnsRecordSummary[]; isLoading: boolean; onChanged: () => void }) {
  const trpc = useTRPC()
  const [editing, setEditing] = useState<DnsRecordSummary | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const deleteMut = useMutation({ ...trpc.adminWebsite.deleteCloudflareDnsRecord.mutationOptions(), onSuccess: () => { toast.success("Đã xóa DNS"); onChanged() }, onError: (err) => toast.error(err.message || "Xóa thất bại") })
  return <Card><CardHeader><div className="flex items-center justify-between gap-3"><CardTitle>DNS Records</CardTitle><Button size="sm" disabled={!zone} onClick={() => { setEditing(null); setFormOpen(true) }}>Thêm</Button></div></CardHeader><CardContent>{!zone ? <p className="text-sm text-muted-foreground">Chọn zone để xem DNS.</p> : isLoading ? <Skeleton className="h-36 rounded-xl" /> : <div className="space-y-2">{records.length === 0 ? <p className="text-sm text-muted-foreground">Zone chưa có record.</p> : records.map((record) => <div key={record.id} className="rounded-xl border bg-background p-3"><div className="flex items-center justify-between gap-3"><p className="font-mono text-sm font-semibold">{record.name}</p><span className="rounded bg-muted px-2 py-0.5 text-xs">{record.type}</span></div><p className="mt-1 truncate text-sm text-muted-foreground">{record.content}</p><div className="mt-3 flex items-center justify-between gap-2"><p className="text-xs text-muted-foreground">{record.proxied ? "Proxied" : "DNS only"} · TTL {record.ttl}</p><div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => { setEditing(record); setFormOpen(true) }}>Sửa</Button><Button size="sm" variant="destructive" disabled={deleteMut.isPending} onClick={() => deleteMut.mutate({ accountId, zoneId: zone.id, recordId: record.id })}>Xóa</Button></div></div></div>)}</div>} {zone && <DnsDialog open={formOpen} accountId={accountId} zoneId={zone.id} editing={editing} onOpenChange={setFormOpen} onSaved={onChanged} />}</CardContent></Card>
}

function DnsDialog({ open, accountId, zoneId, editing, onOpenChange, onSaved }: { open: boolean; accountId: string; zoneId: string; editing: DnsRecordSummary | null; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
  const trpc = useTRPC()
  const [form, setForm] = useState(() => editing ? { type: editing.type as DnsRecordType, name: editing.name, content: editing.content, proxied: editing.proxied, ttl: editing.ttl } : EMPTY_DNS_FORM)
  useMemo(() => setForm(editing ? { type: editing.type as DnsRecordType, name: editing.name, content: editing.content, proxied: editing.proxied, ttl: editing.ttl } : EMPTY_DNS_FORM), [editing])
  const createMut = useMutation({ ...trpc.adminWebsite.createCloudflareDnsRecord.mutationOptions(), onSuccess: () => { toast.success("Đã lưu DNS"); onSaved(); onOpenChange(false) }, onError: (err) => toast.error(err.message || "Lưu thất bại") })
  const updateMut = useMutation({ ...trpc.adminWebsite.updateCloudflareDnsRecord.mutationOptions(), onSuccess: () => { toast.success("Đã cập nhật DNS"); onSaved(); onOpenChange(false) }, onError: (err) => toast.error(err.message || "Cập nhật thất bại") })
  const isPending = createMut.isPending || updateMut.isPending
  function handleSave(): void {
    const record = { ...form, name: form.name.trim(), content: form.content.trim(), ttl: Number(form.ttl) }
    if (!record.name || !record.content) { toast.error("Thiếu DNS record"); return }
    if (editing) { updateMut.mutate({ accountId, zoneId, recordId: editing.id, record }); return }
    createMut.mutate({ accountId, zoneId, record })
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>{editing ? "Sửa DNS" : "Thêm DNS"}</DialogTitle></DialogHeader><div className="grid gap-4 py-2 sm:grid-cols-2"><div className="flex flex-col gap-1.5"><Label>Type</Label><SelectCustom value={form.type} onValueChange={(value) => setForm((prev) => ({ ...prev, type: value as DnsRecordType }))} options={DNS_TYPE_OPTIONS.map((type) => ({ value: type, label: type }))} /></div><Field label="Name" value={form.name} onChange={(value) => setForm((prev) => ({ ...prev, name: value }))} required /><Field label="Content" value={form.content} onChange={(value) => setForm((prev) => ({ ...prev, content: value }))} required /><Field label="TTL" value={String(form.ttl)} onChange={(value) => setForm((prev) => ({ ...prev, ttl: Number(value) }))} /><div className="flex items-center gap-2"><input type="checkbox" checked={form.proxied} onChange={(event) => setForm((prev) => ({ ...prev, proxied: event.target.checked }))} /><Label>Proxy</Label></div></div><DialogFooter><Button variant="outline" disabled={isPending} onClick={() => onOpenChange(false)}>Hủy</Button><Button disabled={isPending} onClick={handleSave}>Lưu</Button></DialogFooter></DialogContent></Dialog>
}

function EmptyCloudflare({ onConfigure }: { onConfigure: () => void }) {
  return <div className="rounded-2xl border border-dashed p-8 text-center"><p className="font-semibold">Chưa cấu hình Cloudflare</p><p className="mt-1 text-sm text-muted-foreground">Thêm API token để xem traffic toàn bộ domain trong account.</p><Button className="mt-4" onClick={onConfigure}>Cấu hình</Button></div>
}

function EmptyAnalytics() {
  return <div className="rounded-2xl border p-8 text-center text-sm text-muted-foreground">Không có dữ liệu analytics hoặc token thiếu quyền GraphQL Analytics.</div>
}

function DashboardSkeleton() {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-xl" />)}</div>
}
function ConfigDialog({ open, editing, onOpenChange, onSaved }: { open: boolean; editing: CloudflareAccountRow | null; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
  const trpc = useTRPC()
  const [form, setForm] = useState<CloudflareFormState>(() => toForm(editing))
  useMemo(() => setForm(toForm(editing)), [editing])
  const isEditing = !!editing
  const createMut = useMutation({ ...trpc.adminWebsite.createCloudflareAccount.mutationOptions(), onSuccess: () => { toast.success("Đã lưu Cloudflare"); onSaved(); onOpenChange(false) }, onError: (err) => toast.error(err.message || "Lưu thất bại") })
  const updateMut = useMutation({ ...trpc.adminWebsite.updateCloudflareAccount.mutationOptions(), onSuccess: () => { toast.success("Đã cập nhật Cloudflare"); onSaved(); onOpenChange(false) }, onError: (err) => toast.error(err.message || "Cập nhật thất bại") })
  const isPending = createMut.isPending || updateMut.isPending
  function set<K extends keyof CloudflareFormState>(key: K, value: CloudflareFormState[K]): void { setForm((prev) => ({ ...prev, [key]: value })) }
  function handleSave(): void {
    const data = { name: form.name.trim(), accountId: form.accountId.trim() || null, authEmail: form.authEmail.trim() || null, authMode: form.authMode, apiToken: form.apiToken.trim(), defaultNs1: form.defaultNs1.trim() || null, defaultNs2: form.defaultNs2.trim() || null, status: form.status, notes: form.notes.trim() || null }
    if (!data.name) { toast.error("Vui lòng nhập tên cấu hình"); return }
    if (data.authMode === "globalKey" && !data.authEmail) { toast.error("Vui lòng nhập email Cloudflare"); return }
    if (!isEditing && !data.apiToken) { toast.error("Vui lòng nhập Global API Key"); return }
    if (isEditing) { updateMut.mutate({ id: editing.id, data }); return }
    createMut.mutate(data)
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>{isEditing ? "Cập nhật Cloudflare" : "Cấu hình Cloudflare"}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <Field label="Tên cấu hình" value={form.name} onChange={(value) => set("name", value)} required />
          <Field label="Cloudflare Email" value={form.authEmail} onChange={(value) => set("authEmail", value)} placeholder="admin@example.com" required />
          <Field label="Account ID" value={form.accountId} onChange={(value) => set("accountId", value)} placeholder="Tuỳ chọn" />
          <Field label="Global API Key" value={form.apiToken} onChange={(value) => set("apiToken", value)} placeholder={isEditing ? "Để trống nếu không đổi" : "Cloudflare Global API Key"} required={!isEditing} />
          <Field label="NS cố định #1" value={form.defaultNs1} onChange={(value) => set("defaultNs1", value)} placeholder="ví dụ: ns1.cloudflare.com" required />
          <Field label="NS cố định #2" value={form.defaultNs2} onChange={(value) => set("defaultNs2", value)} placeholder="ví dụ: ns2.cloudflare.com" required />
          <div className="flex flex-col gap-1.5"><Label>Trạng thái</Label><SelectCustom value={form.status} onValueChange={(value) => set("status", value as CloudflareStatus)} options={STATUS_OPTIONS} /></div>
          <div className="sm:col-span-2"><Field label="Ghi chú" value={form.notes} onChange={(value) => set("notes", value)} placeholder="Token analytics + zone DNS" /></div>
        </div>
        <DialogFooter><Button variant="outline" disabled={isPending} onClick={() => onOpenChange(false)}>Hủy</Button><Button disabled={isPending} onClick={handleSave}>{isPending ? "Đang lưu..." : "Lưu"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean }) {
  return <div className="flex flex-col gap-1.5"><Label>{label}{required && <span className="text-destructive"> *</span>}</Label><Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></div>
}
