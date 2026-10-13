"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/client"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import { GenerateAiButton } from "@/components/admin/generate-ai-button"

const TELE_TEMPLATE_CONFIG = [
  // ─── ADMIN ───────────────────────────────────────────────────────────────
  { key: "admin_register", group: "admin", label: "Đăng ký thành viên mới", desc: "Khi có User mới đăng ký", icon: "👤" },
  { key: "admin_deposit", group: "admin", label: "Nạp tiền thành công", desc: "Khi User nạp tiền", icon: "💰" },
  { key: "admin_invoice", group: "admin", label: "Tạo hóa đơn", desc: "Khi User tạo hóa đơn nạp tiền bank", icon: "🧾" },
  { key: "admin_card_recharge", group: "admin", label: "Nạp thẻ cào", desc: "Khi User nạp thẻ cào thành công", icon: "💳" },
  { key: "admin_order_website", group: "admin", label: "Mua Mã nguồn", desc: "Khi User mua source code", icon: "🛒" },
  { key: "admin_order_domain", group: "admin", label: "Đăng ký Tên miền", desc: "Khi User đăng ký domain", icon: "🌍" },
  { key: "admin_order_cronjob", group: "admin", label: "Mua CronJob", desc: "Khi User thuê CronJob", icon: "⏰" },
  { key: "admin_renew_cronjob", group: "admin", label: "Gia hạn CronJob", desc: "Khi User gia hạn CronJob", icon: "🔄" },
  { key: "admin_order_logo", group: "admin", label: "Đặt Logo", desc: "Khi User đặt thiết kế logo", icon: "🎨" },
  { key: "admin_ticket_new", group: "admin", label: "Ticket mới", desc: "Khi User tạo ticket hỗ trợ", icon: "🎫" },
  // ─── USER ──────────────────────────────────────────────────────────────
  { key: "user_link_success", group: "user", label: "Liên kết thành công", desc: "Gửi khi user vừa liên kết tele", icon: "🎉" },
  { key: "user_login", group: "user", label: "Đăng nhập", desc: "Gửi khi user đăng nhập", icon: "🔔" },
  { key: "user_deposit", group: "user", label: "Nạp tiền thành công", desc: "Gửi khi user nạp tiền", icon: "💰" },
  { key: "user_order", group: "user", label: "Mua dịch vụ", desc: "Gửi khi user mua source/cron/logo/domain", icon: "🛒" },
  { key: "user_order_status", group: "user", label: "Cập nhật đơn hàng", desc: "Gửi khi admin cập nhật đơn", icon: "📦" },
  { key: "user_ticket_reply", group: "user", label: "Phản hồi ticket", desc: "Gửi khi admin phản hồi", icon: "💬" },
] as const

const TELE_TEMPLATE_VARS: Record<string, string[]> = {
  admin_register: ["{domain}", "{username}", "{email}", "{ip}", "{device}", "{ref}", "{time}"],
  admin_deposit: ["{domain}", "{username}", "{amount}", "{method}", "{trans_id}", "{time}"],
  admin_invoice: ["{domain}", "{username}", "{amount}", "{price}", "{method}", "{time}"],
  admin_card_recharge: ["{domain}", "{username}", "{amount}", "{price}", "{method}", "{time}"],
  admin_order_website: ["{domain}", "{username}", "{product_name}", "{total}", "{time}"],
  admin_order_domain: ["{domain}", "{username}", "{domain_name}", "{total}", "{time}"],
  admin_order_cronjob: ["{domain}", "{username}", "{url}", "{interval}", "{months}", "{total}", "{time}"],
  admin_renew_cronjob: ["{domain}", "{username}", "{url}", "{months}", "{total}", "{time}"],
  admin_order_logo: ["{domain}", "{username}", "{logo_name}", "{shop_name}", "{total}", "{time}"],
  admin_ticket_new: ["{domain}", "{username}", "{ticket_id}", "{title}", "{time}"],
  user_link_success: ["{domain}", "{username}", "{time}"],
  user_login: ["{domain}", "{username}", "{ip}", "{device}", "{time}"],
  user_deposit: ["{domain}", "{username}", "{amount}", "{method}", "{time}"],
  user_order: ["{domain}", "{username}", "{service}", "{total}", "{time}"],
  user_order_status: ["{domain}", "{username}", "{order_type}", "{order_name}", "{status}", "{time}"],
  user_ticket_reply: ["{domain}", "{username}", "{ticket_id}", "{title}", "{message}", "{time}"],
}

export function TelegramTemplateTab() {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const { data, isLoading } = useQuery(
    trpc.adminExtensions.getTelegramTemplates.queryOptions()
  )

  const [local, setLocal] = React.useState<Record<string, string>>({})

  React.useEffect(() => {
    if (data && Object.keys(local).length === 0) {
      setLocal({ ...data })
    }
  }, [data, local])

  const saveMut = useMutation({
    ...trpc.adminExtensions.saveTelegramTemplate.mutationOptions(),
    onSuccess: () => {
      toast.success("Đã lưu template")
      qc.invalidateQueries({ queryKey: trpc.adminExtensions.getTelegramTemplates.queryKey() })
    },
    onError: (err: any) => toast.error(err?.message || "Lưu thất bại"),
  })

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-72 rounded-xl" />
        ))}
      </div>
    )
  }

  const adminTpls = TELE_TEMPLATE_CONFIG.filter((t) => t.group === "admin")
  const userTpls = TELE_TEMPLATE_CONFIG.filter((t) => t.group === "user")
  const dataMap = data as Record<string, string>

  const renderCard = (tpl: (typeof TELE_TEMPLATE_CONFIG)[number]) => {
    const content = local[tpl.key] ?? dataMap[tpl.key] ?? ""
    const vars = TELE_TEMPLATE_VARS[tpl.key] || []
    return (
      <div
        key={tpl.key}
        className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm"
      >
        <div className="flex items-start gap-3">
          <span className="text-xl">{tpl.icon}</span>
          <div className="min-w-0 flex-1">
            <Label className="block text-sm font-bold">{tpl.label}</Label>
            <p className="text-[11px] italic text-muted-foreground">{tpl.desc}</p>
          </div>
          <GenerateAiButton
            kind="telegram_text"
            onApply={(text) => setLocal((prev) => ({ ...prev, [tpl.key]: text }))}
            related={[
              { label: "Template", value: tpl.label },
              { label: "Mục đích", value: tpl.desc },
              { label: "Đối tượng", value: tpl.group === "admin" ? "Admin" : "User cuối" },
              { label: "Biến (giữ nguyên)", value: vars.join(", ") },
            ]}
            hintPlaceholder={`VD: Sinh mẫu tin nhắn cho ${tpl.label.toLowerCase()}, giữ nguyên biến ${vars.slice(0, 3).join(", ")}`}
            size="sm"
            label="Generated by AI"
          />
        </div>

        <Textarea
          value={content}
          onChange={(e) => setLocal((prev) => ({ ...prev, [tpl.key]: e.target.value }))}
          rows={8}
          className="font-mono text-xs"
          placeholder="Nội dung mẫu tin nhắn (HTML)..."
        />

        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Variables
          </p>
          <div className="flex flex-wrap gap-1">
            {vars.map((v) => (
              <code
                key={v}
                className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
              >
                {v}
              </code>
            ))}
          </div>
        </div>

        <Button
          size="sm"
          disabled={saveMut.isPending}
          onClick={() => {
            if (!content.trim()) {
              toast.error("Nội dung không được trống")
              return
            }
            saveMut.mutate({ key: tpl.key, content })
          }}
          className="self-end"
        >
          {saveMut.isPending ? "Đang lưu..." : "Lưu"}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Admin templates */}
      <section>
        <div className="mb-4 flex items-center gap-3 border-b border-border pb-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <path d="M20 8v6M23 11h-6" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold">Telegram — Admin</h2>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Gửi vào admin chat · HTML parse_mode
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {adminTpls.map(renderCard)}
        </div>
      </section>

      {/* User templates */}
      <section>
        <div className="mb-4 flex items-center gap-3 border-b border-border pb-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M4 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
              <circle cx="10" cy="7" r="4" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold">Telegram — User</h2>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Gửi cho user đã liên kết Telegram · HTML parse_mode
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {userTpls.map(renderCard)}
        </div>
      </section>
    </div>
  )
}
