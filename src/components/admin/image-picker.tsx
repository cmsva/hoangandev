"use client"

import * as React from "react"
import { toast } from "@/components/ui/toast"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { IconLoader, IconSearch, IconTrash } from "@/components/icons"
import { cn } from "@/lib/utils"

type MediaItem = {
  url: string
  name: string
  bucket: string
  size: number
  modifiedAt: string
}

async function uploadFile(file: File, bucket: string): Promise<{ url: string }> {
  const fd = new FormData()
  fd.append("file", file)
  fd.append("bucket", bucket)
  const res = await fetch("/api/admin/upload", { method: "POST", body: fd, credentials: "include" })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || "Upload thất bại")
  }
  return await res.json()
}

async function fetchMedia(bucket?: string, q?: string): Promise<MediaItem[]> {
  const params = new URLSearchParams()
  if (bucket) params.set("bucket", bucket)
  if (q) params.set("q", q)
  const res = await fetch(`/api/admin/media?${params.toString()}`, { credentials: "include" })
  if (!res.ok) throw new Error("Không tải được thư viện ảnh")
  const data = await res.json()
  return data.items || []
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

interface ImagePickerProps {
  value: string
  onChange: (value: string) => void
  bucket?: string
  label?: string
  hint?: string
  aspect?: "square" | "wide" | "logo"
  className?: string
}

export function ImagePicker({
  value,
  onChange,
  bucket = "site",
  label,
  hint,
  aspect = "wide",
  className,
}: ImagePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState("upload")
  const [uploading, setUploading] = React.useState(false)
  const [media, setMedia] = React.useState<MediaItem[]>([])
  const [loadingMedia, setLoadingMedia] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [urlInput, setUrlInput] = React.useState(value)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const previewClass = cn(
    "relative overflow-hidden rounded-xl border bg-muted/30",
    aspect === "square" && "h-32 w-32",
    aspect === "wide" && "h-32 w-full",
    aspect === "logo" && "h-24 w-full"
  )

  const loadMedia = React.useCallback(async () => {
    setLoadingMedia(true)
    try {
      setMedia(await fetchMedia(undefined, search))
    } catch (error: any) {
      toast.error(error.message || "Không tải được thư viện ảnh")
    } finally {
      setLoadingMedia(false)
    }
  }, [search])

  React.useEffect(() => {
    if (open && activeTab === "library") loadMedia()
  }, [open, activeTab, loadMedia])

  React.useEffect(() => {
    setUrlInput(value)
  }, [value])

  async function handleUpload(file: File) {
    setUploading(true)
    try {
      const result = await uploadFile(file, bucket)
      onChange(result.url)
      setOpen(false)
      toast.success("Tải ảnh thành công")
    } catch (error: any) {
      toast.error(error.message || "Upload thất bại")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  function applyUrl() {
    onChange(urlInput.trim())
    setOpen(false)
  }

  return (
    <div className={cn("space-y-2", className)}>
      {label && <label className="text-sm font-medium leading-none">{label}</label>}
      <div className="flex gap-3">
        <Dialog open={open} onOpenChange={setOpen}>
          <button type="button" onClick={() => setOpen(true)} className={cn(previewClass, "group cursor-pointer transition hover:border-primary/50 hover:bg-primary/5")}> 
            {value ? (
              <>
                <img src={value} alt={label || "Image"} className="h-full w-full object-contain p-2" onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
                <div className="absolute inset-0 grid place-content-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="rounded-md bg-white px-3 py-1 text-xs font-semibold text-black">Thay ảnh</span>
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                <UploadIcon />
                <span className="text-xs font-medium">Chọn ảnh</span>
              </div>
            )}
          </button>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Chọn hình ảnh</DialogTitle>
              <DialogDescription>Upload ảnh mới, chọn từ thư viện hoặc dán URL ảnh có sẵn.</DialogDescription>
            </DialogHeader>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList>
                <TabsTrigger value="upload">Upload</TabsTrigger>
                <TabsTrigger value="library">Thư viện</TabsTrigger>
                <TabsTrigger value="url">URL</TabsTrigger>
              </TabsList>

              <TabsContent value="upload" className="space-y-4">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex h-52 w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed bg-muted/30 transition hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50"
                >
                  {uploading ? <IconLoader size={28} className="animate-spin" /> : <UploadIcon size={32} />}
                  <div className="text-center">
                    <p className="text-sm font-semibold">Bấm để tải ảnh lên</p>
                    <p className="text-xs text-muted-foreground">JPG, PNG, WEBP, GIF</p>
                  </div>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleUpload(file)
                  }}
                />
              </TabsContent>

              <TabsContent value="library" className="space-y-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo tên file hoặc đường dẫn..." />
                  </div>
                  <Button type="button" variant="outline" onClick={loadMedia} disabled={loadingMedia}>
                    {loadingMedia ? <IconLoader size={16} className="animate-spin" /> : "Tải lại"}
                  </Button>
                </div>

                <div className="grid max-h-[420px] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 md:grid-cols-4">
                  {media.map((item) => (
                    <button
                      key={item.url}
                      type="button"
                      onClick={() => { onChange(item.url); setOpen(false) }}
                      className="group overflow-hidden rounded-xl border bg-card text-left transition hover:border-primary/60 hover:shadow-sm"
                    >
                      <div className="h-28 bg-muted">
                        <img src={item.url} alt={item.name} className="h-full w-full object-cover" />
                      </div>
                      <div className="space-y-0.5 p-2">
                        <p className="truncate text-xs font-medium">{item.name}</p>
                        <p className="text-[10px] text-muted-foreground">{item.bucket} · {formatBytes(item.size)}</p>
                      </div>
                    </button>
                  ))}
                  {!loadingMedia && media.length === 0 && (
                    <div className="col-span-full rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                      Chưa có ảnh trong thư viện.
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="url" className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">URL hình ảnh</label>
                  <Input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://example.com/image.png" />
                </div>
                {urlInput && (
                  <div className="h-48 rounded-xl border bg-muted/30 p-2">
                    <img src={urlInput} alt="URL preview" className="h-full w-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
                  </div>
                )}
                <div className="flex justify-end">
                  <Button type="button" onClick={applyUrl}>Áp dụng URL</Button>
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>

        {value && (
          <Button type="button" variant="outline" size="sm" onClick={() => onChange("")} className="shrink-0 gap-2">
            <IconTrash size={14} />
            Xóa
          </Button>
        )}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function UploadIcon({ size = 24 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" x2="12" y1="3" y2="15" />
    </svg>
  )
}
