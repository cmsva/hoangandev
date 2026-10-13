"use client"

/**
 * FloatingPopup — dialog thông báo hiển thị ở dashboard.
 *
 * UX:
 *  - Mở tự động sau khi user vào dashboard (delay nhẹ).
 *  - 2 button:
 *      [Đóng]      → đóng phiên hiện tại (sessionStorage), mở tab khác sẽ thấy lại.
 *      [Ẩn 1 giờ] → snooze 60 phút (localStorage timestamp), không hiện lại trong 1h.
 *  - Content do admin soạn bằng CKEditor → HTML, server-side đã sanitize.
 *
 * Render bằng `dangerouslySetInnerHTML`. Không cần title/image/link riêng —
 * admin tự kiểm soát toàn bộ layout trong HTML.
 */
import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { FloatingPopupConfig } from "@/services/site-notification.service"

const SESSION_KEY = "dashboard_popup_dismissed_session"
const SNOOZE_KEY = "dashboard_popup_snoozed_until"
const SNOOZE_MS = 60 * 60 * 1000 // 1h

interface Props {
  config: FloatingPopupConfig
  /** Khi true (admin preview) → bỏ qua storage, luôn hiển thị, không persist. */
  preview?: boolean
}

export function FloatingPopup({ config, preview = false }: Props) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (preview) {
      setOpen(true)
      return
    }
    if (!config.enabled || !config.contentHtml.trim()) return

    // Dismissed phiên hiện tại?
    let sessionDismissed = false
    try {
      sessionDismissed = sessionStorage.getItem(SESSION_KEY) === "1"
    } catch {
      sessionDismissed = false
    }
    if (sessionDismissed) return

    // Snooze 1h?
    let snoozedUntil = 0
    try {
      snoozedUntil = Number(localStorage.getItem(SNOOZE_KEY) || 0)
    } catch {
      snoozedUntil = 0
    }
    if (snoozedUntil > Date.now()) return

    // Delay nhẹ cho page paint xong
    const t = setTimeout(() => setOpen(true), 800)
    return () => clearTimeout(t)
  }, [preview, config.enabled, config.contentHtml])

  if (!config.enabled || !config.contentHtml.trim()) return null

  function handleClose() {
    if (!preview) {
      try {
        sessionStorage.setItem(SESSION_KEY, "1")
      } catch {
        /* ignore */
      }
    }
    setOpen(false)
  }

  function handleSnooze() {
    if (!preview) {
      try {
        localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS))
      } catch {
        /* ignore */
      }
    }
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : handleClose())}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Thông báo</DialogTitle>
          <DialogDescription className="sr-only">
            Thông báo từ ban quản trị
          </DialogDescription>
        </DialogHeader>

        <div
          className="popup-html prose prose-sm dark:prose-invert mt-2 max-w-none [&_a]:text-primary [&_a]:underline [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_img]:rounded-lg [&_p]:my-2"
          dangerouslySetInnerHTML={{ __html: config.contentHtml }}
        />

        <DialogFooter className="mt-4">
          <Button type="button" variant="outline" onClick={handleSnooze}>
            Ẩn 1 giờ
          </Button>
          <Button type="button" onClick={handleClose}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
