"use client"

import { useMemo, useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/client"
import { toast } from "@/components/ui/toast"

type FormState = {
  // Step 1
  siteTitle: string
  siteDescription: string
  siteKeywords: string
  siteAuthor: string
  // Step 2
  smtpEnabled: boolean
  smtpHost: string
  smtpPort: string
  smtpSecure: boolean
  smtpUser: string
  smtpPass: string
  smtpFrom: string
  telegramEnabled: boolean
  telegramToken: string
  telegramChatId: string
  // Step 3
  adminEmail: string
  adminHotline: string
  adminFanpage: string
  adminZalo: string
  adminTelegram: string
  adminName: string
  // Step 4
  username: string
  fullname: string
  email: string
  password: string
  passwordConfirm: string
}

const INITIAL: FormState = {
  siteTitle: "",
  siteDescription: "",
  siteKeywords: "",
  siteAuthor: "",
  smtpEnabled: false,
  smtpHost: "",
  smtpPort: "587",
  smtpSecure: false,
  smtpUser: "",
  smtpPass: "",
  smtpFrom: "",
  telegramEnabled: false,
  telegramToken: "",
  telegramChatId: "",
  adminEmail: "",
  adminHotline: "",
  adminFanpage: "",
  adminZalo: "",
  adminTelegram: "",
  adminName: "",
  username: "",
  fullname: "",
  email: "",
  password: "",
  passwordConfirm: "",
}

const STEPS = [
  { id: 1, title: "Website" },
  { id: 2, title: "Email / Telegram" },
  { id: 3, title: "Liên hệ" },
  { id: 4, title: "Admin" },
] as const

export function SetupWizardClient() {
  const trpc = useTRPC()
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [data, setData] = useState<FormState>(INITIAL)

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setData((d) => ({ ...d, [key]: value }))
  }

  const completeMut = useMutation({
    ...trpc.setup.complete.mutationOptions(),
    onSuccess: () => {
      toast.success("Cài đặt thành công! Đang chuyển đến trang đăng nhập...")
      // Hard navigation (KHÔNG dùng router.push): full page reload để bypass
      // Next.js Router Cache. Soft nav sẽ phục vụ lại quyết định redirect→/setup
      // đã cache TRƯỚC khi setup → gây loop setup trên production.
      setTimeout(() => {
        window.location.href = "/authentication/login"
      }, 800)
    },
    onError: (err: any) => toast.error(err.message || "Cài đặt thất bại"),
  })

  const stepValid = useMemo(() => {
    if (step === 1) return data.siteTitle.trim().length >= 1
    if (step === 2) {
      if (data.smtpEnabled) {
        if (!data.smtpHost.trim() || !data.smtpUser.trim()) return false
      }
      if (data.telegramEnabled) {
        if (!data.telegramToken.trim() || !data.telegramChatId.trim()) return false
      }
      return true
    }
    if (step === 3) return true
    if (step === 4) {
      if (!/^[a-z0-9_]{3,30}$/i.test(data.username)) return false
      if (!data.fullname.trim()) return false
      if (!/.+@.+\..+/.test(data.email)) return false
      if (data.password.length < 8) return false
      if (data.password !== data.passwordConfirm) return false
      return true
    }
    return false
  }, [step, data])

  function next() {
    if (!stepValid) {
      toast.error("Vui lòng hoàn tất các trường bắt buộc")
      return
    }
    if (step < 4) setStep((s) => (s + 1) as 1 | 2 | 3 | 4)
  }
  function back() {
    if (step > 1) setStep((s) => (s - 1) as 1 | 2 | 3 | 4)
  }

  function handleSubmit() {
    if (!stepValid) {
      toast.error("Vui lòng hoàn tất các trường bắt buộc")
      return
    }
    completeMut.mutate({
      siteTitle: data.siteTitle.trim(),
      siteDescription: data.siteDescription.trim(),
      siteKeywords: data.siteKeywords.trim(),
      siteAuthor: data.siteAuthor.trim(),
      smtpEnabled: data.smtpEnabled,
      smtpHost: data.smtpHost.trim(),
      smtpPort: data.smtpPort.trim() || "587",
      smtpSecure: data.smtpSecure,
      smtpUser: data.smtpUser.trim(),
      smtpPass: data.smtpPass,
      smtpFrom: data.smtpFrom.trim(),
      telegramEnabled: data.telegramEnabled,
      telegramToken: data.telegramToken.trim(),
      telegramChatId: data.telegramChatId.trim(),
      adminEmail: data.adminEmail.trim(),
      adminHotline: data.adminHotline.trim(),
      adminFanpage: data.adminFanpage.trim(),
      adminZalo: data.adminZalo.trim(),
      adminTelegram: data.adminTelegram.trim(),
      adminName: data.adminName.trim(),
      username: data.username.trim().toLowerCase(),
      fullname: data.fullname.trim(),
      email: data.email.trim().toLowerCase(),
      password: data.password,
    })
  }

  const isPending = completeMut.isPending

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 py-10 sm:px-6">
        {/* Header */}
        <header className="mb-8">
          <div className="mb-4 inline-flex size-10 items-center justify-center rounded-lg border bg-card">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-5"
            >
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Cài đặt hệ thống</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Hoàn tất 4 bước để khởi tạo lần đầu. Mọi cấu hình có thể chỉnh lại ở Admin Panel sau.
          </p>
        </header>

        {/* Stepper */}
        <Stepper current={step} />

        {/* Card */}
        <div className="mt-6 rounded-lg border bg-card p-6 shadow-sm sm:p-8">
          {step === 1 && <Step1 data={data} set={set} />}
          {step === 2 && <Step2 data={data} set={set} />}
          {step === 3 && <Step3 data={data} set={set} />}
          {step === 4 && <Step4 data={data} set={set} />}

          {/* Actions */}
          <div className="mt-8 flex items-center justify-between gap-3 border-t pt-6">
            <button
              type="button"
              onClick={back}
              disabled={step === 1 || isPending}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-4 text-sm font-medium transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
              Quay lại
            </button>

            {step < 4 ? (
              <button
                type="button"
                onClick={next}
                disabled={!stepValid}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Tiếp tục
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!stepValid || isPending}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending ? (
                  <>
                    <span className="size-3 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                    Đang khởi tạo...
                  </>
                ) : (
                  <>
                    Hoàn tất cài đặt
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-auto pt-8 text-center text-xs text-muted-foreground">
          Bước {step} / 4 · Mọi cấu hình có thể thay đổi sau ở Admin Panel
        </footer>
      </div>
    </div>
  )
}

// ─── Stepper ──────────────────────────────────────────────────────────────
function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      {STEPS.map((s, i) => {
        const isDone = current > s.id
        const isActive = current === s.id
        return (
          <div key={s.id} className="flex flex-1 items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2">
              <div
                className={`flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                  isDone
                    ? "border-primary bg-primary text-primary-foreground"
                    : isActive
                      ? "border-primary text-primary"
                      : "border-border text-muted-foreground"
                }`}
              >
                {isDone ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : (
                  s.id
                )}
              </div>
              <span
                className={`hidden text-xs font-medium sm:block ${
                  isActive ? "text-foreground" : isDone ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {s.title}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-px flex-1 ${current > s.id ? "bg-primary/40" : "bg-border"}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Step components ──────────────────────────────────────────────────────
type StepProps = {
  data: FormState
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void
}

function StepHead({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mb-6 space-y-1">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{desc}</p>
    </div>
  )
}

function Step1({ data, set }: StepProps) {
  return (
    <div>
      <StepHead title="Thông tin website" desc="Tên hệ thống và metadata SEO mặc định." />
      <div className="space-y-4">
        <Field label="Tên website" required>
          <input
            type="text"
            value={data.siteTitle}
            onChange={(e) => set("siteTitle", e.target.value)}
            placeholder="VD: VanKhanh Store"
            className={inputCls}
            autoFocus
          />
        </Field>
        <Field label="Mô tả ngắn (SEO)">
          <textarea
            rows={2}
            value={data.siteDescription}
            onChange={(e) => set("siteDescription", e.target.value)}
            placeholder="Nền tảng cung cấp dịch vụ số chuyên nghiệp..."
            className={`${inputCls} h-auto py-2.5`}
          />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Từ khóa SEO" hint="Cách nhau bằng dấu phẩy">
            <input
              type="text"
              value={data.siteKeywords}
              onChange={(e) => set("siteKeywords", e.target.value)}
              placeholder="dich vu so, hosting, ten mien"
              className={inputCls}
            />
          </Field>
          <Field label="Tác giả">
            <input
              type="text"
              value={data.siteAuthor}
              onChange={(e) => set("siteAuthor", e.target.value)}
              placeholder="VD: Công ty XYZ"
              className={inputCls}
            />
          </Field>
        </div>
      </div>
    </div>
  )
}

function Step2({ data, set }: StepProps) {
  return (
    <div>
      <StepHead
        title="Email & Telegram"
        desc="Tùy chọn — bạn có thể cấu hình sau ở Admin → Extensions."
      />

      <div className="mb-4 rounded-md border p-4">
        <Toggle
          checked={data.smtpEnabled}
          onChange={(v) => set("smtpEnabled", v)}
          label="Bật gửi email qua SMTP"
          desc="Cần thiết cho xác minh email, OTP, thông báo đơn hàng"
        />

        {data.smtpEnabled && (
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Host" required>
                <input value={data.smtpHost} onChange={(e) => set("smtpHost", e.target.value)} placeholder="smtp.gmail.com" className={inputCls} />
              </Field>
              <Field label="Port">
                <input type="number" value={data.smtpPort} onChange={(e) => set("smtpPort", e.target.value)} placeholder="587" className={inputCls} />
              </Field>
              <Field label="Bảo mật">
                <select value={data.smtpSecure ? "1" : "0"} onChange={(e) => set("smtpSecure", e.target.value === "1")} className={inputCls}>
                  <option value="0">TLS (587)</option>
                  <option value="1">SSL (465)</option>
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Tài khoản" required>
                <input value={data.smtpUser} onChange={(e) => set("smtpUser", e.target.value)} placeholder="you@gmail.com" className={inputCls} />
              </Field>
              <Field label="Mật khẩu">
                <input type="password" value={data.smtpPass} onChange={(e) => set("smtpPass", e.target.value)} placeholder="••••••••••••" className={inputCls} />
              </Field>
            </div>
            <Field label="Email gửi đi (from)" hint="Để trống sẽ dùng tài khoản SMTP">
              <input value={data.smtpFrom} onChange={(e) => set("smtpFrom", e.target.value)} placeholder="no-reply@yourdomain.com" className={inputCls} />
            </Field>
          </div>
        )}
      </div>

      <div className="rounded-md border p-4">
        <Toggle
          checked={data.telegramEnabled}
          onChange={(v) => set("telegramEnabled", v)}
          label="Bật thông báo Telegram cho admin"
          desc="Nhận thông báo đơn hàng, nạp tiền real-time"
        />

        {data.telegramEnabled && (
          <div className="mt-5 space-y-4">
            <Field label="Bot Token" required hint="Tạo bot tại @BotFather trên Telegram">
              <input value={data.telegramToken} onChange={(e) => set("telegramToken", e.target.value)} placeholder="123456:ABC-DEF1234ghIkl-zyx57..." className={`${inputCls} font-mono text-xs`} />
            </Field>
            <Field label="Chat ID" required hint="ID admin/group nhận thông báo">
              <input value={data.telegramChatId} onChange={(e) => set("telegramChatId", e.target.value)} placeholder="-1001234567890" className={`${inputCls} font-mono text-xs`} />
            </Field>
          </div>
        )}
      </div>
    </div>
  )
}

function Step3({ data, set }: StepProps) {
  return (
    <div>
      <StepHead
        title="Thông tin liên hệ"
        desc="Hiển thị ở footer, page liên hệ, và auto-fill template email."
      />
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Tên admin / công ty">
            <input value={data.adminName} onChange={(e) => set("adminName", e.target.value)} placeholder="VD: Nguyễn Văn A" className={inputCls} />
          </Field>
          <Field label="Email liên hệ">
            <input type="email" value={data.adminEmail} onChange={(e) => set("adminEmail", e.target.value)} placeholder="contact@yourdomain.com" className={inputCls} />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Hotline">
            <input value={data.adminHotline} onChange={(e) => set("adminHotline", e.target.value)} placeholder="0901 234 567" className={inputCls} />
          </Field>
          <Field label="Zalo">
            <input value={data.adminZalo} onChange={(e) => set("adminZalo", e.target.value)} placeholder="0901 234 567" className={inputCls} />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Fanpage Facebook">
            <input value={data.adminFanpage} onChange={(e) => set("adminFanpage", e.target.value)} placeholder="https://facebook.com/yourpage" className={inputCls} />
          </Field>
          <Field label="Telegram username" hint="Không có @">
            <input value={data.adminTelegram} onChange={(e) => set("adminTelegram", e.target.value.replace(/^@/, ""))} placeholder="vd: vankhanh_support" className={inputCls} />
          </Field>
        </div>
      </div>
    </div>
  )
}

function Step4({ data, set }: StepProps) {
  const passwordsMatch = data.password === data.passwordConfirm
  const passwordOk = data.password.length >= 8
  return (
    <div>
      <StepHead
        title="Tài khoản quản trị viên"
        desc="Tài khoản này có toàn quyền hệ thống. Hãy đặt mật khẩu mạnh."
      />
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Tên đăng nhập" required hint="3-30 ký tự, a-z 0-9 _">
            <input
              value={data.username}
              onChange={(e) => set("username", e.target.value.toLowerCase())}
              placeholder="admin"
              className={`${inputCls} font-mono`}
              autoComplete="username"
            />
          </Field>
          <Field label="Họ tên" required>
            <input value={data.fullname} onChange={(e) => set("fullname", e.target.value)} placeholder="Nguyễn Văn A" className={inputCls} />
          </Field>
        </div>
        <Field label="Email" required hint="Dùng để khôi phục tài khoản">
          <input
            type="email"
            value={data.email}
            onChange={(e) => set("email", e.target.value.toLowerCase())}
            placeholder="admin@yourdomain.com"
            className={inputCls}
            autoComplete="email"
          />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Mật khẩu" required hint="Tối thiểu 8 ký tự" valid={passwordOk}>
            <input
              type="password"
              value={data.password}
              onChange={(e) => set("password", e.target.value)}
              placeholder="••••••••"
              className={inputCls}
              autoComplete="new-password"
            />
          </Field>
          <Field
            label="Nhập lại mật khẩu"
            required
            valid={data.passwordConfirm.length > 0 && passwordsMatch}
            error={data.passwordConfirm.length > 0 && !passwordsMatch ? "Mật khẩu không khớp" : undefined}
          >
            <input
              type="password"
              value={data.passwordConfirm}
              onChange={(e) => set("passwordConfirm", e.target.value)}
              placeholder="••••••••"
              className={inputCls}
              autoComplete="new-password"
            />
          </Field>
        </div>

        <div className="mt-4 flex items-start gap-3 rounded-md border bg-muted/30 p-3.5">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Hãy lưu lại tài khoản và mật khẩu. Sau khi cài đặt xong, trang này sẽ bị khóa và không thể truy cập lại.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Reusable inputs ───────────────────────────────────────────────────────
const inputCls =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"

function Field({
  label,
  hint,
  required,
  valid,
  error,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  valid?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-sm font-medium leading-none">
        {label}
        {required && <span className="text-destructive">*</span>}
        {valid && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600 dark:text-emerald-400">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        )}
      </label>
      {children}
      {error ? (
        <p className="text-[11px] text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

function Toggle({
  checked,
  onChange,
  label,
  desc,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  desc?: string
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 text-left"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {desc && <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>}
      </div>
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors ${
          checked ? "border-primary bg-primary" : "border-input bg-background"
        }`}
      >
        <span
          className={`inline-block size-4 rounded-full shadow-sm transition-transform ${
            checked ? "translate-x-[18px] bg-primary-foreground" : "translate-x-0.5 bg-foreground"
          }`}
        />
      </span>
    </button>
  )
}
