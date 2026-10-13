"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
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

type Channel = "smtp" | "telegram" | "telegram_user"

const NOTIFY_LABELS: Record<string, string> = {
  login: "Thông báo đăng nhập",
  otp: "Mã OTP 2FA",
  forgot_password: "Quên mật khẩu",
  verify_account: "Xác minh email",
  change_password: "Đổi mật khẩu",
  deposit_success: "Nạp tiền thành công",
  order_website: "Đơn Website / Mã nguồn",
  order_domain: "Đơn Tên miền",
  order_cronjob: "Đơn CronJob",
  order_logo: "Đơn Logo",
  order_status: "Cập nhật đơn hàng",
  ticket_reply: "Phản hồi ticket",
}

export function NotificationTab() {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(
    trpc.adminExtensions.getNotificationConfig.queryOptions()
  )

  const [editing, setEditing] = React.useState<Channel | null>(null)

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Skeleton className="h-44 rounded-xl" />
        <Skeleton className="h-44 rounded-xl" />
      </div>
    )
  }

  const smtpEnabled = data.smtp.status === "1" && !!data.smtp.host && !!data.smtp.user
  const teleEnabled = data.telegram.status === "1" && !!data.telegram.token && !!data.telegram.chatId
  const teleUserEnabled =
    data.telegram.userStatus === "1" && !!data.telegram.token && !!data.telegram.botUsername

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ChannelCard
          name="Mail SMTP"
          desc="Gửi email cho khách hàng"
          enabled={smtpEnabled}
          color="text-amber-600"
          bg="bg-amber-500/15"
          logo={
            <svg className="size-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          }
          onConfigure={() => setEditing("smtp")}
        />
        <ChannelCard
          name="Telegram Admin"
          desc="Gửi thông báo cho admin"
          enabled={teleEnabled}
          color="text-sky-600"
          bg="bg-sky-500/15"
          logo={
            <svg className="size-12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
          }
          onConfigure={() => setEditing("telegram")}
        />
        <ChannelCard
          name="Telegram User Bot"
          desc="Cho user liên kết & nhận thông báo"
          enabled={teleUserEnabled}
          color="text-indigo-600"
          bg="bg-indigo-500/15"
          logo={
            <svg className="size-12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
          }
          onConfigure={() => setEditing("telegram_user")}
        />
      </div>

      {editing === "smtp" && (
        <SmtpDialog cfg={data.smtp} onClose={() => setEditing(null)} />
      )}
      {editing === "telegram" && (
        <TelegramDialog cfg={data.telegram} onClose={() => setEditing(null)} />
      )}
      {editing === "telegram_user" && (
        <TelegramUserDialog cfg={data.telegram} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}

function ChannelCard({
  name,
  desc,
  enabled,
  color,
  bg,
  logo,
  onConfigure,
}: {
  name: string
  desc: string
  enabled: boolean
  color: string
  bg: string
  logo: React.ReactNode
  onConfigure: () => void
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-card to-card/60 p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <span
        className={cn(
          "absolute right-3 top-3 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
          enabled ? "bg-emerald-500/15 text-emerald-600" : "bg-rose-500/15 text-rose-600"
        )}
      >
        {enabled ? "Bật" : "Tắt"}
      </span>
      <div className="flex flex-col items-center gap-3 pt-3 pb-12">
        <div className={cn("flex size-14 items-center justify-center rounded-2xl", bg, color)}>
          {logo}
        </div>
        <div className="text-center">
          <h3 className="text-sm font-bold tracking-tight">{name}</h3>
          <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">{desc}</p>
        </div>
      </div>
      <Button size="sm" variant="outline" onClick={onConfigure} className="absolute bottom-3 right-3">
        Cấu hình
      </Button>
    </div>
  )
}

// ─── SMTP Dialog ───────────────────────────────────────────────────────────
function SmtpDialog({
  cfg,
  onClose,
}: {
  cfg: {
    status: string
    host: string
    port: string
    secure: string
    user: string
    pass: string
    from: string
    flags: Record<string, string>
  }
  onClose: () => void
}) {
  const trpc = useTRPC()
  const qc = useQueryClient()

  const [form, setForm] = React.useState({ ...cfg, flags: { ...cfg.flags } })
  const [showPass, setShowPass] = React.useState(false)
  const [testEmail, setTestEmail] = React.useState("")

  const saveMut = useMutation({
    ...trpc.adminExtensions.updateNotificationConfig.mutationOptions(),
    onSuccess: () => {
      toast.success("Đã lưu cấu hình SMTP")
      qc.invalidateQueries({ queryKey: trpc.adminExtensions.getNotificationConfig.queryKey() })
      onClose()
    },
    onError: (err: any) => toast.error(err?.message || "Lưu thất bại"),
  })

  const testMut = useMutation({
    ...trpc.adminExtensions.testSmtp.mutationOptions(),
    onSuccess: () => toast.success(`Đã gửi mail test tới ${testEmail}`),
    onError: (err: any) => toast.error(err?.message || "Test thất bại"),
  })

  function handleSave() {
    const config: Record<string, string> = {
      status: form.status,
      host: form.host,
      port: form.port,
      secure: form.secure,
      user: form.user,
      pass: form.pass,
      from: form.from,
    }
    for (const [k, v] of Object.entries(form.flags)) {
      config[k] = v
    }
    saveMut.mutate({ provider: "smtp", config })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !saveMut.isPending && onClose()}>
      <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Cấu hình Mail SMTP</DialogTitle>
          <DialogDescription>
            Cấu hình SMTP để gửi email thông báo cho user. Hỗ trợ Gmail, SendGrid, Mailgun, AWS SES, ...
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Bật gửi mail SMTP</p>
              <p className="text-xs text-muted-foreground">Tắt = không gửi mail nào cả</p>
            </div>
            <Toggle
              checked={form.status === "1"}
              onChange={(v) => setForm({ ...form, status: v ? "1" : "0" })}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>SMTP Host</Label>
              <Input
                value={form.host}
                onChange={(e) => setForm({ ...form, host: e.target.value })}
                placeholder="smtp.gmail.com"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Port</Label>
              <Input
                type="number"
                value={form.port}
                onChange={(e) => setForm({ ...form, port: e.target.value })}
                placeholder="587"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Bảo mật</Label>
              <select
                value={form.secure}
                onChange={(e) => setForm({ ...form, secure: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              >
                <option value="0">STARTTLS (587)</option>
                <option value="1">SSL/TLS (465)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Username</Label>
              <Input
                value={form.user}
                onChange={(e) => setForm({ ...form, user: e.target.value })}
                placeholder="user@example.com"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <div className="flex items-center gap-2">
                <Input
                  type={showPass ? "text" : "password"}
                  value={form.pass}
                  onChange={(e) => setForm({ ...form, pass: e.target.value })}
                  placeholder="••••••••"
                  className="font-mono"
                />
                <Button type="button" variant="outline" size="sm" onClick={() => setShowPass((v) => !v)}>
                  {showPass ? "Ẩn" : "Hiện"}
                </Button>
              </div>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>From (tùy chọn)</Label>
              <Input
                value={form.from}
                onChange={(e) => setForm({ ...form, from: e.target.value })}
                placeholder='"Hệ thống" <noreply@domain.com>'
                className="font-mono"
              />
            </div>
          </div>

          {/* Notify flags */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Loại thông báo bật/tắt
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.keys(NOTIFY_LABELS).map((k) => (
                <label
                  key={k}
                  className="flex cursor-pointer items-center justify-between rounded-md border border-border bg-card px-3 py-2 transition-colors hover:border-primary/40"
                >
                  <span className="text-xs">{NOTIFY_LABELS[k]}</span>
                  <Toggle
                    checked={form.flags[k] === "1"}
                    onChange={(v) =>
                      setForm({ ...form, flags: { ...form.flags, [k]: v ? "1" : "0" } })
                    }
                    size="sm"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Test send */}
          <div className="space-y-1.5 rounded-lg border border-dashed border-border bg-muted/20 p-3">
            <Label className="text-xs">Gửi mail test</Label>
            <div className="flex gap-2">
              <Input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="email-cua-ban@gmail.com"
                className="font-mono"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => testEmail && testMut.mutate({ to: testEmail })}
                disabled={testMut.isPending || !testEmail}
              >
                {testMut.isPending ? "Đang gửi..." : "Test"}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Lưu cấu hình trước khi test. Mail test sẽ gửi với tiêu đề “Test SMTP”.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saveMut.isPending}>Hủy</Button>
          <Button onClick={handleSave} disabled={saveMut.isPending}>
            {saveMut.isPending ? "Đang lưu..." : "Lưu cấu hình"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Telegram Dialog ───────────────────────────────────────────────────────
function TelegramDialog({
  cfg,
  onClose,
}: {
  cfg: { status: string; token: string; chatId: string }
  onClose: () => void
}) {
  const trpc = useTRPC()
  const qc = useQueryClient()

  const [form, setForm] = React.useState({ ...cfg })
  const [showToken, setShowToken] = React.useState(false)

  const saveMut = useMutation({
    ...trpc.adminExtensions.updateNotificationConfig.mutationOptions(),
    onSuccess: () => {
      toast.success("Đã lưu cấu hình Telegram")
      qc.invalidateQueries({ queryKey: trpc.adminExtensions.getNotificationConfig.queryKey() })
      onClose()
    },
    onError: (err: any) => toast.error(err?.message || "Lưu thất bại"),
  })

  const testMut = useMutation({
    ...trpc.adminExtensions.testTelegram.mutationOptions(),
    onSuccess: () => toast.success("Đã gửi tin nhắn test tới chat admin"),
    onError: (err: any) => toast.error(err?.message || "Test thất bại"),
  })

  return (
    <Dialog open onOpenChange={(o) => !o && !saveMut.isPending && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cấu hình Telegram Admin</DialogTitle>
          <DialogDescription>
            Tạo bot mới với @BotFather, lấy bot token, sau đó forward 1 message tới <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">@userinfobot</code> để lấy chat_id.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Bật thông báo Telegram</p>
              <p className="text-xs text-muted-foreground">Gửi cho admin khi có sự kiện</p>
            </div>
            <Toggle
              checked={form.status === "1"}
              onChange={(v) => setForm({ ...form, status: v ? "1" : "0" })}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Bot Token</Label>
            <div className="flex items-center gap-2">
              <Input
                type={showToken ? "text" : "password"}
                value={form.token}
                onChange={(e) => setForm({ ...form, token: e.target.value })}
                placeholder="123456:ABC-DEF..."
                className="font-mono"
              />
              <Button type="button" variant="outline" size="sm" onClick={() => setShowToken((v) => !v)}>
                {showToken ? "Ẩn" : "Hiện"}
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Chat ID</Label>
            <Input
              value={form.chatId}
              onChange={(e) => setForm({ ...form, chatId: e.target.value })}
              placeholder="123456789 hoặc -1001234567890 (group)"
              className="font-mono"
            />
            <p className="text-[11px] text-muted-foreground">
              ID dương = user, âm = group. Bot phải là member của group.
            </p>
          </div>

          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Test gửi tin nhắn</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => testMut.mutate()}
                disabled={testMut.isPending}
              >
                {testMut.isPending ? "Đang gửi..." : "Test"}
              </Button>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Lưu cấu hình trước khi test.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saveMut.isPending}>Hủy</Button>
          <Button
            onClick={() =>
              saveMut.mutate({
                provider: "telegram",
                config: {
                  status: form.status,
                  token: form.token.trim(),
                  chatId: form.chatId.trim(),
                },
              })
            }
            disabled={saveMut.isPending}
          >
            {saveMut.isPending ? "Đang lưu..." : "Lưu cấu hình"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Telegram User Bot Dialog ──────────────────────────────────────────────
function TelegramUserDialog({
  cfg,
  onClose,
}: {
  cfg: {
    status: string
    token: string
    chatId: string
    userStatus: string
    webhookUrl: string
    botUsername: string
  }
  onClose: () => void
}) {
  const trpc = useTRPC()
  const qc = useQueryClient()

  const [userStatus, setUserStatus] = React.useState(cfg.userStatus === "1")
  const [botUsername, setBotUsername] = React.useState(cfg.botUsername)
  const [webhookUrl, setWebhookUrl] = React.useState(cfg.webhookUrl)
  const [copied, setCopied] = React.useState(false)

  // Default webhook URL gợi ý theo origin hiện tại
  const suggestedWebhook = React.useMemo(() => {
    if (typeof window === "undefined") return ""
    return `${window.location.origin}/api/telegram/webhook`
  }, [])

  const saveMut = useMutation({
    ...trpc.adminExtensions.updateNotificationConfig.mutationOptions(),
    onSuccess: () => {
      toast.success("Đã lưu cấu hình Telegram User Bot")
      qc.invalidateQueries({ queryKey: trpc.adminExtensions.getNotificationConfig.queryKey() })
      onClose()
    },
    onError: (err: any) => toast.error(err?.message || "Lưu thất bại"),
  })

  const webhookMut = useMutation({
    ...trpc.adminExtensions.setTelegramWebhook.mutationOptions(),
    onSuccess: (res: any) => {
      toast.success(res?.description || "Đã đăng ký webhook")
      qc.invalidateQueries({ queryKey: trpc.adminExtensions.getNotificationConfig.queryKey() })
    },
    onError: (err: any) => toast.error(err?.message || "Đăng ký webhook thất bại"),
  })

  function handleSave() {
    saveMut.mutate({
      provider: "telegram",
      config: {
        userStatus: userStatus ? "1" : "0",
        botUsername: botUsername.trim().replace(/^@/, ""),
      },
    })
  }

  function copyWebhook() {
    const url = webhookUrl.trim() || suggestedWebhook
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      toast.success("Đã sao chép URL webhook")
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const tokenMissing = !cfg.token

  return (
    <Dialog open onOpenChange={(o) => !o && !saveMut.isPending && onClose()}>
      <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cấu hình Telegram User Bot</DialogTitle>
          <DialogDescription>
            Cho phép user liên kết tài khoản & nhận thông báo realtime qua Telegram.
            Bot dùng chung token với “Telegram Admin”.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {tokenMissing && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-700 dark:text-amber-400">
              Chưa có Bot Token. Vui lòng cấu hình token ở thẻ <b>Telegram Admin</b> trước —
              token được dùng chung cho cả thông báo admin lẫn user.
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Bật thông báo cho user</p>
              <p className="text-xs text-muted-foreground">User đã liên kết sẽ nhận thông báo</p>
            </div>
            <Toggle checked={userStatus} onChange={setUserStatus} />
          </div>

          <div className="space-y-1.5">
            <Label>Bot Username</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">@</span>
              <Input
                value={botUsername}
                onChange={(e) => setBotUsername(e.target.value)}
                placeholder="ten_bot_cua_ban"
                className="font-mono"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Username của bot (không có @). Dùng để tạo deep link liên kết
              <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono">t.me/&lt;bot&gt;?start=...</code>
              ở trang hồ sơ user. Chung với OAuth Telegram login.
            </p>
          </div>

          <div className="space-y-1.5 rounded-lg border border-dashed border-border bg-muted/20 p-3">
            <Label className="text-xs">Webhook URL</Label>
            <div className="flex gap-2">
              <Input
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder={suggestedWebhook || "https://domain.com/api/telegram/webhook"}
                className="font-mono"
              />
              <Button type="button" variant="outline" size="sm" onClick={copyWebhook}>
                {copied ? "Đã chép" : "Chép"}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Telegram gọi URL này khi user nhắn <code className="rounded bg-muted px-1 py-0.5 font-mono">/start</code> để
              tự động xác nhận liên kết. Bấm “Đăng ký webhook” sau khi nhập.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-1 w-full"
              onClick={() => {
                const url = webhookUrl.trim() || suggestedWebhook
                if (!url) return toast.error("Chưa có URL webhook")
                webhookMut.mutate({ webhookUrl: url })
              }}
              disabled={webhookMut.isPending || tokenMissing}
            >
              {webhookMut.isPending ? "Đang đăng ký..." : "Đăng ký webhook"}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saveMut.isPending}>Hủy</Button>
          <Button onClick={handleSave} disabled={saveMut.isPending}>
            {saveMut.isPending ? "Đang lưu..." : "Lưu cấu hình"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Inline toggle ─────────────────────────────────────────────────────────
function Toggle({
  checked,
  onChange,
  size = "md",
}: {
  checked: boolean
  onChange: (v: boolean) => void
  size?: "sm" | "md"
}) {
  const dimensions = size === "sm" ? "h-4 w-7" : "h-5 w-9"
  const dot = size === "sm" ? "size-3" : "size-4"
  const translate = size === "sm" ? "translate-x-3" : "translate-x-4"
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex shrink-0 cursor-pointer items-center rounded-full transition-colors",
        dimensions,
        checked ? "bg-emerald-500" : "bg-muted-foreground/30"
      )}
    >
      <span
        className={cn(
          "absolute left-0.5 inline-block rounded-full bg-white shadow-sm transition-transform",
          dot,
          checked && translate
        )}
      />
    </button>
  )
}
