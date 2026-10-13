"use client"

import { useState, useRef, useCallback } from "react"
import Link from "next/link"
import { useMutation } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/client"
import { toast } from "@/components/ui/toast"
import { CaptchaWidget } from "@/components/captcha-widget"
import { SocialLoginRow } from "@/components/auth/social-icons"
import { useAuthBrand } from "@/components/auth/auth-brand-context"
import { usePasskeyLogin, isPasskeySupported } from "@/hooks/use-passkey"

type Step = "credentials" | "2fa"

export function LoginForm() {
  const trpc = useTRPC()
  const { logo, title } = useAuthBrand()
  const { isAuthenticating, loginWithPasskey } = usePasskeyLogin()
  const passkeySupported = isPasskeySupported()

  // ─── State ───────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("credentials")
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")

  // 2FA state — tempToken giữ trong memory, KHÔNG đưa lên URL
  const [tempToken, setTempToken] = useState<string | null>(null)
  const [otpCode, setOtpCode] = useState("")
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  // Captcha token
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)

  // ─── OTP handlers ────────────────────────────────────────────────────────
  const handleOtpChange = useCallback((index: number, value: string) => {
    if (!/^\d?$/.test(value)) return
    setOtpCode((prev) => {
      const arr = prev.split("")
      arr[index] = value
      return arr.join("").slice(0, 6)
    })
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus()
    }
  }, [])

  const handleOtpKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent) => {
      if (e.key === "Backspace" && !otpCode[index] && index > 0) {
        otpRefs.current[index - 1]?.focus()
      }
    },
    [otpCode]
  )

  // ─── Step 1: Login ───────────────────────────────────────────────────────
  const loginMutation = useMutation(
    trpc.auth.login.mutationOptions({
      onSuccess: (res: any) => {
        if (res.requires2FA && res.tempToken) {
          setTempToken(res.tempToken)
          setStep("2fa")
          setTimeout(() => otpRefs.current[0]?.focus(), 50)
          return
        }
        toast.success("Đăng nhập thành công!")
        window.location.href = "/dashboard"
      },
      onError: (err: any) => {
        toast.error(err.message)
      },
    })
  )

  // ─── Step 2: Verify 2FA ──────────────────────────────────────────────────
  const verifyMutation = useMutation(
    trpc.auth.verify2FA.mutationOptions({
      onSuccess: () => {
        toast.success("Xác thực thành công!")
        window.location.href = "/dashboard"
      },
      onError: (err: any) => {
        toast.error(err.message)
        setOtpCode("")
        otpRefs.current[0]?.focus()
      },
    })
  )

  const handleSubmitCredentials = (e: React.FormEvent) => {
    e.preventDefault()
    loginMutation.mutate({ identifier, password, captchaToken: captchaToken || undefined })
  }

  const handleSubmitOtp = (e: React.FormEvent) => {
    e.preventDefault()
    if (otpCode.length !== 6 || !tempToken) return
    verifyMutation.mutate({ tempToken, code: otpCode })
  }

  // Auto-submit OTP khi đủ 6 số
  if (otpCode.length === 6 && !verifyMutation.isPending && tempToken && step === "2fa") {
    verifyMutation.mutate({ tempToken, code: otpCode })
  }

  const handleBackToCredentials = () => {
    setStep("credentials")
    setTempToken(null)
    setOtpCode("")
    setPassword("")
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        {logo && step === "credentials" ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={logo} alt={title} className="mx-auto h-12 w-auto" />
        ) : (
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary-foreground">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
        )}
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">
          {step === "credentials" ? "Đăng nhập" : "Xác thực 2 yếu tố"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {step === "credentials"
            ? "Nhập thông tin tài khoản để tiếp tục"
            : "Nhập mã 6 chữ số từ ứng dụng Authenticator"}
        </p>
      </div>

      {/* Step 1: Credentials Form */}
      {step === "credentials" && (
        <form onSubmit={handleSubmitCredentials} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="identifier" className="text-sm font-medium text-foreground">
              Tên đăng nhập hoặc Email
            </label>
            <input
              id="identifier"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="username hoặc email@example.com"
              required
              autoComplete="username"
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-colors"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                Mật khẩu
              </label>
              <Link href="/authentication/forgot-password" className="text-xs text-primary hover:underline">
                Quên mật khẩu?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-colors"
            />
          </div>

          <CaptchaWidget action="login" onVerify={setCaptchaToken} />

          <div className="space-y-2.5">
            <button
              type="submit"
              disabled={loginMutation.isPending || isAuthenticating}
              className="flex h-10 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loginMutation.isPending ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>

            {passkeySupported && (
              <button
                type="button"
                onClick={loginWithPasskey}
                disabled={loginMutation.isPending || isAuthenticating}
                aria-label="Đăng nhập bằng Passkey"
                className="group flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-input bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted hover:border-primary/40 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAuthenticating ? (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-primary transition-transform group-hover:scale-110"
                    aria-hidden
                  >
                    <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
                    <path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
                    <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
                    <path d="M2 12a10 10 0 0 1 18-6" />
                    <path d="M2 16h.01" />
                    <path d="M21.8 16c.2-2 .131-5.354 0-6" />
                    <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" />
                    <path d="M8.65 22c.21-.66.45-1.32.57-2" />
                    <path d="M9 6.8a6 6 0 0 1 9 5.2v2" />
                  </svg>
                )}
                {isAuthenticating ? "Đang xác thực..." : "Đăng nhập bằng Passkey"}
              </button>
            )}
          </div>
        </form>
      )}

      {/* Social login row — chỉ ở bước nhập credentials */}
      {step === "credentials" && <SocialLoginRow />}

      {/* Step 2: OTP Form */}
      {step === "2fa" && (
        <form onSubmit={handleSubmitOtp} className="space-y-6">
          <div className="flex justify-center gap-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <input
                key={i}
                ref={(el) => {
                  otpRefs.current[i] = el
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={otpCode[i] || ""}
                onChange={(e) => handleOtpChange(i, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(i, e)}
                disabled={verifyMutation.isPending}
                className="size-12 text-xl font-bold text-center font-mono rounded-md border-2 border-input bg-background outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
              />
            ))}
          </div>

          {verifyMutation.isPending && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
              Đang xác thực...
            </div>
          )}

          <button
            type="submit"
            disabled={verifyMutation.isPending || otpCode.length !== 6}
            className="flex h-10 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Xác nhận
          </button>

          <button
            type="button"
            onClick={handleBackToCredentials}
            className="block w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Quay lại
          </button>

          <p className="text-center text-xs text-muted-foreground">
            Mã có hiệu lực 30 giây. Phiên xác thực hết hạn sau 5 phút.
          </p>
        </form>
      )}

      {/* Footer */}
      {step === "credentials" && (
        <p className="text-center text-sm text-muted-foreground">
          Chưa có tài khoản?{" "}
          <Link href="/authentication/register" className="font-medium text-primary hover:underline">
            Đăng ký ngay
          </Link>
        </p>
      )}
    </div>
  )
}
