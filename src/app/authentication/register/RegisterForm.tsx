"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/client"
import { toast } from "@/components/ui/toast"
import { CaptchaWidget } from "@/components/captcha-widget"
import { SocialLoginRow } from "@/components/auth/social-icons"
import { useAuthBrand } from "@/components/auth/auth-brand-context"

export function RegisterForm() {
  const router = useRouter()
  const trpc = useTRPC()
  const { logo, title } = useAuthBrand()
  const [form, setForm] = useState({
    fullname: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  })
  const [error, setError] = useState("")
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)

  // Check appConfig — admin có thể tắt đăng ký hoặc bật bảo trì
  const { data: appCfg, isLoading: appCfgLoading } = useQuery(
    trpc.public.appConfig.queryOptions()
  )
  const registerOff = appCfg ? !appCfg.registerEnabled : false
  const maintenanceOn = appCfg ? appCfg.maintenanceMode : false
  const blocked = registerOff || maintenanceOn

  const registerMutation = useMutation(
    trpc.auth.register.mutationOptions({
      onSuccess: () => {
        toast.success("Tạo tài khoản thành công! Hãy đăng nhập.")
        router.push("/authentication/login")
      },
      onError: (err) => {
        toast.error(err.message)
      },
    })
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (form.password !== form.confirmPassword) {
      toast.error("Mật khẩu xác nhận không khớp")
      return
    }

    registerMutation.mutate({ ...form, captchaToken: captchaToken || undefined })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        {logo ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={logo} alt={title} className="mx-auto h-12 w-auto" />
        ) : (
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary-foreground">
              <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
            </svg>
          </div>
        )}
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">Tạo tài khoản</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Điền thông tin bên dưới để đăng ký
        </p>
      </div>

      {/* Banner: registration disabled / maintenance */}
      {!appCfgLoading && blocked && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          <div className="flex items-start gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div>
              <strong className="font-semibold">
                {maintenanceOn ? "Hệ thống đang bảo trì" : "Đăng ký đang tạm đóng"}
              </strong>
              <p className="mt-0.5">
                {maintenanceOn
                  ? "Vui lòng quay lại sau ít phút. Cảm ơn sự kiên nhẫn của bạn."
                  : "Hệ thống hiện không nhận đăng ký tài khoản mới. Vui lòng quay lại sau."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="fullname" className="text-sm font-medium text-foreground">
            Họ và tên
          </label>
          <input
            id="fullname"
            name="fullname"
            type="text"
            value={form.fullname}
            onChange={handleChange}
            placeholder="Nguyễn Văn A"
            required
            className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-colors"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="username" className="text-sm font-medium text-foreground">
            Tên đăng nhập
          </label>
          <input
            id="username"
            name="username"
            type="text"
            value={form.username}
            onChange={handleChange}
            placeholder="username123"
            required
            className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-colors"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-foreground">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            placeholder="email@example.com"
            required
            className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-colors"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium text-foreground">
            Mật khẩu
          </label>
          <input
            id="password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            placeholder="Tối thiểu 6 ký tự"
            required
            className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-colors"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
            Xác nhận mật khẩu
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            value={form.confirmPassword}
            onChange={handleChange}
            placeholder="Nhập lại mật khẩu"
            required
            className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-colors"
          />
        </div>

        <CaptchaWidget action="register" onVerify={setCaptchaToken} />

        <button
          type="submit"
          disabled={registerMutation.isPending || blocked}
          className="flex h-10 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {registerMutation.isPending ? "Đang tạo tài khoản..." : blocked ? "Tạm không nhận đăng ký" : "Đăng ký"}
        </button>
      </form>

      {/* Social login row */}
      <SocialLoginRow label="Hoặc đăng ký với" />

      {/* Footer */}
      <p className="text-center text-sm text-muted-foreground">
        Đã có tài khoản?{" "}
        <Link href="/authentication/login" className="font-medium text-primary hover:underline">
          Đăng nhập
        </Link>
      </p>
    </div>
  )
}
