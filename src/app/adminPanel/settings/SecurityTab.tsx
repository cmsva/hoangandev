"use client"

import * as React from "react"
import { useTRPC } from "@/trpc/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@/components/ui/toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { IconCheck, IconCopy, IconLoader } from "@/components/icons"
import { cn } from "@/lib/utils"

// ─── Toggle ────────────────────────────────────────────────────────────────
function Toggle({
  id,
  checked,
  onChange,
  label,
  hint,
}: {
  id: string
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  hint?: string
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-muted/30 p-4">
      <div className="min-w-0 flex-1 space-y-0.5">
        <Label htmlFor={id} className="cursor-pointer text-sm font-semibold">
          {label}
        </Label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors",
          checked ? "bg-primary" : "bg-input"
        )}
      >
        <span
          className={cn(
            "inline-block size-5 rounded-full bg-background shadow-sm ring-0 transition-transform",
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          )}
        />
      </button>
    </div>
  )
}

// ─── Number field with hint ────────────────────────────────────────────────
function NumberField({
  id,
  value,
  onChange,
  label,
  hint,
  min,
  max,
}: {
  id: string
  value: number
  onChange: (v: number) => void
  label: string
  hint?: string
  min?: number
  max?: number
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium">{label}</Label>
      <Input
        id={id}
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10)
          onChange(Number.isFinite(n) ? n : 0)
        }}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

// ─── Select-like simple ────────────────────────────────────────────────────
function ChoiceField({
  id,
  value,
  onChange,
  label,
  hint,
  options,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  label: string
  hint?: string
  options: Array<{ value: string; label: string }>
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium">{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

// ─── Card section ──────────────────────────────────────────────────────────
function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-5 space-y-1">
        <h3 className="text-base font-bold tracking-tight">{title}</h3>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="space-y-5">{children}</div>
    </div>
  )
}

// ─── Format helpers ────────────────────────────────────────────────────────
function formatTtlReadable(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)} phút`
  if (seconds < 86400) return `${Math.round(seconds / 3600)} giờ`
  if (seconds < 31_536_000) return `${Math.round(seconds / 86400)} ngày`
  return `${(seconds / 31_536_000).toFixed(1)} năm`
}

const TTL_PRESETS: Array<{ value: number; label: string }> = [
  { value: 3600, label: "1 giờ" },
  { value: 86400, label: "1 ngày" },
  { value: 604800, label: "7 ngày" },
  { value: 2_592_000, label: "30 ngày" },
  { value: 7_776_000, label: "90 ngày" },
  { value: 31_536_000, label: "365 ngày" },
]

const X_FRAME_OPTIONS = [
  { value: "DENY", label: "DENY — Không cho nhúng iframe" },
  { value: "SAMEORIGIN", label: "SAMEORIGIN — Chỉ cùng domain" },
]

const REFERRER_OPTIONS = [
  { value: "no-referrer", label: "no-referrer" },
  { value: "no-referrer-when-downgrade", label: "no-referrer-when-downgrade" },
  { value: "origin", label: "origin" },
  { value: "origin-when-cross-origin", label: "origin-when-cross-origin" },
  { value: "same-origin", label: "same-origin" },
  { value: "strict-origin", label: "strict-origin" },
  { value: "strict-origin-when-cross-origin", label: "strict-origin-when-cross-origin" },
  { value: "unsafe-url", label: "unsafe-url" },
]

// ─── Main Component ────────────────────────────────────────────────────────
export function SecurityTab() {
  const trpc = useTRPC()
  const qc = useQueryClient()

  const secQuery = useQuery(trpc.admin.getSecuritySettings.queryOptions())
  const cronQuery = useQuery(trpc.admin.getCronSecret.queryOptions())

  const saveMut = useMutation({
    ...trpc.admin.saveSecuritySettings.mutationOptions(),
    onSuccess: () => {
      toast.success("Đã lưu cài đặt bảo mật")
      qc.invalidateQueries({ queryKey: trpc.admin.getSecuritySettings.queryOptions().queryKey })
    },
    onError: (err: any) => toast.error(err?.message || "Lưu thất bại"),
  })

  const saveCronMut = useMutation({
    ...trpc.admin.saveCronSecret.mutationOptions(),
    onSuccess: () => {
      toast.success("Đã lưu Cron Secret")
      setCronInput("")
      qc.invalidateQueries({ queryKey: trpc.admin.getCronSecret.queryOptions().queryKey })
    },
    onError: (err: any) => toast.error(err?.message || "Lưu thất bại"),
  })

  const clearCronMut = useMutation({
    ...trpc.admin.clearCronSecret.mutationOptions(),
    onSuccess: () => {
      toast.success("Đã xoá Cron Secret khỏi DB")
      qc.invalidateQueries({ queryKey: trpc.admin.getCronSecret.queryOptions().queryKey })
    },
    onError: (err: any) => toast.error(err?.message || "Thao tác thất bại"),
  })

  const genCronMut = useMutation({
    ...trpc.admin.generateCronSecret.mutationOptions(),
    onSuccess: (res) => {
      setCronInput(res.value)
      toast.success("Đã sinh secret mới — nhấn Lưu để áp dụng")
    },
  })

  // ─── Form state ───
  const [registerEnabled, setRegisterEnabled] = React.useState(true)
  const [maintenanceMode, setMaintenanceMode] = React.useState(false)
  const [rateLimitLogin, setRateLimitLogin] = React.useState(5)
  const [loginBanDuration, setLoginBanDuration] = React.useState(900_000)
  const [rateLimitRegister, setRateLimitRegister] = React.useState(3)
  const [rateLimitForgot, setRateLimitForgot] = React.useState(3)
  const [rateLimitPurchase, setRateLimitPurchase] = React.useState(5000)
  const [rateLimitDeposit, setRateLimitDeposit] = React.useState(10000)
  const [maxPendingInvoices, setMaxPendingInvoices] = React.useState(1)
  const [apiKeyMaxAttempts, setApiKeyMaxAttempts] = React.useState(10)
  const [securityHsts, setSecurityHsts] = React.useState(true)
  const [securityXFrame, setSecurityXFrame] = React.useState("SAMEORIGIN")
  const [securityReferrer, setSecurityReferrer] = React.useState("strict-origin-when-cross-origin")
  const [securityCsp, setSecurityCsp] = React.useState("")
  const [rewardEmailMin, setRewardEmailMin] = React.useState(10)
  const [rewardEmailMax, setRewardEmailMax] = React.useState(5000)
  const [rewardTelegramMin, setRewardTelegramMin] = React.useState(10)
  const [rewardTelegramMax, setRewardTelegramMax] = React.useState(5000)
  const [sessionTtl, setSessionTtl] = React.useState(604800)
  const [cronInput, setCronInput] = React.useState("")
  const [cronVisible, setCronVisible] = React.useState(false)
  const [loaded, setLoaded] = React.useState(false)

  React.useEffect(() => {
    if (secQuery.data && !loaded) {
      const d = secQuery.data
      setRegisterEnabled(d.registerEnabled)
      setMaintenanceMode(d.maintenanceMode)
      setRateLimitLogin(d.rateLimitLogin)
      setLoginBanDuration(d.loginBanDuration)
      setRateLimitRegister(d.rateLimitRegister)
      setRateLimitForgot(d.rateLimitForgot)
      setRateLimitPurchase(d.rateLimitPurchase)
      setRateLimitDeposit(d.rateLimitDeposit)
      setMaxPendingInvoices(d.maxPendingInvoices)
      setApiKeyMaxAttempts(d.apiKeyMaxAttempts)
      setSecurityHsts(d.securityHsts)
      setSecurityXFrame(d.securityXFrame)
      setSecurityReferrer(d.securityReferrer)
      setSecurityCsp(d.securityCsp)
      setRewardEmailMin(d.rewardEmailMin)
      setRewardEmailMax(d.rewardEmailMax)
      setRewardTelegramMin(d.rewardTelegramMin)
      setRewardTelegramMax(d.rewardTelegramMax)
      setSessionTtl(d.sessionTtl)
      setLoaded(true)
    }
  }, [secQuery.data, loaded])

  function handleSave() {
    saveMut.mutate({
      registerEnabled,
      maintenanceMode,
      rateLimitLogin,
      loginBanDuration,
      rateLimitRegister,
      rateLimitForgot,
      rateLimitPurchase,
      rateLimitDeposit,
      maxPendingInvoices,
      apiKeyMaxAttempts,
      securityHsts,
      securityXFrame,
      securityReferrer,
      securityCsp,
      rewardEmailMin,
      rewardEmailMax,
      rewardTelegramMin,
      rewardTelegramMax,
      sessionTtl,
    })
  }

  function handleResetDefaults() {
    setRegisterEnabled(true)
    setMaintenanceMode(false)
    setRateLimitLogin(5)
    setLoginBanDuration(900_000)
    setRateLimitRegister(3)
    setRateLimitForgot(3)
    setRateLimitPurchase(5000)
    setRateLimitDeposit(10000)
    setMaxPendingInvoices(1)
    setApiKeyMaxAttempts(10)
    setSecurityHsts(true)
    setSecurityXFrame("SAMEORIGIN")
    setSecurityReferrer("strict-origin-when-cross-origin")
    setSecurityCsp("")
    setRewardEmailMin(10)
    setRewardEmailMax(5000)
    setRewardTelegramMin(10)
    setRewardTelegramMax(5000)
    setSessionTtl(604800)
    toast.success("Đã đặt lại mặc định — nhấn Lưu để áp dụng")
  }

  function copyCron() {
    if (!cronInput) return
    navigator.clipboard
      .writeText(cronInput)
      .then(() => toast.success("Đã sao chép"))
      .catch(() => toast.error("Sao chép thất bại"))
  }

  if (secQuery.isLoading || !loaded) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Hệ thống ── */}
      <Section title="Hệ thống" hint="Bật / tắt nhanh các chế độ vận hành toàn site.">
        <Toggle
          id="reg-enabled"
          checked={registerEnabled}
          onChange={setRegisterEnabled}
          label="Đăng ký tài khoản"
          hint="Cho phép người dùng mới đăng ký tài khoản"
        />
        <Toggle
          id="maintenance"
          checked={maintenanceMode}
          onChange={setMaintenanceMode}
          label="Bảo trì website"
          hint="Bật chế độ bảo trì — chỉ admin có thể truy cập"
        />
      </Section>

      {/* ── Bảo mật dịch vụ ── */}
      <Section
        title="Bảo mật dịch vụ"
        hint="Chống brute-force, spam đăng ký, double-click thanh toán. Các giá trị áp dụng ngay sau khi lưu."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <NumberField
            id="rl-login"
            label="Login attempts/IP/15 phút"
            value={rateLimitLogin}
            onChange={setRateLimitLogin}
            min={1}
            max={1000}
            hint="Số lần login sai tối đa mỗi IP trong 15 phút (Login, Admin Login)"
          />
          <NumberField
            id="rl-ban"
            label="Login ban duration (ms)"
            value={loginBanDuration}
            onChange={setLoginBanDuration}
            min={1000}
            max={86_400_000}
            hint="Thời gian block IP sau khi vượt giới hạn login (mặc định 900000ms = 15 phút)"
          />
          <NumberField
            id="rl-reg"
            label="Register attempts/IP/giờ"
            value={rateLimitRegister}
            onChange={setRateLimitRegister}
            min={1}
            max={1000}
            hint="Số lần đăng ký tối đa mỗi IP trong 1 giờ (Register)"
          />
          <NumberField
            id="rl-forgot"
            label="Forgot password/IP/15 phút"
            value={rateLimitForgot}
            onChange={setRateLimitForgot}
            min={1}
            max={1000}
            hint="Số lần gửi mã xác thực tối đa mỗi IP trong 15 phút"
          />
          <NumberField
            id="rl-purchase"
            label="Purchase throttle (ms)"
            value={rateLimitPurchase}
            onChange={setRateLimitPurchase}
            min={0}
            max={120_000}
            hint="Thời gian chờ giữa các lần mua Hosting/Domain/Website/CronJob/Dịch vụ"
          />
          <NumberField
            id="rl-deposit"
            label="Deposit throttle (ms)"
            value={rateLimitDeposit}
            onChange={setRateLimitDeposit}
            min={0}
            max={300_000}
            hint="Thời gian chờ giữa tạo hoá đơn ngân hàng hoặc nạp thẻ cào"
          />
          <NumberField
            id="rl-pending"
            label="Pending invoices/lúc"
            value={maxPendingInvoices}
            onChange={setMaxPendingInvoices}
            min={1}
            max={100}
            hint="Giới hạn hoá đơn pending chưa thanh toán cùng lúc (Nạp ngân hàng)"
          />
          <NumberField
            id="rl-api"
            label="Card callback secret attempts"
            value={apiKeyMaxAttempts}
            onChange={setApiKeyMaxAttempts}
            min={1}
            max={1000}
            hint="Số lần sai secret key tối đa trước khi khoá IP (Card Callback)"
          />
        </div>
      </Section>

      {/* ── Security Headers ── */}
      <Section title="Security Headers" hint="Áp dụng cho mọi response. Tránh đổi nếu chưa hiểu rõ.">
        <Toggle
          id="hsts"
          checked={securityHsts}
          onChange={setSecurityHsts}
          label="HSTS"
          hint="Bắt buộc HTTPS — Strict-Transport-Security (chỉ áp dụng ở production)"
        />
        <div className="grid gap-5 md:grid-cols-2">
          <ChoiceField
            id="x-frame"
            value={securityXFrame}
            onChange={setSecurityXFrame}
            label="X-Frame-Options"
            options={X_FRAME_OPTIONS}
            hint="Chống clickjacking"
          />
          <ChoiceField
            id="referrer"
            value={securityReferrer}
            onChange={setSecurityReferrer}
            label="Referrer-Policy"
            options={REFERRER_OPTIONS}
            hint="Kiểm soát thông tin referrer gửi đi"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="csp" className="text-sm font-medium">Content-Security-Policy</Label>
          <Textarea
            id="csp"
            value={securityCsp}
            onChange={(e) => setSecurityCsp(e.target.value)}
            placeholder="default-src 'self'; script-src 'self' 'unsafe-inline'..."
            rows={3}
          />
          <p className="text-xs text-muted-foreground">Tuỳ chỉnh CSP header — để trống sẽ dùng mặc định</p>
        </div>
      </Section>

      {/* ── Thưởng người dùng ── */}
      <Section
        title="Thưởng người dùng"
        hint="Tặng tiền ngẫu nhiên (trong khoảng min — max) khi user xác minh email hoặc liên kết Telegram lần đầu. Đặt 0 để tắt."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <NumberField
            id="rew-email-min"
            label="Email — min"
            value={rewardEmailMin}
            onChange={setRewardEmailMin}
            min={0}
            hint="Số tiền tối thiểu khi xác minh email"
          />
          <NumberField
            id="rew-email-max"
            label="Email — max"
            value={rewardEmailMax}
            onChange={setRewardEmailMax}
            min={0}
            hint="Số tiền tối đa khi xác minh email"
          />
          <NumberField
            id="rew-tg-min"
            label="Telegram — min"
            value={rewardTelegramMin}
            onChange={setRewardTelegramMin}
            min={0}
            hint="Số tiền tối thiểu khi liên kết Telegram"
          />
          <NumberField
            id="rew-tg-max"
            label="Telegram — max"
            value={rewardTelegramMax}
            onChange={setRewardTelegramMax}
            min={0}
            hint="Số tiền tối đa khi liên kết Telegram"
          />
        </div>
      </Section>

      {/* ── Cron Secret ── */}
      <Section
        title="Cron Secret"
        hint="Khoá bảo vệ các endpoint cron tự động (/cmstdev/cron/*). Lưu vào DB sẽ được ưu tiên hơn biến môi trường CRON_SECRET. Để trống và Lưu sẽ quay về dùng env."
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-stretch gap-2">
            <Input
              id="cron-input"
              type={cronVisible ? "text" : "password"}
              value={cronInput}
              onChange={(e) => setCronInput(e.target.value)}
              placeholder={cronQuery.data?.masked || "Nhập secret mới…"}
              className="font-mono"
            />
            <Button type="button" size="sm" variant="outline" onClick={() => setCronVisible((v) => !v)}>
              {cronVisible ? "Ẩn" : "Hiện"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={copyCron} className="gap-1.5">
              <IconCopy size={14} /> Copy
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => genCronMut.mutate()}
              disabled={genCronMut.isPending}
            >
              Random
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {cronQuery.data?.source === "db" && "Đang dùng giá trị lưu trong DB (ưu tiên cao nhất)."}
            {cronQuery.data?.source === "env" && "Đang dùng biến môi trường CRON_SECRET. Lưu giá trị mới sẽ override."}
            {cronQuery.data?.source === "none" && "Chưa cấu hình — endpoint cron sẽ trả 503."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => saveCronMut.mutate({ value: cronInput })}
              disabled={saveCronMut.isPending}
              className="gap-1.5"
            >
              {saveCronMut.isPending ? <IconLoader size={14} className="animate-spin" /> : <IconCheck size={14} />}
              Lưu Cron Secret
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => clearCronMut.mutate()}
              disabled={clearCronMut.isPending || cronQuery.data?.source !== "db"}
            >
              Xoá khỏi DB
            </Button>
          </div>
        </div>
      </Section>

      {/* ── Session TTL ── */}
      <Section
        title="Thời gian lưu phiên đăng nhập"
        hint="Đặt thời lượng hợp lệ của cookie + JWT khi user đăng nhập, tính bằng giây. Hết thời gian này người dùng sẽ phải đăng nhập lại. Mặc định là 7 ngày (604800 giây) nếu để trống."
      >
        <div className="flex flex-wrap gap-2">
          {TTL_PRESETS.map((p) => {
            const active = sessionTtl === p.value
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => setSessionTtl(p.value)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
              >
                {p.label}
                <span className="ml-1.5 text-muted-foreground/70">{p.value}s</span>
              </button>
            )
          })}
        </div>
        <NumberField
          id="session-ttl"
          label="Session TTL (giây)"
          value={sessionTtl}
          onChange={setSessionTtl}
          min={60}
          max={31_536_000}
          hint={`Tối thiểu 60 giây, tối đa 1 năm. Hiển thị: ${formatTtlReadable(sessionTtl)}.`}
        />
      </Section>

      {/* ── Save bar ── */}
      <div className="sticky bottom-0 -mx-6 flex items-center justify-end gap-2 border-t border-border bg-background/95 px-6 py-4 backdrop-blur">
        <Button type="button" variant="outline" onClick={handleResetDefaults} size="sm">
          Khôi phục mặc định
        </Button>
        <Button type="button" onClick={handleSave} disabled={saveMut.isPending} size="sm" className="gap-1.5">
          {saveMut.isPending ? <IconLoader size={14} className="animate-spin" /> : <IconCheck size={14} />}
          Lưu cấu hình
        </Button>
      </div>
    </div>
  )
}
