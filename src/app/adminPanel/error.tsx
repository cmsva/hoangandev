"use client"

import { useEffect } from "react"

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Admin error:", error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="mx-auto max-w-md text-center space-y-6">
        <div className="inline-flex items-center justify-center size-16 rounded-2xl bg-red-500/10 text-red-500">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-foreground">Lỗi Admin Panel</h2>
        <p className="text-muted-foreground text-sm">
          Đã xảy ra lỗi trong khu vực quản trị. Thử tải lại trang.
        </p>
        {error.digest && (
          <p className="font-mono text-xs text-muted-foreground/60">
            Mã lỗi: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Thử lại
        </button>
      </div>
    </div>
  )
}
