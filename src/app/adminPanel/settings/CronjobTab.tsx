"use client"

import * as React from "react"
import { useTRPC } from "@/trpc/client"
import { useQuery } from "@tanstack/react-query"
import { Skeleton } from "@/components/ui/skeleton"
import { IconClock, IconCircleCheck, IconAlertWarning, IconCopy, IconCheck } from "@/components/icons"
import { toast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Format ISO date → "x giây/phút/giờ trước" + absolute. */
function formatRelative(iso: string | null): { rel: string; abs: string } {
  if (!iso) return { rel: "Chưa chạy", abs: "—" }
  const d = new Date(iso)
  const diffMs = Date.now() - d.getTime()
  const sec = Math.floor(diffMs / 1000)
  const min = Math.floor(sec / 60)
  const hr = Math.floor(min / 60)
  const day = Math.floor(hr / 24)

  let rel: string
  if (sec < 60) rel = `${sec} giây trước`
  else if (min < 60) rel = `${min} phút trước`
  else if (hr < 24) rel = `${hr} giờ trước`
  else rel = `${day} ngày trước`

  const abs = d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
  return { rel, abs }
}

// ─── Copy button ─────────────────────────────────────────────────────────────

function CopyPath({ path }: { path: string }) {
  const [copied, setCopied] = React.useState(false)
  const handleCopy = React.useCallback(() => {
    navigator.clipboard.writeText(path).then(
      () => {
        setCopied(true)
        toast.success("Đã copy đường dẫn")
        setTimeout(() => setCopied(false), 1500)
      },
      () => toast.error("Copy thất bại")
    )
  }, [path])

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex shrink-0 items-center justify-center rounded-md border border-border bg-background p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      aria-label="Copy đường dẫn"
    >
      {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
    </button>
  )
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: "success" | "error" | null }) {
  if (status === null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
        <IconClock size={12} />
        Chưa chạy
      </span>
    )
  }
  if (status === "success") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
        <IconCircleCheck size={12} />
        Thành công
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">
      <IconAlertWarning size={12} />
      Lỗi
    </span>
  )
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

export function CronjobTab() {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery({
    ...trpc.admin.getCronStatuses.queryOptions(),
    refetchInterval: 30_000, // tự refresh mỗi 30s
  })

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  const jobs = data ?? []

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Danh sách các tác vụ định kỳ của hệ thống. Thời gian chạy cuối được lưu
        trong MongoDB, tự động cập nhật mỗi lần cron chạy. Bảng này refresh mỗi 30 giây.
      </p>

      <div className="grid gap-3">
        {jobs.map((job, idx) => {
          const { rel, abs } = formatRelative(job.lastRunAt)
          return (
            <div
              key={`${job.key}-${job.bankName ?? "single"}-${idx}`}
              className="rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/30"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">{job.label}</h3>
                    {job.bankName && (
                      <span className="inline-flex items-center rounded-md bg-blue-500/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">
                        {job.bankName}
                      </span>
                    )}
                    <StatusBadge status={job.lastStatus} />
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {job.description}
                  </p>
                </div>
                <div className="text-right">
                  <div
                    className={cn(
                      "text-xs font-semibold",
                      job.lastRunAt ? "text-foreground" : "text-muted-foreground"
                    )}
                    title={abs}
                  >
                    {rel}
                  </div>
                  {job.lastDurationMs != null && (
                    <div className="text-[11px] text-muted-foreground">
                      {job.lastDurationMs}ms · {job.runCount} lần
                    </div>
                  )}
                </div>
              </div>

              {/* URL + recommended */}
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <code className="truncate rounded bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
                    {job.url}
                  </code>
                  <CopyPath path={job.url} />
                </div>
                <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">
                  <IconClock size={12} />
                  {job.recommended}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
