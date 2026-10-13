"use client"

import * as React from "react"
import { useCampaigns, type ButtonInput } from "@/hooks/use-campaigns"
import type { CampaignType } from "@/models/campaign.model"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { CKEditor } from "@/components/admin/ckeditor"
import { sanitizeRichHtml } from "@/lib/sanitize"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/confirm-dialog"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import {
  IconSearch,
  IconPlus,
  IconCircleCheck,
  IconClock,
  IconTrash,
  IconEye,
  IconLoader,
  IconCheck,
  IconExternalLink,
} from "@/components/icons"
import { cn } from "@/lib/utils"
import { GenerateAiButton } from "@/components/admin/generate-ai-button"

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  draft: { label: "Bản nháp", cls: "bg-slate-500/10 text-slate-600 border-slate-500/30" },
  queued: { label: "Đã lên lịch", cls: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  sending: { label: "Đang gửi", cls: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
  sent: { label: "Hoàn tất", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  failed: { label: "Thất bại", cls: "bg-rose-500/10 text-rose-600 border-rose-500/30" },
  cancelled: { label: "Đã huỷ", cls: "bg-gray-500/10 text-gray-600 border-gray-500/30" },
}

function formatDate(d: Date | string | null) {
  if (!d) return "—"
  const date = new Date(d)
  return date.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" })
}

interface CampaignsClientProps {
  type: CampaignType
}

export function CampaignsClient({ type }: CampaignsClientProps) {
  const c = useCampaigns(type)

  const isMail = type === "mail"
  const title = isMail ? "Chiến dịch Email" : "Chiến dịch Telegram"
  const subtitle = isMail
    ? "Gửi email hàng loạt cho người dùng đã xác thực email"
    : "Gửi tin nhắn cho người dùng đã liên kết bot Telegram"

  const [confirmDelete, setConfirmDelete] = React.useState<string | null>(null)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2">
            <a href="/adminPanel/dashboard" className="hover:text-foreground transition-colors">
              Admin
            </a>
            <span>/</span>
            <span className="text-foreground font-medium">{title}</span>
          </nav>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        <Button onClick={c.openCreate} className="gap-2">
          <IconPlus size={16} />
          Tạo chiến dịch
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {[
            { key: "all", label: "Tất cả" },
            { key: "draft", label: "Nháp" },
            { key: "queued", label: "Đã lên lịch" },
            { key: "sending", label: "Đang gửi" },
            { key: "sent", label: "Hoàn tất" },
            { key: "failed", label: "Thất bại" },
            { key: "cancelled", label: "Đã huỷ" },
          ].map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => c.setStatusFilter(f.key as any)}
              className={cn(
                "h-8 px-3 rounded-full text-xs font-semibold border transition-colors",
                c.statusFilter === f.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <form
          className="relative max-w-xs flex-1 sm:max-w-sm"
          onSubmit={(e) => {
            e.preventDefault()
            c.onSearchSubmit()
          }}
        >
          <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm theo tên hoặc tiêu đề..."
            value={c.searchInput}
            onChange={(e) => c.setSearchInput(e.target.value)}
            className="h-9 pl-9"
          />
        </form>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">#</TableHead>
              <TableHead>Tên / Tiêu đề</TableHead>
              <TableHead>Audience</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Tiến độ</TableHead>
              <TableHead>Thời gian</TableHead>
              <TableHead className="text-end">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {c.isLoadingList ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : c.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  Chưa có chiến dịch nào.
                </TableCell>
              </TableRow>
            ) : (
              c.items.map((it: any, idx: number) => {
                const s = STATUS_LABEL[it.status] || STATUS_LABEL.draft
                return (
                  <TableRow key={it.id}>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {(c.page - 1) * 20 + idx + 1}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{it.name}</div>
                      {it.subject && (
                        <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-[280px]">
                          {it.subject}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {audienceLabel(it.audience)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[10px] uppercase font-bold border", s.cls)}>
                        {s.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm tabular-nums">
                        <span className="text-emerald-600 font-semibold">{it.sentCount}</span>
                        <span className="text-muted-foreground mx-1">/</span>
                        <span className="font-semibold">{it.targetCount}</span>
                        {it.failedCount > 0 && (
                          <span className="text-rose-600 ml-1.5 text-xs">
                            ({it.failedCount} fail)
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <IconClock size={11} /> Tạo: {formatDate(it.createdAt)}
                        </div>
                        {it.scheduledAt && (
                          <div className="flex items-center gap-1 text-amber-600 mt-0.5">
                            <IconClock size={11} /> Hẹn: {formatDate(it.scheduledAt)}
                          </div>
                        )}
                        {it.finishedAt && (
                          <div className="flex items-center gap-1 text-emerald-600 mt-0.5">
                            <IconCircleCheck size={11} /> Xong: {formatDate(it.finishedAt)}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => c.openEdit(it.id)}
                          className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-accent"
                          title="Xem / Chỉnh sửa"
                        >
                          <IconEye size={14} />
                        </button>
                        {(it.status === "draft" || it.status === "queued") && (
                          <button
                            onClick={() => c.cancelCampaign(it.id)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 px-2.5 py-1 text-xs font-medium text-amber-600 transition-colors hover:bg-amber-500/10"
                            title="Huỷ"
                          >
                            Huỷ
                          </button>
                        )}
                        {it.status !== "sending" && (
                          <button
                            onClick={() => setConfirmDelete(it.id)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/30 px-2.5 py-1 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-500/10"
                            title="Xoá"
                          >
                            <IconTrash size={14} />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {c.totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">
            Trang {c.page} / {c.totalPages} · {c.total} chiến dịch
          </span>
          <div className="flex gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => c.setPage(Math.max(1, c.page - 1))}
              disabled={c.page === 1}
            >
              Trước
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => c.setPage(Math.min(c.totalPages, c.page + 1))}
              disabled={c.page === c.totalPages}
            >
              Sau
            </Button>
          </div>
        </div>
      )}

      {/* Editor Dialog */}
      <CampaignEditor c={c} type={type} />

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(o) => {
          if (!o) setConfirmDelete(null)
        }}
        title="Xoá chiến dịch?"
        description="Hành động này không thể hoàn tác."
        variant="destructive"
        confirmText="Xoá"
        onConfirm={() => {
          if (confirmDelete) {
            c.deleteCampaign(confirmDelete)
            setConfirmDelete(null)
          }
        }}
      />
    </div>
  )
}

function audienceLabel(a: string): string {
  if (a === "verified_email") return "Email đã xác thực"
  if (a === "linked_telegram") return "Đã liên kết Telegram"
  return "Tất cả"
}

// ═══════════════════════════════════════════════════════════════════════════
// Editor
// ═══════════════════════════════════════════════════════════════════════════

function CampaignEditor({
  c,
  type,
}: {
  c: ReturnType<typeof useCampaigns>
  type: CampaignType
}) {
  const isMail = type === "mail"
  const isLoadingDetail = c.isLoadingDetail && c.editingId

  return (
    <Dialog open={c.editorOpen} onOpenChange={(o) => !o && c.closeEditor()}>
      <DialogContent className="sm:max-w-[920px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {c.editingId ? "Chi tiết chiến dịch" : "Tạo chiến dịch mới"}
            {c.readOnly && (
              <Badge variant="outline" className="ml-2 text-[10px]">
                Chỉ xem (đã lên lịch)
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoadingDetail ? (
          <div className="space-y-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
            {/* ─── Form bên trái ─── */}
            <div className="space-y-4">
              <FieldGroup label="Tên chiến dịch (nội bộ)" hint="Chỉ admin xem, không gửi cho user">
                <Input
                  value={c.name}
                  onChange={(e) => c.setName(e.target.value)}
                  placeholder="VD: Khuyến mãi tháng 12"
                  disabled={c.readOnly}
                />
              </FieldGroup>

              {isMail && (
                <FieldGroup
                  label="Tiêu đề email"
                  hint="Hiển thị ở subject của email"
                  rightSlot={
                    !c.readOnly && (
                      <GenerateAiButton
                        kind="mail_subject"
                        onApply={(text) => c.setSubject(text)}
                        related={[{ label: "Tên ch.dịch", value: c.name }]}
                        size="sm"
                        label="Generated by AI"
                      />
                    )
                  }
                >
                  <Input
                    value={c.subject}
                    onChange={(e) => c.setSubject(e.target.value)}
                    placeholder="Tiêu đề thư"
                    disabled={c.readOnly}
                  />
                </FieldGroup>
              )}

              <FieldGroup
                label={isMail ? "Nội dung HTML" : "Nội dung Telegram"}
                hint={
                  isMail
                    ? "WYSIWYG editor — hỗ trợ HTML đầy đủ (heading, image, link, table, ...)"
                    : "Hỗ trợ HTML giới hạn của Telegram: <b>, <i>, <a>, <code>, <pre>"
                }
                rightSlot={
                  !c.readOnly && (
                    <GenerateAiButton
                      kind={isMail ? "mail_html" : "telegram_text"}
                      onApply={(text) => c.setContent(text)}
                      related={[
                        { label: "Tên ch.dịch", value: c.name },
                        ...(isMail
                          ? [{ label: "Subject", value: c.subject }]
                          : []),
                      ]}
                      size="sm"
                      label="Generated by AI"
                    />
                  )
                }
              >
                {isMail ? (
                  <CKEditor
                    value={c.content}
                    onChange={(html) => c.setContent(html)}
                    height={420}
                    placeholder="Nhập nội dung email..."
                  />
                ) : (
                  <Textarea
                    value={c.content}
                    onChange={(e) => c.setContent(e.target.value)}
                    placeholder={"<b>Thông báo</b>\nNội dung tin nhắn..."}
                    rows={8}
                    className="font-mono text-xs resize-none"
                    disabled={c.readOnly}
                  />
                )}
              </FieldGroup>

              {/* Telegram buttons */}
              {!isMail && (
                <FieldGroup
                  label="Nút inline (tối đa 6)"
                  hint="Mỗi nút sẽ hiển thị thành 1 hàng dưới tin nhắn"
                >
                  <div className="space-y-2">
                    {c.buttons.map((b: ButtonInput, i: number) => (
                      <div key={i} className="flex gap-2">
                        <Input
                          placeholder="Tên nút"
                          value={b.text}
                          onChange={(e) => c.updateButton(i, "text", e.target.value)}
                          disabled={c.readOnly}
                          className="flex-1"
                        />
                        <Input
                          placeholder="https://..."
                          value={b.url}
                          onChange={(e) => c.updateButton(i, "url", e.target.value)}
                          disabled={c.readOnly}
                          className="flex-[2]"
                        />
                        {!c.readOnly && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => c.removeButton(i)}
                            className="shrink-0"
                          >
                            <IconTrash size={14} />
                          </Button>
                        )}
                      </div>
                    ))}
                    {!c.readOnly && c.buttons.length < 6 && (
                      <Button type="button" variant="outline" size="sm" onClick={c.addButton}>
                        <IconPlus size={14} className="mr-1" /> Thêm nút
                      </Button>
                    )}
                  </div>
                </FieldGroup>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FieldGroup label="Audience" hint="Đối tượng nhận">
                  <select
                    value={c.audience}
                    onChange={(e) => c.setAudience(e.target.value as any)}
                    disabled={c.readOnly}
                    className="h-9 rounded-md border border-input bg-transparent px-3 text-sm w-full"
                  >
                    {isMail ? (
                      <>
                        <option value="verified_email">Đã xác thực email</option>
                        <option value="all">Tất cả (chỉ verified)</option>
                      </>
                    ) : (
                      <>
                        <option value="linked_telegram">Đã liên kết Telegram</option>
                        <option value="all">Tất cả (chỉ linked)</option>
                      </>
                    )}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Số người dự kiến:{" "}
                    {c.isLoadingAudience ? (
                      "…"
                    ) : (
                      <strong className="text-foreground">
                        {(c.audienceCount ?? 0).toLocaleString("vi-VN")}
                      </strong>
                    )}{" "}
                    người
                  </p>
                </FieldGroup>

                <FieldGroup label="Lên lịch" hint="Để trống = gửi ngay">
                  <Input
                    type="datetime-local"
                    value={c.scheduledAt}
                    onChange={(e) => c.setScheduledAt(e.target.value)}
                    disabled={c.readOnly}
                  />
                </FieldGroup>
              </div>
            </div>

            {/* ─── Preview bên phải ─── */}
            <div className="space-y-3">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Xem trước
              </Label>
              {isMail ? (
                <MailPreview subject={c.subject} html={c.content} />
              ) : (
                <TelegramPreview content={c.content} buttons={c.buttons} />
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        {!c.readOnly && !isLoadingDetail && (
          <div className="flex flex-wrap items-center justify-end gap-2 mt-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={c.testSend} disabled={c.isTesting}>
              {c.isTesting ? <IconLoader size={14} className="animate-spin mr-2" /> : null}
              Gửi thử
            </Button>
            <Button type="button" variant="outline" onClick={c.saveDraft} disabled={c.isSaving}>
              {c.isSaving ? <IconLoader size={14} className="animate-spin mr-2" /> : <IconCheck size={14} className="mr-2" />}
              Lưu nháp
            </Button>
            <Button type="button" onClick={c.saveAndQueue} disabled={c.isSaving || c.isQueuing}>
              {c.isQueuing ? (
                <IconLoader size={14} className="animate-spin mr-2" />
              ) : (
                <IconCircleCheck size={14} className="mr-2" />
              )}
              {c.scheduledAt ? "Lưu & Lên lịch" : "Lưu & Gửi ngay"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function FieldGroup({
  label,
  hint,
  children,
  rightSlot,
}: {
  label: string
  hint?: string
  children: React.ReactNode
  rightSlot?: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-medium">{label}</Label>
        {rightSlot}
      </div>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

// ─── Previews ───────────────────────────────────────────────────────────────

function MailPreview({ subject, html }: { subject: string; html: string }) {
  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      <div className="bg-slate-50 border-b px-4 py-2.5 space-y-0.5">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
          Tiêu đề
        </div>
        <div className="text-sm font-semibold text-slate-900 truncate">
          {subject || "(Chưa có tiêu đề)"}
        </div>
      </div>
      <div
        className="p-4 text-sm text-slate-800 max-h-[420px] overflow-y-auto prose prose-sm prose-slate max-w-none"
        dangerouslySetInnerHTML={{ __html: html ? sanitizeRichHtml(html) : "<p style='color:#94a3b8'>(Chưa có nội dung)</p>" }}
      />
    </div>
  )
}

function TelegramPreview({
  content,
  buttons,
}: {
  content: string
  buttons: ButtonInput[]
}) {
  return (
    <div className="rounded-xl bg-[#7BA0CE] p-3 shadow-sm">
      <div className="rounded-2xl rounded-tl-sm bg-white px-3 py-2 max-w-[320px] shadow-sm">
        <div
          className="text-sm text-slate-900 whitespace-pre-wrap"
          dangerouslySetInnerHTML={{
            __html: content ? sanitizeRichHtml(content) : "<span style='color:#94a3b8'>(Chưa có nội dung)</span>",
          }}
        />
        {buttons.length > 0 && (
          <div className="mt-2 -mx-1 -mb-1 space-y-1 pt-1 border-t border-slate-100">
            {buttons.map((b, i) => (
              <button
                key={i}
                type="button"
                className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                title={b.url || "URL chưa nhập"}
                disabled
              >
                {b.text || "(Tên nút)"} <IconExternalLink size={11} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
