"use client"

import * as React from "react"
import { useTRPC } from "@/trpc/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { AppSidebar } from "@/components/app-sidebar"
import { useSidebar } from "@/components/sidebar-context"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { sanitizeRichHtml, safeRedirectUrl } from "@/lib/sanitize"

export function NotificationsClient() {
  const { collapsed } = useSidebar()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [onlyUnread, setOnlyUnread] = React.useState(false)
  const limit = 20

  const listQuery = useQuery(
    trpc.notification.list.queryOptions({ page, limit, onlyUnread })
  )

  function invalidate() {
    queryClient.invalidateQueries({
      queryKey: trpc.notification.list.queryOptions({ page, limit, onlyUnread }).queryKey,
    })
    queryClient.invalidateQueries({
      queryKey: trpc.notification.unreadCount.queryOptions().queryKey,
    })
    queryClient.invalidateQueries({
      queryKey: trpc.notification.headerList.queryOptions().queryKey,
    })
  }

  const markAllMut = useMutation(
    trpc.notification.markAllRead.mutationOptions({ onSuccess: invalidate })
  )
  const markReadMut = useMutation(
    trpc.notification.markRead.mutationOptions({ onSuccess: invalidate })
  )
  const removeMut = useMutation(
    trpc.notification.remove.mutationOptions({ onSuccess: invalidate })
  )

  const items = listQuery.data?.items || []
  const total = listQuery.data?.total || 0
  const totalPages = listQuery.data?.totalPages || 1
  const unread = listQuery.data?.unread || 0

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div
        className={`flex flex-1 flex-col transition-all duration-300 ease-in-out ${
          collapsed ? "lg:ml-[72px]" : "lg:ml-[260px]"
        }`}
      >
        <DashboardHeader />
        <main className="flex-1 p-4 sm:p-6">
          <div className="space-y-6">
            {/* Header */}
            <div>
              <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2">
                <a href="/dashboard" className="hover:text-foreground transition-colors">
                  Trang chủ
                </a>
                <span>/</span>
                <span className="text-foreground font-medium">Thông báo</span>
              </nav>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">Thông báo</h1>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {total.toLocaleString("vi-VN")} thông báo · {unread.toLocaleString("vi-VN")} chưa đọc
                  </p>
                </div>
                {unread > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => markAllMut.mutate()}
                    disabled={markAllMut.isPending}
                  >
                    Đọc tất cả
                  </Button>
                )}
              </div>
            </div>

            {/* Filter pills */}
            <div className="flex flex-wrap gap-1.5">
              <FilterButton
                active={!onlyUnread}
                onClick={() => {
                  setOnlyUnread(false)
                  setPage(1)
                }}
              >
                Tất cả
              </FilterButton>
              <FilterButton
                active={onlyUnread}
                onClick={() => {
                  setOnlyUnread(true)
                  setPage(1)
                }}
              >
                Chưa đọc {unread > 0 && `(${unread})`}
              </FilterButton>
            </div>

            {/* List */}
            {listQuery.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-muted/40 py-12 text-center text-sm text-muted-foreground">
                {onlyUnread ? "Không có thông báo chưa đọc" : "Chưa có thông báo nào"}
              </div>
            ) : (
              <div className="rounded-xl border bg-card divide-y divide-border overflow-hidden">
                {items.map((it: any) => (
                  <NotificationRow
                    key={it.id}
                    item={it}
                    onMarkRead={() => markReadMut.mutate({ ids: [it.id] })}
                    onRemove={() => removeMut.mutate({ id: it.id })}
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">
                  Trang {page} / {totalPages}
                </span>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                  >
                    Trước
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                  >
                    Sau
                  </Button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-8 px-3 rounded-full text-xs font-semibold border transition-colors",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background border-border text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}

function NotificationRow({
  item,
  onMarkRead,
  onRemove,
}: {
  item: any
  onMarkRead: () => void
  onRemove: () => void
}) {
  const isUnread = !item.readAt
  const [expanded, setExpanded] = React.useState(false)

  function handleClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest("[data-action]")) return
    if (isUnread) onMarkRead()
    if (item.link) window.location.href = safeRedirectUrl(item.link)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      className={cn(
        "p-4 transition-colors hover:bg-accent/40 cursor-pointer",
        isUnread && "bg-blue-500/5"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 shrink-0">
          <BellSmall />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-sm leading-tight">{item.title}</h3>
            <div className="flex items-center gap-2 shrink-0">
              {isUnread && <span className="h-2 w-2 rounded-full bg-blue-500" />}
              <span className="text-[10px] uppercase font-bold text-muted-foreground">
                {sourceLabel(item.source)}
              </span>
            </div>
          </div>
          {item.content && (
            <div
              className={cn(
                "mt-1.5 text-xs text-muted-foreground [&_strong]:text-foreground [&_strong]:font-semibold",
                expanded ? "" : "line-clamp-2"
              )}
              dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(item.content) }}
            />
          )}
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{timeAgo(item.createdAt)}</span>
            <div className="flex items-center gap-2">
              {item.content && item.content.length > 200 && (
                <button
                  type="button"
                  data-action
                  onClick={(e) => {
                    e.stopPropagation()
                    setExpanded((v) => !v)
                  }}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  {expanded ? "Thu gọn" : "Xem thêm"}
                </button>
              )}
              {isUnread && (
                <button
                  type="button"
                  data-action
                  onClick={(e) => {
                    e.stopPropagation()
                    onMarkRead()
                  }}
                  className="text-xs text-muted-foreground hover:text-primary"
                >
                  Đánh dấu đã đọc
                </button>
              )}
              <button
                type="button"
                data-action
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove()
                }}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                Xoá
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function sourceLabel(s: string) {
  if (s === "admin") return "ADMIN"
  if (s === "campaign") return "CHIẾN DỊCH"
  return "HỆ THỐNG"
}

function BellSmall() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" className="size-[18px]">
      <path d="m13.75,10.75v-4.25c0-.0576-.1353-.1318-.1952-.1154-.2576.0704-.525.1154-.8048.1154-1.792,0-3.25-1.458-3.25-3.25,0-.3795.0514-.8384.1745-1.1755.0422-.1155-.3874-.3245-.6745-.3245-2.623,0-4.75,2.127-4.75,4.75v4.25c0,1.105-.895,2-2,2h13.5c-1.105,0-2-.895-2-2Z" fill="currentColor" opacity=".3" strokeWidth="0" />
      <path d="m10.5,15.3843c-.2995.5175-.8591.8657-1.5.8657s-1.2005-.3482-1.5-.8657" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <path d="m9,1.75c-2.623,0-4.75,2.127-4.75,4.75v4.25c0,1.105-.895,2-2,2h13.5c-1.105,0-2-.895-2-2v-3.6421" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <circle cx="12.75" cy="3.25" r="1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" fill="currentColor" />
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
  return date.toLocaleString("vi-VN")
}
