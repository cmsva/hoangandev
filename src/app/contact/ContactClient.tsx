"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/client"
import { AppSidebar } from "@/components/app-sidebar"
import { useSidebar } from "@/components/sidebar-context"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardFooter } from "@/components/dashboard/dashboard-footer"
import { toast } from "@/components/ui/toast"
import { IconEnvelope, IconCopy, IconCheck, IconExternalLink } from "@/components/icons"
import { cn } from "@/lib/utils"

// ─── Brand / contact inline icons (không có trong bộ Nucleo) ─────────────────
function IconPhone({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

function IconFacebook({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" />
    </svg>
  )
}

function IconTelegram({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M11.94 2C6.45 2 2 6.48 2 12s4.45 10 9.94 10c5.5 0 9.96-4.48 9.96-10S17.44 2 11.94 2zm4.64 6.8-1.55 7.34c-.12.53-.43.66-.86.41l-2.38-1.76-1.15 1.11c-.13.13-.24.24-.48.24l.17-2.43 4.42-3.99c.19-.17-.04-.27-.3-.1L9.4 13.5l-2.35-.74c-.51-.16-.52-.51.11-.76l9.17-3.54c.43-.16.8.1.65.84z" />
    </svg>
  )
}

function IconZalo({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2C6.48 2 2 5.94 2 10.8c0 2.78 1.46 5.25 3.74 6.86-.16.94-.6 2.15-1.32 3.04-.2.25 0 .62.31.54 1.96-.5 3.4-1.2 4.3-1.78.9.2 1.86.31 2.97.31 5.52 0 10-3.94 10-8.97S17.52 2 12 2zm-4.6 11.2H5.2c-.3 0-.5-.2-.5-.5s.2-.5.5-.5h1.2l-1.5-2.4a.5.5 0 0 1 .42-.78h2.2c.3 0 .5.2.5.5s-.2.5-.5.5H6.5l1.5 2.4a.5.5 0 0 1-.42.78h-.18zm3.1-.5c0 .3-.2.5-.5.5s-.5-.2-.5-.5V8.5c0-.3.2-.5.5-.5s.5.2.5.5v4.2zm5.1.5c-.2 0-.4-.12-.46-.3a2.1 2.1 0 0 1-1.14.34c-1.1 0-2-.94-2-2.1s.9-2.1 2-2.1c.42 0 .82.13 1.14.34.07-.18.26-.3.46-.3.3 0 .5.2.5.5v3.12c0 .3-.2.5-.5.5zm3.4 0c-.3 0-.5-.2-.5-.5V8.5c0-.3.2-.5.5-.5s.5.2.5.5v4.2c0 .3-.2.5-.5.5z" />
    </svg>
  )
}

type ContactItem = {
  key: string
  label: string
  value: string
  icon: React.ReactNode
  /** gradient classes cho icon container */
  gradient: string
  /** link để mở (mailto/tel/https) hoặc undefined nếu chỉ copy */
  href?: string
  /** cho phép copy giá trị */
  copyable?: boolean
}

function ContactCard({ item }: { item: ContactItem }) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(item.value)
      setCopied(true)
      toast.success(`Đã sao chép ${item.label.toLowerCase()}`)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error("Không sao chép được")
    }
  }

  return (
    <div className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
      {/* glow */}
      <div className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full bg-primary/5 blur-2xl transition-opacity group-hover:opacity-100" />

      <div className="flex items-start justify-between">
        <div className={cn("flex size-12 items-center justify-center rounded-xl text-white shadow-sm", item.gradient)}>
          {item.icon}
        </div>
        <div className="flex items-center gap-1.5">
          {item.copyable && (
            <button
              type="button"
              onClick={handleCopy}
              aria-label={`Sao chép ${item.label}`}
              className="flex size-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {copied ? <IconCheck size={15} /> : <IconCopy size={15} />}
            </button>
          )}
          {item.href && (
            <a
              href={item.href}
              target={item.href.startsWith("http") ? "_blank" : undefined}
              rel="noopener noreferrer"
              aria-label={`Mở ${item.label}`}
              className="flex size-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              <IconExternalLink size={15} />
            </a>
          )}
        </div>
      </div>

      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{item.label}</p>
        <p className="mt-1 truncate text-base font-semibold text-foreground">{item.value}</p>
      </div>
    </div>
  )
}

function ContactSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-[148px] animate-pulse rounded-2xl border border-border bg-muted/40" />
      ))}
    </div>
  )
}

function ContactBody() {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(trpc.public.siteInfo.queryOptions())

  const items: ContactItem[] = React.useMemo(() => {
    if (!data) return []
    const list: ContactItem[] = []
    if (data.hotline)
      list.push({ key: "hotline", label: "Hotline", value: data.hotline, icon: <IconPhone size={22} />, gradient: "bg-gradient-to-br from-emerald-500 to-green-600", href: `tel:${data.hotline.replace(/\s/g, "")}`, copyable: true })
    if (data.email)
      list.push({ key: "email", label: "Email", value: data.email, icon: <IconEnvelope size={22} />, gradient: "bg-gradient-to-br from-sky-500 to-blue-600", href: `mailto:${data.email}`, copyable: true })
    if (data.zalo)
      list.push({ key: "zalo", label: "Zalo", value: data.zalo, icon: <IconZalo size={22} />, gradient: "bg-gradient-to-br from-blue-500 to-cyan-500", href: data.zalo.startsWith("http") ? data.zalo : undefined, copyable: true })
    if (data.telegram)
      list.push({ key: "telegram", label: "Telegram", value: data.telegram, icon: <IconTelegram size={22} />, gradient: "bg-gradient-to-br from-sky-400 to-blue-500", href: data.telegram.startsWith("http") ? data.telegram : `https://t.me/${data.telegram.replace(/^@/, "")}`, copyable: true })
    if (data.fanpage)
      list.push({ key: "fanpage", label: "Fanpage", value: data.fanpage, icon: <IconFacebook size={22} />, gradient: "bg-gradient-to-br from-blue-600 to-indigo-600", href: data.fanpage, copyable: false })
    return list
  }, [data])

  return (
    <main className="flex-1 space-y-6 p-6">
      {/* Breadcrumb + title */}
      <div className="space-y-1">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <a href="/dashboard" className="transition-colors hover:text-foreground">Trang chủ</a>
          <span>/</span>
          <span className="font-medium text-foreground">Liên hệ</span>
        </nav>
        <h1 className="text-xl font-bold text-foreground">Liên hệ với chúng tôi</h1>
        <p className="text-sm text-muted-foreground">
          {data?.adminName
            ? `Mọi thắc mắc vui lòng liên hệ ${data.adminName} qua các kênh dưới đây.`
            : "Mọi thắc mắc vui lòng liên hệ qua các kênh hỗ trợ dưới đây."}
        </p>
      </div>

      {/* Hero card */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-6 shadow-sm">
        <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-foreground">{data?.siteTitle || "Hỗ trợ khách hàng"}</h2>
            <p className="max-w-xl text-sm text-muted-foreground">
              {data?.siteDescription || "Đội ngũ hỗ trợ luôn sẵn sàng giải đáp mọi thắc mắc của bạn trong thời gian sớm nhất."}
            </p>
          </div>
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <IconEnvelope size={28} />
          </div>
        </div>
      </div>

      {/* Contact methods */}
      {isLoading ? (
        <ContactSkeleton />
      ) : items.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <ContactCard key={item.key} item={item} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-card py-16 text-center text-muted-foreground">
          Chưa có thông tin liên hệ. Vui lòng cập nhật trong trang cài đặt admin.
        </div>
      )}
    </main>
  )
}

export function ContactClient() {
  const { collapsed } = useSidebar()
  const [isMounted, setIsMounted] = React.useState(false)

  React.useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return <div className="flex min-h-screen bg-background" suppressHydrationWarning />
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div
        className={cn(
          "flex flex-1 flex-col transition-all duration-300 ease-in-out",
          collapsed ? "lg:ml-[72px]" : "lg:ml-[260px]"
        )}
      >
        <DashboardHeader />
        <ContactBody />
        <DashboardFooter />
      </div>
    </div>
  )
}
