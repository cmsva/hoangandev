"use client"

import * as React from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
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

type Provider = "google" | "github" | "discord" | "zalo" | "telegram"

interface OAuthEntry {
  clientId: string
  clientSecret: string
}

const PROVIDER_INFO: Record<
  Provider,
  { name: string; desc: string; secretLabel: string; idLabel: string }
> = {
  google: { name: "Google", desc: "OAuth 2.0", idLabel: "Client ID", secretLabel: "Client Secret" },
  github: { name: "GitHub", desc: "OAuth 2.0", idLabel: "Client ID", secretLabel: "Client Secret" },
  discord: { name: "Discord", desc: "OAuth 2.0", idLabel: "Client ID", secretLabel: "Client Secret" },
  zalo: { name: "Zalo", desc: "OAuth 2.0", idLabel: "App ID", secretLabel: "App Secret" },
  telegram: { name: "Telegram", desc: "Login Widget", idLabel: "Bot Username", secretLabel: "Bot Token" },
}

// Hướng dẫn tạo OAuth app + lấy client id/secret cho từng provider
const OAUTH_GUIDES: Record<Provider, { url: string; steps: string[] }> = {
  google: {
    url: "https://console.cloud.google.com/apis/credentials",
    steps: [
      "Mở Google Cloud Console → APIs & Services → Credentials.",
      'Tạo "OAuth client ID" → Application type: Web application.',
      "Dán Callback URL bên dưới vào mục Authorized redirect URIs.",
      "Copy Client ID + Client Secret dán vào 2 ô bên dưới.",
    ],
  },
  github: {
    url: "https://github.com/settings/developers",
    steps: [
      "Mở GitHub → Settings → Developer settings → OAuth Apps → New OAuth App.",
      "Dán Callback URL bên dưới vào ô Authorization callback URL.",
      "Sau khi tạo, bấm Generate a new client secret.",
      "Copy Client ID + Client Secret dán vào 2 ô bên dưới.",
    ],
  },
  discord: {
    url: "https://discord.com/developers/applications",
    steps: [
      "Mở Discord Developer Portal → New Application.",
      "Vào OAuth2 → Redirects, dán Callback URL bên dưới.",
      "Lấy Client ID + Client Secret ở tab OAuth2 → General.",
      "Dán Client ID + Client Secret vào 2 ô bên dưới.",
    ],
  },
  zalo: {
    url: "https://developers.zalo.me/",
    steps: [
      "Mở Zalo Developers → tạo ứng dụng → mục Đăng nhập Zalo.",
      "Dán Callback URL bên dưới vào Redirect URI cho phép.",
      "Lấy App ID + App Secret ở phần Thông tin ứng dụng.",
      "Dán App ID + App Secret vào 2 ô bên dưới.",
    ],
  },
  telegram: {
    url: "https://t.me/BotFather",
    steps: [
      "Mở @BotFather → /newbot để tạo bot, lấy Bot Token.",
      "Dùng /setdomain đặt domain website cho bot (xem domain bên dưới).",
      "Bot Username là tên kết thúc bằng 'bot' (vd: my_login_bot).",
      "Dán Bot Username + Bot Token vào 2 ô bên dưới.",
    ],
  },
}

function getAppOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin
  return ""
}

const PROVIDER_LOGOS: Record<Provider, React.ReactNode> = {
  google: (
    <svg className="size-12" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93z" />
      <path fill="#EB4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  ),
  github: (
    <svg className="size-12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  ),
  discord: (
    <svg className="size-12" viewBox="0 0 256 199">
      <path fill="#5865F2" d="M216.856 16.597A208.5 208.5 0 0 0 164.042 0c-2.275 4.113-4.933 9.645-6.766 14.046q-29.538-4.442-58.533 0c-1.832-4.4-4.55-9.933-6.846-14.046a207.8 207.8 0 0 0-52.855 16.638C5.618 67.147-3.443 116.4 1.087 164.956c22.169 16.555 43.653 26.612 64.775 33.193A161 161 0 0 0 79.735 175.3a136.4 136.4 0 0 1-21.846-10.632a109 109 0 0 0 5.356-4.237c42.122 19.702 87.89 19.702 129.51 0a132 132 0 0 0 5.355 4.237a136 136 0 0 1-21.886 10.653c4.006 8.02 8.638 15.67 13.873 22.848c21.142-6.58 42.646-16.637 64.815-33.213c5.316-56.288-9.08-105.09-38.056-148.36M85.474 135.095c-12.645 0-23.015-11.805-23.015-26.18s10.149-26.2 23.015-26.2s23.236 11.804 23.015 26.2c.02 14.375-10.148 26.18-23.015 26.18m85.051 0c-12.645 0-23.014-11.805-23.014-26.18s10.148-26.2 23.014-26.2c12.867 0 23.236 11.804 23.015 26.2c0 14.375-10.148 26.18-23.015 26.18" />
    </svg>
  ),
  zalo: (
    <svg className="size-12" viewBox="0 0 24 24" fill="#0068FF">
      <path d="M12.49 10.2722v-.4496h1.3467v6.3218h-.7704a.576.576 0 01-.5763-.5729l-.0006.0005a3.273 3.273 0 01-1.9372.6321c-1.8138 0-3.2844-1.4697-3.2844-3.2823 0-1.8125 1.4706-3.2822 3.2844-3.2822a3.273 3.273 0 011.9372.6321l.0006.0005zM6.9188 7.7896v.205c0 .3823-.051.6944-.2995 1.0605l-.03.0343c-.0542.0615-.1815.206-.2421.2843L2.024 14.8h4.8948v.7682a.5764.5764 0 01-.5767.5761H0v-.3622c0-.4436.1102-.6414.2495-.8476L4.8582 9.23H.1922V7.7896h6.7266zm8.5513 8.3548a.4805.4805 0 01-.4803-.4798v-7.875h1.4416v8.3548H15.47zM20.6934 9.6C22.52 9.6 24 11.0807 24 12.9044c0 1.8252-1.4801 3.306-3.3066 3.306-1.8264 0-3.3066-1.4808-3.3066-3.306 0-1.8237 1.4802-3.3044 3.3066-3.3044zm-10.1412 5.253c1.0675 0 1.9324-.8645 1.9324-1.9312 0-1.065-.865-1.9295-1.9324-1.9295s-1.9324.8644-1.9324 1.9295c0 1.0667.865 1.9312 1.9324 1.9312zm10.1412-.0033c1.0737 0 1.945-.8707 1.945-1.9453 0-1.073-.8713-1.9436-1.945-1.9436-1.0753 0-1.945.8706-1.945 1.9436 0 1.0746.8697 1.9453 1.945 1.9453z" />
    </svg>
  ),
  telegram: (
    <svg className="size-12" viewBox="0 0 256 256">
      <defs><linearGradient id="tgLogin" x1="50%" x2="50%" y1="0%" y2="100%"><stop offset="0%" stopColor="#2AABEE" /><stop offset="100%" stopColor="#229ED9" /></linearGradient></defs>
      <path fill="url(#tgLogin)" d="M128 0C94.06 0 61.48 13.494 37.5 37.49A128.04 128.04 0 0 0 0 128c0 33.934 13.5 66.514 37.5 90.51C61.48 242.506 94.06 256 128 256s66.52-13.494 90.5-37.49c24-23.996 37.5-56.576 37.5-90.51s-13.5-66.514-37.5-90.51C194.52 13.494 161.94 0 128 0" />
      <path fill="#FFF" d="M57.94 126.648q55.98-24.384 74.64-32.152c35.56-14.786 42.94-17.354 47.76-17.441c1.06-.017 3.42.245 4.96 1.49c1.28 1.05 1.64 2.47 1.82 3.467c.16.996.38 3.266.2 5.038c-1.92 20.24-10.26 69.356-14.5 92.026c-1.78 9.592-5.32 12.808-8.74 13.122c-7.44.684-13.08-4.912-20.28-9.63c-11.26-7.386-17.62-11.982-28.56-19.188c-12.64-8.328-4.44-12.906 2.76-20.386c1.88-1.958 34.64-31.748 35.26-34.45c.08-.338.16-1.598-.6-2.262c-.74-.666-1.84-.438-2.64-.258c-1.14.256-19.12 12.152-54 35.686c-5.1 3.508-9.72 5.218-13.88 5.128c-4.56-.098-13.36-2.584-19.9-4.708c-8-2.606-14.38-3.984-13.82-8.41c.28-2.304 3.46-4.662 9.52-7.072" />
    </svg>
  ),
}

const PROVIDERS: Provider[] = ["google", "github", "discord", "zalo", "telegram"]

export function LoginTab({
  oauthConfig,
  isLoading,
}: {
  oauthConfig: Record<Provider, OAuthEntry> | undefined
  isLoading: boolean
}) {
  const [editing, setEditing] = React.useState<Provider | null>(null)

  if (isLoading || !oauthConfig) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-44 rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {PROVIDERS.map((p) => {
        const entry = oauthConfig[p]
        const enabled = !!(entry?.clientId && entry?.clientSecret)
        const info = PROVIDER_INFO[p]
        return (
          <div
            key={p}
            className="group relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-card to-card/60 p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <span
              className={cn(
                "absolute right-3 top-3 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                enabled ? "bg-emerald-500/15 text-emerald-600" : "bg-rose-500/15 text-rose-600"
              )}
            >
              {enabled ? "Bật" : "Tắt"}
            </span>
            <div className="flex flex-col items-center gap-3 pt-3 pb-12">
              <div className="flex size-14 items-center justify-center">{PROVIDER_LOGOS[p]}</div>
              <div className="text-center">
                <h3 className="text-sm font-bold tracking-tight">{info.name}</h3>
                <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  {info.desc}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing(p)}
              className="absolute bottom-3 right-3"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Cấu hình
            </Button>
          </div>
        )
      })}

      {editing && (
        <OAuthEditDialog
          provider={editing}
          entry={oauthConfig[editing]}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function OAuthEditDialog({
  provider,
  entry,
  onClose,
}: {
  provider: Provider
  entry: OAuthEntry
  onClose: () => void
}) {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const info = PROVIDER_INFO[provider]
  const [clientId, setClientId] = React.useState(entry.clientId)
  const [clientSecret, setClientSecret] = React.useState(entry.clientSecret)
  const [show, setShow] = React.useState(false)

  const mut = useMutation({
    ...trpc.adminExtensions.updateOAuthConfig.mutationOptions(),
    onSuccess: () => {
      toast.success(`Đã lưu cấu hình ${info.name}`)
      qc.invalidateQueries({ queryKey: trpc.adminExtensions.getOAuthConfig.queryKey() })
      onClose()
    },
    onError: (err: any) => toast.error(err?.message || "Lưu thất bại"),
  })

  return (
    <Dialog open onOpenChange={(o) => !o && !mut.isPending && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center">{PROVIDER_LOGOS[provider]}</div>
            Cấu hình {info.name}
          </DialogTitle>
          <DialogDescription>
            Để trống cả 2 trường để tắt đăng nhập qua {info.name}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {/* Callback URL + setup guide */}
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Hướng dẫn cấu hình
              </span>
              <a
                href={OAUTH_GUIDES[provider].url}
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
              {OAUTH_GUIDES[provider].steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
            <div className="mt-2.5">
              <CopyField
                label={provider === "telegram" ? "Domain website" : "Callback / Redirect URL"}
                value={
                  provider === "telegram"
                    ? getAppOrigin()
                    : `${getAppOrigin()}/api/auth/oauth/callback/${provider}`
                }
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="oauth-id">{info.idLabel}</Label>
            <Input
              id="oauth-id"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder={info.idLabel}
              disabled={mut.isPending}
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="oauth-secret">{info.secretLabel}</Label>
            <div className="flex items-center gap-2">
              <Input
                id="oauth-secret"
                type={show ? "text" : "password"}
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder={info.secretLabel}
                disabled={mut.isPending}
                className="font-mono"
              />
              <Button type="button" variant="outline" size="sm" onClick={() => setShow((v) => !v)}>
                {show ? "Ẩn" : "Hiện"}
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mut.isPending}>Hủy</Button>
          <Button
            onClick={() => mut.mutate({ provider, clientId: clientId.trim(), clientSecret: clientSecret.trim() })}
            disabled={mut.isPending}
          >
            {mut.isPending ? "Đang lưu..." : "Lưu cấu hình"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
