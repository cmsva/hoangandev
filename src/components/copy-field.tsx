"use client"

import * as React from "react"
import { toast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"

/**
 * CopyField — ô hiển thị giá trị (URL/key) + nút copy. Dùng cho callback URL,
 * hướng dẫn cấu hình OAuth/Captcha ở trang Extensions.
 */
export function CopyField({
  value,
  label,
  className,
}: {
  value: string
  label?: string
  className?: string
}) {
  const [copied, setCopied] = React.useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success("Đã copy")
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error("Copy thất bại")
    }
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      )}
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-md border border-border bg-muted/50 px-3 py-2 font-mono text-xs text-foreground">
          {value}
        </code>
        <button
          type="button"
          onClick={copy}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-card transition-colors hover:bg-accent"
          aria-label="Copy"
        >
          {copied ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
