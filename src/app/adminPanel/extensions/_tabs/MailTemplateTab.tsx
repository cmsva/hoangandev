"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"
import { GenerateAiButton } from "@/components/admin/generate-ai-button"

// Mirror of MAIL_TEMPLATE_KEYS from server
const MAIL_TEMPLATE_CONFIG = [
  { key: "verify_email", label: "Xác minh email", desc: "Gửi OTP khi user xác minh email", icon: "✉️" },
  { key: "login", label: "Thông báo đăng nhập", desc: "Gửi khi đăng nhập thành công", icon: "🔔" },
  { key: "forgot_password", label: "Quên mật khẩu", desc: "Gửi OTP khi quên mật khẩu", icon: "🔑" },
  { key: "change_password", label: "Đổi mật khẩu", desc: "Gửi khi đổi mật khẩu thành công", icon: "🔒" },
  { key: "deposit_success", label: "Nạp tiền thành công", desc: "Gửi khi nạp tiền hoàn tất", icon: "💰" },
  { key: "order_website", label: "Đơn Mã nguồn", desc: "Gửi khi mua source code", icon: "🛒" },
  { key: "order_domain", label: "Đơn Tên miền", desc: "Gửi khi đăng ký domain", icon: "🌐" },
  { key: "order_cronjob", label: "Đơn CronJob", desc: "Gửi khi mua CronJob", icon: "⏰" },
  { key: "renew_cronjob", label: "Gia hạn CronJob", desc: "Gửi khi gia hạn CronJob", icon: "🔄" },
  { key: "order_logo", label: "Đơn Logo", desc: "Gửi khi đặt logo", icon: "🎨" },
  { key: "order_status", label: "Cập nhật đơn hàng", desc: "Gửi khi admin cập nhật trạng thái", icon: "📦" },
  { key: "ticket_reply", label: "Phản hồi ticket", desc: "Gửi khi admin phản hồi ticket", icon: "💬" },
] as const

const MAIL_TEMPLATE_VARS: Record<string, Array<{ key: string; desc: string }>> = {
  verify_email: [
    { key: "{domain}", desc: "Link Website" }, { key: "{title}", desc: "Tên website" },
    { key: "{username}", desc: "Tên KH" }, { key: "{otp}", desc: "Mã OTP" },
  ],
  login: [
    { key: "{domain}", desc: "Link Website" }, { key: "{title}", desc: "Tên website" },
    { key: "{username}", desc: "Tên KH" }, { key: "{ip}", desc: "IP" },
    { key: "{device}", desc: "Thiết bị" }, { key: "{time}", desc: "Thời gian" },
  ],
  forgot_password: [
    { key: "{domain}", desc: "Link Website" }, { key: "{title}", desc: "Tên website" },
    { key: "{username}", desc: "Tên KH" }, { key: "{otp}", desc: "Mã OTP" },
  ],
  change_password: [
    { key: "{domain}", desc: "Link Website" }, { key: "{title}", desc: "Tên website" },
    { key: "{username}", desc: "Tên KH" }, { key: "{ip}", desc: "IP" },
    { key: "{device}", desc: "Thiết bị" }, { key: "{time}", desc: "Thời gian" },
  ],
  deposit_success: [
    { key: "{domain}", desc: "Link Website" }, { key: "{title}", desc: "Tên website" },
    { key: "{username}", desc: "Tên KH" }, { key: "{amount}", desc: "Số tiền" },
    { key: "{balance}", desc: "Số dư" }, { key: "{method}", desc: "Phương thức" },
    { key: "{time}", desc: "Thời gian" },
  ],
  order_website: [
    { key: "{domain}", desc: "Link Website" }, { key: "{title}", desc: "Tên website" },
    { key: "{username}", desc: "Tên KH" }, { key: "{product_name}", desc: "Sản phẩm" },
    { key: "{total}", desc: "Tổng tiền" }, { key: "{time}", desc: "Thời gian" },
  ],
  order_domain: [
    { key: "{domain}", desc: "Link Website" }, { key: "{title}", desc: "Tên website" },
    { key: "{username}", desc: "Tên KH" }, { key: "{domain_name}", desc: "Tên miền" },
    { key: "{total}", desc: "Tổng tiền" }, { key: "{time}", desc: "Thời gian" },
  ],
  order_cronjob: [
    { key: "{domain}", desc: "Link Website" }, { key: "{title}", desc: "Tên website" },
    { key: "{username}", desc: "Tên KH" }, { key: "{url}", desc: "URL CronJob" },
    { key: "{interval}", desc: "Interval (giây)" }, { key: "{months}", desc: "Số tháng" },
    { key: "{total}", desc: "Tổng tiền" }, { key: "{time}", desc: "Thời gian" },
  ],
  renew_cronjob: [
    { key: "{domain}", desc: "Link Website" }, { key: "{title}", desc: "Tên website" },
    { key: "{username}", desc: "Tên KH" }, { key: "{url}", desc: "URL CronJob" },
    { key: "{months}", desc: "Số tháng" }, { key: "{total}", desc: "Tổng tiền" },
    { key: "{time}", desc: "Thời gian" },
  ],
  order_logo: [
    { key: "{domain}", desc: "Link Website" }, { key: "{title}", desc: "Tên website" },
    { key: "{username}", desc: "Tên KH" }, { key: "{logo_name}", desc: "Đơn hàng logo" },
    { key: "{shop_name}", desc: "Tên shop" }, { key: "{total}", desc: "Tổng tiền" },
    { key: "{time}", desc: "Thời gian" },
  ],
  order_status: [
    { key: "{domain}", desc: "Link Website" }, { key: "{title}", desc: "Tên website" },
    { key: "{username}", desc: "Tên KH" }, { key: "{order_type}", desc: "Loại đơn" },
    { key: "{order_name}", desc: "Tên đơn" }, { key: "{status}", desc: "Trạng thái" },
    { key: "{time}", desc: "Thời gian" },
  ],
  ticket_reply: [
    { key: "{domain}", desc: "Link Website" }, { key: "{title}", desc: "Tên website" },
    { key: "{username}", desc: "Tên KH" }, { key: "{ticket_id}", desc: "Mã ticket" },
    { key: "{ticket_title}", desc: "Tiêu đề" }, { key: "{message}", desc: "Nội dung" },
    { key: "{time}", desc: "Thời gian" },
  ],
}

interface TemplateData {
  emailTitle: string
  emailBody: string
}

export function MailTemplateTab() {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const { data, isLoading } = useQuery(
    trpc.adminExtensions.getMailTemplates.queryOptions()
  )

  const [local, setLocal] = React.useState<Record<string, TemplateData>>({})
  const [previewKey, setPreviewKey] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (data && Object.keys(local).length === 0) {
      const next: Record<string, TemplateData> = {}
      for (const [k, v] of Object.entries(data)) {
        next[k] = { emailTitle: v.emailTitle, emailBody: v.emailBody }
      }
      setLocal(next)
    }
  }, [data, local])

  const saveMut = useMutation({
    ...trpc.adminExtensions.saveMailTemplate.mutationOptions(),
    onSuccess: () => {
      toast.success("Đã lưu template")
      qc.invalidateQueries({ queryKey: trpc.adminExtensions.getMailTemplates.queryKey() })
    },
    onError: (err: any) => toast.error(err?.message || "Lưu thất bại"),
  })

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {MAIL_TEMPLATE_CONFIG.map((tpl) => {
        const item = local[tpl.key] ?? data[tpl.key]
        const vars = MAIL_TEMPLATE_VARS[tpl.key] || []
        return (
          <div key={tpl.key} className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{tpl.icon}</span>
                <div>
                  <h3 className="text-sm font-bold">{tpl.label}</h3>
                  <p className="text-[11px] text-muted-foreground">{tpl.desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewKey(tpl.key)}
                >
                  Xem trước
                </Button>
                <Button
                  size="sm"
                  disabled={saveMut.isPending}
                  onClick={() => {
                    if (!item?.emailTitle.trim() || !item?.emailBody.trim()) {
                      toast.error("Tiêu đề và nội dung không được trống")
                      return
                    }
                    saveMut.mutate({ key: tpl.key, emailTitle: item.emailTitle, emailBody: item.emailBody })
                  }}
                >
                  {saveMut.isPending ? "Đang lưu..." : "Lưu"}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs">Tiêu đề Email</Label>
                <GenerateAiButton
                  kind="mail_subject"
                  onApply={(text) =>
                    setLocal((prev) => ({
                      ...prev,
                      [tpl.key]: { emailTitle: text, emailBody: item?.emailBody ?? "" },
                    }))
                  }
                  related={[
                    { label: "Template", value: tpl.label },
                    { label: "Mô tả", value: tpl.desc },
                    {
                      label: "Biến có sẵn",
                      value: vars.map((v) => `${v.key}=${v.desc}`).join(", "),
                    },
                  ]}
                  size="sm"
                  label="Generated by AI"
                />
              </div>
              <Input
                value={item?.emailTitle ?? ""}
                onChange={(e) =>
                  setLocal((prev) => ({
                    ...prev,
                    [tpl.key]: { ...item, emailTitle: e.target.value, emailBody: item?.emailBody ?? "" },
                  }))
                }
                placeholder="Tiêu đề..."
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs">Nội dung Email (HTML)</Label>
                <GenerateAiButton
                  kind="mail_html"
                  onApply={(html) =>
                    setLocal((prev) => ({
                      ...prev,
                      [tpl.key]: { emailTitle: item?.emailTitle ?? "", emailBody: html },
                    }))
                  }
                  related={[
                    { label: "Template", value: tpl.label },
                    { label: "Mục đích", value: tpl.desc },
                    { label: "Subject", value: item?.emailTitle ?? "" },
                    {
                      label: "Biến (giữ nguyên)",
                      value: vars.map((v) => `${v.key}=${v.desc}`).join(", "),
                    },
                  ]}
                  hintPlaceholder={`VD: Tạo template cho ${tpl.label.toLowerCase()}, ngắn gọn 2 đoạn, có CTA, giữ nguyên các biến ${vars.slice(0, 3).map((v) => v.key).join(", ")}`}
                  size="sm"
                  label="Generated by AI"
                />
              </div>
              <Textarea
                value={item?.emailBody ?? ""}
                onChange={(e) =>
                  setLocal((prev) => ({
                    ...prev,
                    [tpl.key]: { emailTitle: item?.emailTitle ?? "", emailBody: e.target.value },
                  }))
                }
                rows={8}
                className="font-mono text-xs"
                placeholder="<p>Nội dung email...</p>"
              />
            </div>

            <div className="border-t border-border pt-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Biến có thể sử dụng
              </p>
              <div className="flex flex-wrap gap-1.5">
                {vars.map((v) => (
                  <span
                    key={v.key}
                    className="rounded border border-dashed border-border bg-muted/40 px-2 py-0.5 font-mono text-[11px] text-muted-foreground"
                  >
                    {v.key} → {v.desc}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )
      })}

      {previewKey && (
        <PreviewDialog
          title={local[previewKey]?.emailTitle ?? (data as Record<string, { emailTitle: string; emailBody: string }>)[previewKey]?.emailTitle ?? ""}
          html={local[previewKey]?.emailBody ?? (data as Record<string, { emailTitle: string; emailBody: string }>)[previewKey]?.emailBody ?? ""}
          onClose={() => setPreviewKey(null)}
        />
      )}
    </div>
  )
}

function PreviewDialog({
  title,
  html,
  onClose,
}: {
  title: string
  html: string
  onClose: () => void
}) {
  // Substitute placeholder vars with sample data for preview
  function fillSampleVars(s: string): string {
    const samples: Record<string, string> = {
      "{title}": "Hệ thống",
      "{domain}": "https://example.com",
      "{username}": "demo_user",
      "{otp}": "123456",
      "{ip}": "203.0.113.42",
      "{device}": "Chrome 120 / Windows",
      "{time}": new Date().toLocaleString("vi-VN"),
      "{amount}": "100.000đ",
      "{balance}": "500.000đ",
      "{method}": "MB Bank",
      "{product_name}": "Sample Product",
      "{domain_name}": "myshop.com",
      "{cronjob_name}": "Cron 30s",
      "{logo_name}": "Logo Demo",
      "{order_type}": "Mã nguồn",
      "{order_name}": "ORD-001",
      "{status}": "Đã duyệt",
      "{ticket_id}": "T-001",
      "{ticket_title}": "Lỗi đăng nhập",
      "{message}": "Đã xử lý xong, vui lòng thử lại.",
      "{total}": "200.000đ",
    }
    let r = s
    for (const [k, v] of Object.entries(samples)) r = r.replaceAll(k, v)
    return r
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Xem trước email</p>
            <p className="line-clamp-1 text-sm font-semibold">{fillSampleVars(title)}</p>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            Đóng
          </Button>
        </div>
        <iframe
          title="Email preview"
          className="flex-1 border-0 bg-white"
          srcDoc={fillSampleVars(html)}
        />
      </div>
    </div>
  )
}

void cn // unused-import suppression
