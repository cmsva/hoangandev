"use client"

/**
 * DashboardBanners — stack alert nhiều màu hiển thị dưới breadcrumb dashboard.
 *
 * Mỗi banner do admin tạo với CKEditor (HTML, đã sanitize server-side).
 * Render bằng dangerouslySetInnerHTML; user dismiss từng banner riêng,
 * lưu localStorage theo banner.id (đóng = ẩn vĩnh viễn cho banner đó tới
 * khi admin đổi id hoặc xóa+tạo lại).
 */
import { useEffect, useState } from "react"
import type { BannerItem, BannerVariant } from "@/services/site-notification.service"

const STORAGE_KEY = "dashboard_banners_dismissed_v1"

const VARIANT_STYLES: Record<
  BannerVariant,
  { wrap: string; accent: string; icon: string; close: string }
> = {
  info: {
    wrap: "from-sky-500/15 via-sky-500/10 to-transparent border-sky-500/30",
    accent: "text-sky-600 dark:text-sky-400",
    icon: "M12 16v-4M12 8h.01",
    close: "hover:bg-sky-500/15 hover:text-sky-600 dark:hover:text-sky-400",
  },
  success: {
    wrap: "from-emerald-500/15 via-emerald-500/10 to-transparent border-emerald-500/30",
    accent: "text-emerald-600 dark:text-emerald-400",
    icon: "m9 12 2 2 4-4",
    close: "hover:bg-emerald-500/15 hover:text-emerald-600 dark:hover:text-emerald-400",
  },
  warning: {
    wrap: "from-amber-500/15 via-amber-500/10 to-transparent border-amber-500/30",
    accent: "text-amber-600 dark:text-amber-400",
    icon: "M12 9v4M12 17h.01",
    close: "hover:bg-amber-500/15 hover:text-amber-600 dark:hover:text-amber-400",
  },
  promo: {
    wrap: "from-fuchsia-500/15 via-pink-500/10 to-transparent border-fuchsia-500/30",
    accent: "text-fuchsia-600 dark:text-fuchsia-400",
    icon: "M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7M12 8v13M3 8h18v4H3z",
    close: "hover:bg-fuchsia-500/15 hover:text-fuchsia-600 dark:hover:text-fuchsia-400",
  },
  danger: {
    wrap: "from-rose-500/15 via-red-500/10 to-transparent border-rose-500/30",
    accent: "text-rose-600 dark:text-rose-400",
    icon: "M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z",
    close: "hover:bg-rose-500/15 hover:text-rose-600 dark:hover:text-rose-400",
  },
}

function loadDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return new Set()
    return new Set(arr.filter((x): x is string => typeof x === "string"))
  } catch {
    return new Set()
  }
}

function saveDismissed(set: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]))
  } catch {
    /* quota — ignore */
  }
}

interface Props {
  enabled: boolean
  banners: BannerItem[]
  /** Khi true (admin preview) → bỏ qua localStorage dismiss. */
  preview?: boolean
}

export function DashboardBanners({ enabled, banners, preview = false }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set())
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setDismissed(loadDismissed())
    setHydrated(true)
  }, [])

  if (!enabled || banners.length === 0) return null

  const visible = banners.filter(
    (b) => b.enabled && b.contentHtml.trim() && (preview || !dismissed.has(b.id))
  )
  if (visible.length === 0) return null

  // Trước hydrate: render placeholder ẩn để tránh layout shift; sau hydrate hiển thị thật.
  if (!hydrated && !preview) {
    return <div className="space-y-2" aria-hidden suppressHydrationWarning />
  }

  function handleDismiss(id: string) {
    if (preview) return
    setDismissed((prev) => {
      const next = new Set(prev)
      next.add(id)
      saveDismissed(next)
      return next
    })
  }

  return (
    <div className="space-y-2.5">
      {visible.map((banner) => {
        const styles = VARIANT_STYLES[banner.variant] ?? VARIANT_STYLES.info
        return (
          <div
            key={banner.id}
            role="status"
            className={`relative flex items-start gap-3 rounded-xl border bg-gradient-to-r ${styles.wrap} px-4 py-3 backdrop-blur-sm`}
          >
            <span className={`mt-0.5 shrink-0 ${styles.accent}`} aria-hidden>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" opacity="0.4" />
                <path d={styles.icon} />
              </svg>
            </span>

            <div
              className="banner-html prose prose-sm dark:prose-invert min-w-0 flex-1 [&_a]:text-current [&_a]:underline [&_h1]:text-base [&_h2]:text-base [&_h3]:text-sm [&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0"
              dangerouslySetInnerHTML={{ __html: banner.contentHtml }}
            />

            {!preview && (
              <button
                type="button"
                onClick={() => handleDismiss(banner.id)}
                className={`shrink-0 rounded-full p-1 text-muted-foreground transition-colors ${styles.close}`}
                aria-label="Đóng thông báo"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
