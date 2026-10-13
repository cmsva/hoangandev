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
import { CopyField } from "@/components/copy-field"

type CaptchaProvider = "none" | "recaptcha_v2" | "turnstile" | "hcaptcha"
type CaptchaFunction = "register" | "login" | "forgot_password" | "create_ticket" | "verify_2fa"

interface CaptchaConfig {
  provider: CaptchaProvider
  siteKey: string
  secretKey: string
  functions: CaptchaFunction[]
}

const FUNCTION_LABELS: Record<CaptchaFunction, string> = {
  register: "Đăng ký",
  login: "Đăng nhập",
  forgot_password: "Quên mật khẩu",
  create_ticket: "Tạo ticket",
  verify_2fa: "Xác thực 2FA",
}

// Hướng dẫn lấy key cho từng provider captcha
const CAPTCHA_GUIDES: Record<
  Exclude<CaptchaProvider, "none">,
  { url: string; steps: string[] }
> = {
  recaptcha_v2: {
    url: "https://www.google.com/recaptcha/admin/create",
    steps: [
      "Mở Google reCAPTCHA Admin Console (link bên dưới).",
      'Chọn loại "reCAPTCHA v2" → "I\'m not a robot Checkbox".',
      "Thêm domain của website vào mục Domains (xem domain bên dưới).",
      "Sau khi tạo, copy Site Key + Secret Key dán vào 2 ô bên dưới.",
    ],
  },
  turnstile: {
    url: "https://dash.cloudflare.com/?to=/:account/turnstile",
    steps: [
      "Mở Cloudflare Dashboard → Turnstile → Add Site.",
      "Nhập domain website vào mục Hostname (xem domain bên dưới).",
      'Chọn Widget Mode "Managed" để tối ưu trải nghiệm.',
      "Copy Site Key + Secret Key dán vào 2 ô bên dưới.",
    ],
  },
  hcaptcha: {
    url: "https://dashboard.hcaptcha.com/sites/new",
    steps: [
      "Đăng nhập hCaptcha Dashboard → New Site.",
      "Thêm domain website vào danh sách Hostnames (xem domain bên dưới).",
      "Copy Site Key. Lấy Secret Key ở mục Settings → Secret Key.",
      "Dán Site Key + Secret Key vào 2 ô bên dưới.",
    ],
  },
}

function getAppDomain(): string {
  if (typeof window !== "undefined") return window.location.origin
  return ""
}

const PROVIDERS: Array<{ key: Exclude<CaptchaProvider, "none">; name: string; logo: React.ReactNode }> = [
  {
    key: "recaptcha_v2",
    name: "Google reCAPTCHA v2",
    logo: (
      <svg className="size-12" viewBox="0 0 256 262">
        <path fill="#4285F4" d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622l38.755 30.023l2.685.268c24.659-22.774 38.875-56.282 38.875-96.027" />
        <path fill="#34A853" d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055c-34.523 0-63.824-22.773-74.269-54.25l-1.531.13l-40.298 31.187l-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1" />
        <path fill="#FBBC05" d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82c0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602z" />
        <path fill="#EB4335" d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0C79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251" />
      </svg>
    ),
  },
  {
    key: "turnstile",
    name: "Cloudflare Turnstile",
    logo: (
      <svg className="size-12" viewBox="0 0 256 117">
        <path fill="#FBAD41" d="M205.52 50.813c-.858 0-1.705.03-2.551.058q-.207.012-.398.094a1.42 1.42 0 0 0-.92.994l-3.628 12.672c-1.565 5.449-.983 10.48 1.646 14.174c2.41 3.416 6.42 5.421 11.289 5.655l19.679 1.194c.585.03 1.092.312 1.4.776a1.92 1.92 0 0 1 .2 1.692a2.5 2.5 0 0 1-2.134 1.662l-20.448 1.193c-11.11.515-23.062 9.58-27.255 20.633l-1.474 3.9a1.092 1.092 0 0 0 .967 1.49h70.425a1.87 1.87 0 0 0 1.81-1.365A51.2 51.2 0 0 0 256 101.828c0-28.16-22.582-50.984-50.449-50.984" />
        <path fill="#F6821F" d="m174.782 115.362l1.303-4.583c1.568-5.449.987-10.48-1.639-14.173c-2.418-3.417-6.424-5.422-11.296-5.656l-92.312-1.193a1.82 1.82 0 0 1-1.459-.776a1.92 1.92 0 0 1-.203-1.693a2.5 2.5 0 0 1 2.154-1.662l93.173-1.193c11.063-.511 23.015-9.58 27.208-20.633l5.313-14.04c.214-.596.27-1.238.156-1.86C191.126 20.51 166.91 0 137.96 0C111.269 0 88.626 17.403 80.5 41.596a27 27 0 0 0-19.156-5.359C48.549 37.524 38.25 47.946 36.979 60.88a27.9 27.9 0 0 0 .702 9.642C16.773 71.145 0 88.454 0 109.726c0 1.923.137 3.818.413 5.667c.115.897.879 1.57 1.783 1.568h170.48a2.22 2.22 0 0 0 2.106-1.63" />
      </svg>
    ),
  },
  {
    key: "hcaptcha",
    name: "hCaptcha",
    logo: (
      <svg className="size-12" viewBox="0 0 256 256">
        <defs>
          <linearGradient id="hcGrad" x1="50%" x2="50%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#00D4BF" />
            <stop offset="100%" stopColor="#0074BF" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((r) =>
          [0, 1, 2, 3, 4, 5, 6, 7].map((c) => {
            const x = c * 32
            const y = r * 32
            const dist = Math.abs(3.5 - r) + Math.abs(3.5 - c)
            const opacity = dist <= 2 ? 1 : dist <= 3 ? 0.8 : dist <= 4 ? 0.7 : 0.5
            if (dist > 5) return null
            return (
              <rect key={`${r}-${c}`} x={x} y={y} width="32" height="32" fill="url(#hcGrad)" opacity={opacity} />
            )
          })
        )}
      </svg>
    ),
  },
]

export function CaptchaTab() {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(trpc.adminExtensions.getCaptchaConfig.queryOptions())
  const [editing, setEditing] = React.useState<Exclude<CaptchaProvider, "none"> | null>(null)

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-44 rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PROVIDERS.map((p) => {
          const isActive = data.provider === p.key
          return (
            <div
              key={p.key}
              className="group relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-card to-card/60 p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <span
                className={cn(
                  "absolute right-3 top-3 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                  isActive ? "bg-emerald-500/15 text-emerald-600" : "bg-rose-500/15 text-rose-600"
                )}
              >
                {isActive ? "Đang dùng" : "Tắt"}
              </span>
              <div className="flex flex-col items-center gap-3 pt-3 pb-12">
                <div className="flex size-14 items-center justify-center">{p.logo}</div>
                <div className="text-center">
                  <h3 className="text-sm font-bold tracking-tight">{p.name}</h3>
                  <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                    Spam Protection
                  </p>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => setEditing(p.key)} className="absolute bottom-3 right-3">
                Cấu hình
              </Button>
            </div>
          )
        })}
      </div>

      {editing && (
        <CaptchaDialog
          provider={editing}
          current={data}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function CaptchaDialog({
  provider,
  current,
  onClose,
}: {
  provider: Exclude<CaptchaProvider, "none">
  current: CaptchaConfig
  onClose: () => void
}) {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const isCurrent = current.provider === provider

  const [siteKey, setSiteKey] = React.useState(isCurrent ? current.siteKey : "")
  const [secretKey, setSecretKey] = React.useState(isCurrent ? current.secretKey : "")
  const [functions, setFunctions] = React.useState<CaptchaFunction[]>(isCurrent ? current.functions : [])
  const [showSecret, setShowSecret] = React.useState(false)

  const mut = useMutation({
    ...trpc.adminExtensions.saveCaptchaConfig.mutationOptions(),
    onSuccess: () => {
      toast.success("Đã lưu cấu hình Captcha")
      qc.invalidateQueries({ queryKey: trpc.adminExtensions.getCaptchaConfig.queryKey() })
      onClose()
    },
    onError: (err: any) => toast.error(err?.message || "Lưu thất bại"),
  })

  function toggleFn(fn: CaptchaFunction) {
    setFunctions((prev) =>
      prev.includes(fn) ? prev.filter((x) => x !== fn) : [...prev, fn]
    )
  }

  function handleSave(disable = false) {
    if (disable) {
      mut.mutate({ provider: "none", siteKey: "", secretKey: "", functions: [] })
      return
    }
    if (!siteKey.trim() || !secretKey.trim()) {
      toast.error("Vui lòng nhập đầy đủ Site Key và Secret Key")
      return
    }
    mut.mutate({ provider, siteKey: siteKey.trim(), secretKey: secretKey.trim(), functions })
  }

  const providerName = PROVIDERS.find((p) => p.key === provider)?.name ?? provider

  return (
    <Dialog open onOpenChange={(o) => !o && !mut.isPending && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cấu hình {providerName}</DialogTitle>
          <DialogDescription>
            Bật captcha sẽ thay thế provider hiện tại. Chọn các tính năng cần bảo vệ.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Setup guide */}
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Hướng dẫn lấy key
              </span>
              <a
                href={CAPTCHA_GUIDES[provider].url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Mở trang quản lý
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><path d="M15 3h6v6" /><path d="M10 14 21 3" />
                </svg>
              </a>
            </div>
            <ol className="list-decimal space-y-1 pl-4 text-xs leading-relaxed text-muted-foreground">
              {CAPTCHA_GUIDES[provider].steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
            <div className="mt-2.5">
              <CopyField label="Domain cần thêm (hostname)" value={getAppDomain()} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Site Key</Label>
            <Input
              value={siteKey}
              onChange={(e) => setSiteKey(e.target.value)}
              placeholder="public site key"
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Secret Key</Label>
            <div className="flex items-center gap-2">
              <Input
                type={showSecret ? "text" : "password"}
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder="server-side secret"
                className="font-mono"
              />
              <Button type="button" variant="outline" size="sm" onClick={() => setShowSecret((v) => !v)}>
                {showSecret ? "Ẩn" : "Hiện"}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Áp dụng cho
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(FUNCTION_LABELS) as CaptchaFunction[]).map((fn) => (
                <label
                  key={fn}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs transition-colors",
                    functions.includes(fn)
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:border-primary/40"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={functions.includes(fn)}
                    onChange={() => toggleFn(fn)}
                    className="size-4 rounded border-input"
                  />
                  <span>{FUNCTION_LABELS[fn]}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button variant="outline" onClick={() => handleSave(true)} disabled={mut.isPending} className="text-rose-600">
            Tắt captcha
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={mut.isPending}>Hủy</Button>
            <Button onClick={() => handleSave(false)} disabled={mut.isPending}>
              {mut.isPending ? "Đang lưu..." : "Lưu cấu hình"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
