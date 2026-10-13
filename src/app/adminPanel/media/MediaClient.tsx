"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import { ImagePicker } from "@/components/admin/image-picker"
import { IconLoader, IconSearch, IconCopy, IconBrush } from "@/components/icons"

type MediaItem = {
  url: string
  name: string
  bucket: string
  size: number
  modifiedAt: string
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function MediaClient() {
  const [items, setItems] = React.useState<MediaItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState("")
  const [dummy, setDummy] = React.useState("")

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set("q", search.trim())
      const res = await fetch(`/api/admin/media?${params.toString()}`, { credentials: "include" })
      if (!res.ok) throw new Error("Không tải được thư viện ảnh")
      const data = await res.json()
      setItems(data.items || [])
    } catch (error: any) {
      toast.error(error.message || "Không tải được thư viện ảnh")
    } finally {
      setLoading(false)
    }
  }, [search])

  React.useEffect(() => {
    load()
  }, [])

  async function copy(url: string) {
    await navigator.clipboard.writeText(url)
    toast.success("Đã copy link ảnh")
  }

  return (
    <div className="space-y-6">
      {/* ─── Breadcrumb + Title ─── */}
      <div className="mb-6 space-y-1">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <a href="/adminPanel/dashboard" className="transition-colors hover:text-foreground">
            Admin
          </a>
          <ChevronRight />
          <span>Hệ thống</span>
          <ChevronRight />
          <span className="font-normal text-foreground">Thư viện ảnh</span>
        </nav>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <IconBrush size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Thư viện ảnh</h1>
              <p className="text-sm text-muted-foreground">
                Quản lý tất cả hình ảnh đã upload trong public/uploads.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-lg border bg-card p-4 shadow-sm">
        <ImagePicker value={dummy} onChange={(v) => { setDummy(v); setTimeout(load, 300) }} label="Upload nhanh" bucket="site" aspect="wide" />
      </div>

      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo tên file hoặc đường dẫn..." onKeyDown={(e) => { if (e.key === "Enter") load() }} />
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          {loading ? <IconLoader size={16} className="animate-spin" /> : "Tải lại"}
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, idx) => <Skeleton key={idx} className="h-44 rounded-xl" />)}
        </div>
      ) : items.length ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
          {items.map((item) => (
            <div key={item.url} className="overflow-hidden rounded-lg border bg-card shadow-sm transition hover:border-primary/40 hover:shadow-md">
              <div className="h-36 bg-muted">
                <img src={item.url} alt={item.name} className="h-full w-full object-cover" />
              </div>
              <div className="space-y-2 p-3">
                <div>
                  <p className="truncate text-sm font-medium" title={item.name}>{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.bucket} · {formatBytes(item.size)}</p>
                </div>
                <Button type="button" variant="outline" size="sm" className="w-full gap-2" onClick={() => copy(item.url)}>
                  <IconCopy size={14} />
                  Copy link
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          Chưa có hình ảnh nào.
        </div>
      )}
    </div>
  )
}

function ChevronRight() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-muted-foreground/50"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}
