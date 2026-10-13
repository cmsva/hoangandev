"use client"

import { useBulkSelect } from "@/hooks/use-bulk-select"
import { BulkActionBar, BulkSelectHead, BulkSelectCell } from "@/components/admin/bulk-action-bar"

import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { IconBracketsCurly } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SelectCustom } from "@/components/ui/select-custom"
import { SourceZipUpload } from "@/components/admin/source-zip-upload"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "@/components/ui/toast"
import { useTRPC } from "@/trpc/client"

interface DeployCodeRow {
  id: string
  name: string
  codeUrl: string
  configFilePath: string
  configTemplate: string
  sqlFilePath: string
  phpVersions: string[]
  defaultPhpVersion: string
  status: number
  createdAt: string
}

interface DeployCodeFormState {
  name: string
  codeUrl: string
  configFilePath: string
  configTemplate: string
  sqlFilePath: string
  phpVersion: string
  status: number
}

const PHP_VERSION_OPTIONS = ["72", "73", "74", "80", "81", "82", "83"] as const

const EMPTY_FORM: DeployCodeFormState = {
  name: "",
  codeUrl: "",
  configFilePath: ".env",
  configTemplate: "DB_HOST={{DB_HOST}}\nDB_DATABASE={{DB_NAME}}\nDB_USERNAME={{DB_USER}}\nDB_PASSWORD={{DB_PASS}}",
  sqlFilePath: "",
  phpVersion: "81",
  status: 1,
}

const textareaClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

function toForm(row?: DeployCodeRow | null): DeployCodeFormState {
  if (!row) return { ...EMPTY_FORM }
  return {
    name: row.name,
    codeUrl: row.codeUrl,
    configFilePath: row.configFilePath || ".env",
    configTemplate: row.configTemplate || "",
    sqlFilePath: row.sqlFilePath || "",
    phpVersion: row.phpVersions?.[0] || row.defaultPhpVersion || "81",
    status: row.status ?? 1,
  }
}

function normalizePayload(form: DeployCodeFormState) {
  const phpVersion = form.phpVersion || "81"
  return {
    name: form.name.trim(),
    codeUrl: form.codeUrl.trim(),
    configFilePath: form.configFilePath.trim() || ".env",
    configTemplate: form.configTemplate,
    sqlFilePath: form.sqlFilePath.trim(),
    phpVersions: [phpVersion],
    defaultPhpVersion: phpVersion,
    status: Number(form.status) || 0,
  }
}

function DeployCodeDialog({
  open,
  row,
  onOpenChange,
}: {
  open: boolean
  row?: DeployCodeRow | null
  onOpenChange: (open: boolean) => void
}) {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const [form, setForm] = useState<DeployCodeFormState>(() => toForm(row))

  useEffect(() => {
    if (open) setForm(toForm(row))
  }, [open, row])

  function set<K extends keyof DeployCodeFormState>(key: K, value: DeployCodeFormState[K]): void {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const createMut = useMutation({
    ...trpc.adminWebsite.createDeployCode.mutationOptions(),
    onSuccess: () => {
      toast.success("Đã tạo code deploy")
      qc.invalidateQueries({ queryKey: trpc.adminWebsite.listDeployCodes.queryKey() })
      onOpenChange(false)
    },
    onError: (error) => toast.error(error.message || "Lưu thất bại"),
  })

  const updateMut = useMutation({
    ...trpc.adminWebsite.updateDeployCode.mutationOptions(),
    onSuccess: () => {
      toast.success("Đã cập nhật code deploy")
      qc.invalidateQueries({ queryKey: trpc.adminWebsite.listDeployCodes.queryKey() })
      onOpenChange(false)
    },
    onError: (error) => toast.error(error.message || "Lưu thất bại"),
  })

  const isPending = createMut.isPending || updateMut.isPending

  function submit(): void {
    const payload = normalizePayload(form)
    if (!payload.name || !payload.codeUrl) {
      toast.error("Vui lòng nhập tên và Zip URL")
      return
    }
    if (row) updateMut.mutate({ id: row.id, data: payload })
    else createMut.mutate(payload)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{row ? "Sửa code deploy" : "Thêm code deploy"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Tên code deploy</Label>
            <Input value={form.name} onChange={(event) => set("name", event.target.value)} placeholder="Laravel template" />
          </div>
          <div className="space-y-2">
            <Label>Trạng thái</Label>
            <SelectCustom value={String(form.status)} onValueChange={(value) => set("status", Number(value))} options={[{ value: "1", label: "Hoạt động" }, { value: "0", label: "Tắt" }]} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Link tải code zip</Label>
            <SourceZipUpload value={form.codeUrl} onChange={(url) => set("codeUrl", url)} />
            <p className="text-xs text-muted-foreground">Dán link .zip trực tiếp, hoặc bấm Upload ZIP để tải file lên (tối đa 200MB). File sẽ lưu trên nơi cấu hình ở tab Lưu trữ (S3/R2). Không dùng Google Drive / MediaFire vì hay lỗi tải.</p>
          </div>
          <div className="space-y-2">
            <Label>File config</Label>
            <Input value={form.configFilePath} onChange={(event) => set("configFilePath", event.target.value)} className="font-mono" placeholder=".env" />
          </div>
          <div className="space-y-2">
            <Label>File SQL</Label>
            <Input value={form.sqlFilePath} onChange={(event) => set("sqlFilePath", event.target.value)} className="font-mono" placeholder="database.sql" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Phiên bản PHP</Label>
            <SelectCustom
              value={form.phpVersion}
              onValueChange={(value) => set("phpVersion", value)}
              options={PHP_VERSION_OPTIONS.map((version) => ({ value: version, label: `PHP ${version}` }))}
              placeholder="Chọn phiên bản PHP"
            />
            <p className="text-xs text-muted-foreground">Mỗi code deploy dùng đúng một phiên bản PHP, template website sẽ lấy version này.</p>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Config template</Label>
            <textarea value={form.configTemplate} onChange={(event) => set("configTemplate", event.target.value)} rows={10} className={`${textareaClass} font-mono`} placeholder="DB_HOST={{DB_HOST}}" />
            <p className="text-xs text-muted-foreground">Hỗ trợ: {"{{DB_HOST}}, {{DB_NAME}}, {{DB_DATABASE}}, {{DB_USER}}, {{DB_USERNAME}}, {{DB_PASS}}, {{DB_PASSWORD}}"}.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Hủy</Button>
          <Button onClick={submit} disabled={isPending}>{isPending ? "Đang lưu..." : "Lưu"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function AdminDeployCodesClient() {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const [searchInput, setSearchInput] = useState("")
  const [keyword, setKeyword] = useState("")
  const [editing, setEditing] = useState<DeployCodeRow | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<DeployCodeRow | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setKeyword(searchInput.trim()), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const { data, isLoading, isFetching } = useQuery(
    trpc.adminWebsite.listDeployCodes.queryOptions({ page: 1, limit: 50, keyword: keyword || undefined })
  ) as { data: { items: DeployCodeRow[] } | undefined; isLoading: boolean; isFetching: boolean }

  const rows = data?.items ?? []
  const deleteMut = useMutation({
    ...trpc.adminWebsite.deleteDeployCode.mutationOptions(),
    onSuccess: () => {
      toast.success("Đã xóa code deploy")
      setDeleting(null)
      qc.invalidateQueries({ queryKey: trpc.adminWebsite.listDeployCodes.queryKey() })
    },
    onError: (error) => toast.error(error.message || "Xóa thất bại"),
  })
  const bulk = useBulkSelect(rows)
  const bulkDeleteMut = useMutation({
    ...trpc.adminWebsite.bulkDeleteDeployCodes.mutationOptions(),
    onSuccess: (result) => { toast.success(`Đã xóa ${result.deleted} deploy code`); bulk.clearAll(); qc.invalidateQueries({ queryKey: trpc.adminWebsite.listDeployCodes.queryKey() }) },
    onError: (error) => toast.error(error.message),
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <IconBracketsCurly size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Code deploy</h1>
            <p className="text-sm text-muted-foreground">Gói source zip + template config dùng cho auto tạo website.</p>
          </div>
        </div>
        <Button onClick={() => setCreating(true)}>Thêm code deploy</Button>
      </div>

      <div className="relative max-w-sm">
        <Input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Tìm code deploy..." />
        {isFetching && !isLoading && <span className="absolute right-3 top-1/2 size-3 -translate-y-1/2 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />}
      </div>

      <div className="hidden rounded-md border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <BulkSelectHead checked={bulk.isAllSelected} onChange={bulk.toggleAll} />
              <TableHead>Tên</TableHead>
              <TableHead>Zip URL</TableHead>
              <TableHead>Config</TableHead>
              <TableHead>SQL</TableHead>
              <TableHead>PHP</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="text-end">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>{Array.from({ length: 9 }).map((__, cell) => <TableCell key={cell}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
              ))
            ) : rows.length > 0 ? (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <BulkSelectCell checked={bulk.isSelected(row.id)} onChange={() => bulk.toggle(row.id)} />
                  <TableCell className="font-semibold">{row.name}</TableCell>
                  <TableCell className="max-w-xs truncate font-mono text-xs">{row.codeUrl}</TableCell>
                  <TableCell className="font-mono text-xs">{row.configFilePath || "-"}</TableCell>
                  <TableCell className="font-mono text-xs">{row.sqlFilePath || "-"}</TableCell>
                  <TableCell className="text-xs">PHP {row.phpVersions?.[0] || row.defaultPhpVersion || "81"}</TableCell>
                  <TableCell><span className={row.status === 1 ? "text-primary" : "text-muted-foreground"}>{row.status === 1 ? "Hoạt động" : "Tắt"}</span></TableCell>
                  <TableCell className="text-end">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => setEditing(row)}>Sửa</Button>
                      <Button size="sm" variant="destructive" onClick={() => setDeleting(row)}>Xóa</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={9} className="h-24 text-center text-muted-foreground">Chưa có code deploy.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-3 md:hidden">
        {isLoading ? Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-32 w-full" />) : rows.map((row) => (
          <article key={row.id} className="space-y-3 rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{row.name}</h2>
                <p className="line-clamp-1 font-mono text-xs text-muted-foreground">{row.codeUrl}</p>
              </div>
              <span className="text-xs text-muted-foreground">{row.status === 1 ? "Hoạt động" : "Tắt"}</span>
            </div>
            <p className="text-xs text-muted-foreground">PHP {row.phpVersions?.[0] || row.defaultPhpVersion || "81"} · Config {row.configFilePath || "-"} · SQL {row.sqlFilePath || "-"}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(row)}>Sửa</Button>
              <Button size="sm" variant="destructive" onClick={() => setDeleting(row)}>Xóa</Button>
            </div>
          </article>
        ))}
      </div>

      <DeployCodeDialog open={creating} onOpenChange={setCreating} />
      <DeployCodeDialog open={Boolean(editing)} row={editing} onOpenChange={(open) => { if (!open) setEditing(null) }} />
      <BulkActionBar
        selectedCount={bulk.selectedCount}
        onClearAll={bulk.clearAll}
        onBulkDelete={() => bulkDeleteMut.mutate({ ids: bulk.getSelectedIds() })}
        isPending={bulkDeleteMut.isPending}
        entityLabel="deploy code"
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Xóa code deploy?"
        description={deleting ? `Code ${deleting.name} sẽ bị xóa khỏi danh sách deploy.` : ""}
        confirmText="Xóa"
        variant="destructive"
        isPending={deleteMut.isPending}
        onOpenChange={(open) => { if (!open) setDeleting(null) }}
        onConfirm={() => deleting && deleteMut.mutate({ id: deleting.id })}
      />
    </div>
  )
}
