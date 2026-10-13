"use client"

import { useState } from "react"
import Link from "next/link"
import { useMutation } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/client"
import { toast } from "@/components/ui/toast"
import { CaptchaWidget } from "@/components/captcha-widget"

export function ForgotPasswordForm() {
  const trpc = useTRPC()
  const [email, setEmail] = useState("")
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const mutation = useMutation(
    trpc.auth.forgotPassword.mutationOptions({
      onSuccess: () => {
        setSent(true)
      },
      onError: (err: any) => toast.error(err.message),
    })
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate({ email, captchaToken: captchaToken || undefined })
  }

  if (sent) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-emerald-500">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Kiểm tra email của bạn</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Nếu email <strong className="text-foreground">{email}</strong> tồn tại trong hệ thống, chúng tôi đã gửi link đặt lại mật khẩu. Link có hiệu lực trong 30 phút.
          </p>
        </div>
        <Link
          href="/authentication/login"
          className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-input bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          Quay lại đăng nhập
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary-foreground">
            <path d="M2 18v3c0 .6.4 1 1 1h4v-3h3v-3h2l1.4-1.4a6.5 6.5 0 1 0-4-4Z" />
            <circle cx="16.5" cy="7.5" r=".5" fill="currentColor" />
          </svg>
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">Quên mật khẩu?</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Nhập email tài khoản, chúng tôi sẽ gửi link đặt lại mật khẩu
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-foreground">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            required
            autoComplete="email"
            className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-colors"
          />
        </div>

        <CaptchaWidget action="forgot_password" onVerify={setCaptchaToken} />

        <button
          type="submit"
          disabled={mutation.isPending}
          className="flex h-10 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {mutation.isPending ? "Đang gửi..." : "Gửi link đặt lại"}
        </button>
      </form>

      {/* Footer */}
      <p className="text-center text-sm text-muted-foreground">
        Nhớ mật khẩu rồi?{" "}
        <Link href="/authentication/login" className="font-medium text-primary hover:underline">
          Đăng nhập
        </Link>
      </p>
    </div>
  )
}
