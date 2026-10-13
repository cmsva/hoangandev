"use client"

import { useState } from "react"
import { useTRPC } from "@/trpc/client"
import { useQuery } from "@tanstack/react-query"
import { X } from "lucide-react"

/**
 * AnnouncementBanner — banner thông báo từ admin (config trong settings).
 * Hiển thị khi `announcement_enabled = "1"`. User có thể đóng (lưu localStorage).
 */
export function AnnouncementBanner() {
  const trpc = useTRPC()
  const { data } = useQuery(trpc.public.announcement.queryOptions()) as {
    data: { enabled: boolean; title: string; content: string } | undefined
  }

  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false
    return localStorage.getItem("announcement_dismissed") === (data?.title || "")
  })

  if (!data?.enabled || dismissed || !data.content) return null

  const handleDismiss = () => {
    setDismissed(true)
    localStorage.setItem("announcement_dismissed", data.title || "")
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 relative">
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Đóng"
      >
        <X className="h-4 w-4" />
      </button>
      <h3 className="text-sm font-bold text-primary mb-1 pr-8">📢 {data.title}</h3>
      <p className="text-sm text-foreground/80 whitespace-pre-line">{data.content}</p>
    </div>
  )
}
