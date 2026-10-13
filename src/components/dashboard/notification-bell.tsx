"use client"

import * as React from "react"
import { useTRPC } from "@/trpc/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { sanitizeRichHtml, safeRedirectUrl } from "@/lib/sanitize"
import { useSocket } from "@/components/realtime/SocketProvider"

/**
 * Notifications — chia thành:
 *  - useNotificationUnread(): badge count + realtime invalidation (socket).
 *  - NotificationPanel: nội dung dropdown (header/body/footer), KHÔNG bọc Popover
 *    → tái dùng được trong NotificationBell (desktop) và UserDropdown (mobile).
 *  - NotificationBell: Popover + trigger bell + NotificationPanel.
 */

/** Badge unread count + realtime invalidation. Dùng ở mọi nơi hiển thị badge.
 *  `enabled=false` (guest) → bỏ qua query để không gọi endpoint protected. */
export function useNotificationUnread(enabled = true) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const socket = useSocket()

  const unreadQuery = useQuery({
    ...trpc.notification.unreadCount.queryOptions(),
    enabled,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })

  React.useEffect(() => {
    if (!socket || !enabled) return
    const onNew = () => {
      void queryClient.invalidateQueries({ queryKey: trpc.notification.unreadCount.queryOptions().queryKey })
      void queryClient.invalidateQueries({ queryKey: trpc.notification.headerList.queryOptions().queryKey })
    }
    socket.on("notification:new", onNew)
    return () => { socket.off("notification:new", onNew) }
  }, [socket, queryClient, trpc, enabled])

  return { unread: unreadQuery.data?.count ?? 0 }
}

/**
 * NotificationPanel — phần nội dung (không bọc Popover).
 *  - `active`: bật fetch list (lazy — chỉ load khi panel hiển thị).
 *  - `onNavigate`: gọi khi user bấm item/footer (để đóng container ngoài).
 *  - `bodyClassName`: tùy biến chiều cao body cho từng ngữ cảnh.
 */
export function NotificationPanel({
  active,
  onNavigate,
  bodyClassName = "h-[400px]",
}: {
  active: boolean
  onNavigate?: () => void
  bodyClassName?: string
}) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { unread } = useNotificationUnread()

  const listQuery = useQuery({
    ...trpc.notification.headerList.queryOptions(),
    enabled: active,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: trpc.notification.unreadCount.queryOptions().queryKey })
    queryClient.invalidateQueries({ queryKey: trpc.notification.headerList.queryOptions().queryKey })
  }

  const markAllMut = useMutation(
    trpc.notification.markAllRead.mutationOptions({ onSuccess: invalidate })
  )
  const markReadMut = useMutation(
    trpc.notification.markRead.mutationOptions({ onSuccess: invalidate })
  )

  function onItemClick(item: any) {
    if (!item.readAt) markReadMut.mutate({ ids: [item.id] })
    if (item.link) {
      onNavigate?.()
      window.location.href = safeRedirectUrl(item.link)
    }
  }

  const items = listQuery.data?.items || []

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">Thông báo</h2>
          {unread > 0 && (
            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-none text-white">
              {unread}
            </span>
          )}
        </div>
        {unread > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto px-2 py-1 text-xs text-blue-500 hover:bg-blue-500/10 hover:text-blue-600"
            onClick={() => markAllMut.mutate()}
            disabled={markAllMut.isPending}
          >
            Đọc tất cả
          </Button>
        )}
      </div>

      {/* Body */}
      <div className={cn("relative overflow-y-auto", bodyClassName)}>
        {listQuery.isLoading ? (
          <div className="space-y-3 p-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground">
            <BellIconLarge />
            <p className="text-sm">Chưa có thông báo nào</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {items.map((it: any) => (
              <NotificationItem key={it.id} item={it} onClick={() => onItemClick(it)} />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border px-4 py-2">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="h-8 w-full text-xs text-muted-foreground hover:text-foreground"
        >
          <a href="/customer/notifications" onClick={() => onNavigate?.()}>
            Xem tất cả thông báo
          </a>
        </Button>
      </div>
    </>
  )
}

/**
 * NotificationBell — header dropdown thông báo cho user (desktop).
 * Trigger ẩn trên mobile (md:inline-flex) — mobile dùng bell trong UserDropdown.
 */
export function NotificationBell() {
  const [open, setOpen] = React.useState(false)
  const { unread } = useNotificationUnread()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span className="inline-flex cursor-pointer transition-transform duration-200 ease-out hover:scale-[1.08]">
          <button
            type="button"
            className="relative hidden h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-accent hover:text-foreground md:inline-flex"
            aria-label="Thông báo"
          >
            <BellIcon />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[16px] -translate-y-1/4 translate-x-1/4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-4 text-white shadow-sm ring-2 ring-background">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </button>
        </span>
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={8} className="w-[380px] overflow-hidden p-0">
        <NotificationPanel active={open} onNavigate={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  )
}

// ─── Item ──────────────────────────────────────────────────────────────────

function NotificationItem({
  item,
  onClick,
}: {
  item: any
  onClick: () => void
}) {
  const isUnread = !item.readAt
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick()
        }
      }}
      className={cn(
        "group relative cursor-pointer p-4 transition-colors hover:bg-accent/50",
        isUnread && "bg-blue-500/5"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <div className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full",
            iconBgClass(item.type)
          )}>
            <TypeIcon type={item.type} />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-sm leading-tight">{item.title}</h3>
            {isUnread && (
              <div className="flex-shrink-0 mt-1">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
              </div>
            )}
          </div>
          {item.content && (
            <div
              className="mt-1 text-xs text-muted-foreground line-clamp-2 [&_strong]:text-foreground [&_strong]:font-semibold"
              dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(item.content) }}
            />
          )}
          <div className="mt-2 text-xs text-muted-foreground">
            {timeAgo(item.createdAt)}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function iconBgClass(type: string) {
  switch (type) {
    case "deposit":
      return "bg-emerald-500/10 text-emerald-600"
    case "order":
      return "bg-blue-500/10 text-blue-600"
    case "service":
      return "bg-purple-500/10 text-purple-600"
    case "auth":
      return "bg-amber-500/10 text-amber-600"
    case "ticket":
      return "bg-indigo-500/10 text-indigo-600"
    case "promo":
      return "bg-rose-500/10 text-rose-600"
    default:
      return "bg-blue-500/10 text-blue-600"
  }
}

function TypeIcon({ type }: { type: string }) {
  if (type === "deposit") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="14" x="2" y="5" rx="2" />
        <line x1="2" x2="22" y1="10" y2="10" />
      </svg>
    )
  }
  if (type === "order") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
        <path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
    )
  }
  if (type === "auth") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="11" x="3" y="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    )
  }
  if (type === "ticket") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
        <path d="M13 5v2" /><path d="M13 17v2" /><path d="M13 11v2" />
      </svg>
    )
  }
  return <BellIconSmall />
}

function BellIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" className="size-[18px] text-blue-500">
      <path d="m13.75,10.75v-4.25c0-.0576-.1353-.1318-.1952-.1154-.2576.0704-.525.1154-.8048.1154-1.792,0-3.25-1.458-3.25-3.25,0-.3795.0514-.8384.1745-1.1755.0422-.1155-.3874-.3245-.6745-.3245-2.623,0-4.75,2.127-4.75,4.75v4.25c0,1.105-.895,2-2,2h13.5c-1.105,0-2-.895-2-2Z" fill="currentColor" opacity=".3" strokeWidth="0" />
      <path d="m10.5,15.3843c-.2995.5175-.8591.8657-1.5.8657s-1.2005-.3482-1.5-.8657" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <path d="m9,1.75c-2.623,0-4.75,2.127-4.75,4.75v4.25c0,1.105-.895,2-2,2h13.5c-1.105,0-2-.895-2-2v-3.6421" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <circle cx="12.75" cy="3.25" r="1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" fill="currentColor" />
    </svg>
  )
}

function BellIconSmall() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" className="size-[18px]">
      <path d="m13.75,10.75v-4.25c0-.0576-.1353-.1318-.1952-.1154-.2576.0704-.525.1154-.8048.1154-1.792,0-3.25-1.458-3.25-3.25,0-.3795.0514-.8384.1745-1.1755.0422-.1155-.3874-.3245-.6745-.3245-2.623,0-4.75,2.127-4.75,4.75v4.25c0,1.105-.895,2-2,2h13.5c-1.105,0-2-.895-2-2Z" fill="currentColor" opacity=".3" strokeWidth="0" />
      <path d="m10.5,15.3843c-.2995.5175-.8591.8657-1.5.8657s-1.2005-.3482-1.5-.8657" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <path d="m9,1.75c-2.623,0-4.75,2.127-4.75,4.75v4.25c0,1.105-.895,2-2,2h13.5c-1.105,0-2-.895-2-2v-3.6421" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <circle cx="12.75" cy="3.25" r="1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" fill="currentColor" />
    </svg>
  )
}

function BellIconLarge() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 18 18" className="size-10 opacity-30">
      <path d="m13.75,10.75v-4.25c0-.0576-.1353-.1318-.1952-.1154-.2576.0704-.525.1154-.8048.1154-1.792,0-3.25-1.458-3.25-3.25,0-.3795.0514-.8384.1745-1.1755.0422-.1155-.3874-.3245-.6745-.3245-2.623,0-4.75,2.127-4.75,4.75v4.25c0,1.105-.895,2-2,2h13.5c-1.105,0-2-.895-2-2Z" fill="currentColor" opacity=".3" strokeWidth="0" />
      <path d="m9,1.75c-2.623,0-4.75,2.127-4.75,4.75v4.25c0,1.105-.895,2-2,2h13.5c-1.105,0-2-.895-2-2v-3.6421" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
    </svg>
  )
}

function timeAgo(d: Date | string) {
  const date = new Date(d)
  const diff = (Date.now() - date.getTime()) / 1000
  if (diff < 60) return "Vừa xong"
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} ngày trước`
  if (diff < 86400 * 30) return `${Math.floor(diff / (86400 * 7))} tuần trước`
  return date.toLocaleDateString("vi-VN")
}
