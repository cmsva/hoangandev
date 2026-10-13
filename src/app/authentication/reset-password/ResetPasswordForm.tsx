"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/client"
import { toast } from "@/components/ui/toast"
import { CaptchaWidget } from "@/components/captcha-widget"

export function ResetPasswordForm() {
  const trpc = useTRPC()
  const router = useRouter()
  const params = useSearchParams()
  const uid = params.get("uid") || ""
  const token = params.get("token") || ""

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)

  const linkValid = /^[a-f\d]{24}$/i.test(uid) && token.length >= 16

  const mutation = useMutation(
    trpc.auth.resetPassword.mutationOptions({
      onSuccess: () => {
        toast.success("Đặt lại mật khẩu thành công! Hãy đăng nhập.")
        router.push("/authentication/login")
      },
      onError: (err: any) => toast.error(err.message),
    })
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      toast.error("Mật khẩu xác nhận không khớp")
      return
    }
    mutation.mutate({ uid, token, newPassword: password, captchaToken: captchaToken || undefined })
  }

  if (!linkValid) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/15">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-rose-500">
            <circle cx="12" cy="12" r="10" />
            <path d="m15 9-6 6M9 9l6 6" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Liên kết không hợp lệ</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu lại.
          </p>
        </div>
        <Link
          href="/authentication/forgot-password"
          className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Yêu cầu link mới
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
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">Đặt lại mật khẩu</h1>
        <p className="mt-2 text-sm text-muted-foreground">Nhập mật khẩu mới cho tài khoản của bạn</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium text-foreground">
            Mật khẩu mới
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Tối thiểu 6 ký tự"
            required
            autoComplete="new-password"
            className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-colors"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="confirm" className="text-sm font-medium text-foreground">
            Xác nhận mật khẩu
          </label>
          <input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Nhập lại mật khẩu mới"
            required
            autoComplete="new-password"
            className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-colors"
          />
        </div>

        <CaptchaWidget action="forgot_password" onVerify={setCaptchaToken} />

        <button
          type="submit"
          disabled={mutation.isPending}
          className="flex h-10 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {mutation.isPending ? "Đang cập nhật..." : "Đặt lại mật khẩu"}
        </button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/authentication/login" className="font-medium text-primary hover:underline">
          Quay lại đăng nhập
        </Link>
      </p>
    </div>
  )
}
