"use client"

import { useRef, useState } from "react"
import { toast } from "@/components/ui/toast"

interface UploadResult {
  url: string
  name: string
  size: number
}

async function uploadFile(file: File, bucket: string): Promise<UploadResult> {
  const fd = new FormData()
  fd.append("file", file)
  fd.append("bucket", bucket)

  const res = await fetch("/api/admin/upload", {
    method: "POST",
    body: fd,
    credentials: "include",
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || "Upload thất bại")
  }
  return await res.json()
}

// ─── Single image uploader (thumbnail) ──────────────────────────────────────

interface ImageUploaderProps {
  value: string | null
  onChange: (url: string | null) => void
  bucket: string
  label?: string
  hint?: string
}

export function ImageUploader({ value, onChange, bucket, label = "Ảnh bìa", hint }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const result = await uploadFile(file, bucket)
      onChange(result.url)
      toast.success("Tải ảnh thành công")
    } catch (err: any) {
      toast.error(err.message || "Tải ảnh thất bại")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className="space-y-2">
      {label && <label className="text-sm font-medium">{label}</label>}
      <div className="flex items-start gap-3">
        {value ? (
          <div className="relative group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt={label}
              className="h-32 w-32 rounded-lg border object-cover bg-muted"
            />
            <div className="absolute inset-0 flex items-center justify-center gap-1.5 rounded-lg bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="rounded-md bg-white/95 px-2.5 py-1 text-[11px] font-bold text-foreground hover:bg-white"
              >
                Thay
              </button>
              <button
                type="button"
                onClick={() => onChange(null)}
                disabled={uploading}
                className="rounded-md bg-rose-500 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-rose-600"
              >
                Xóa
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex h-32 w-32 flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed bg-muted/30 hover:border-primary/40 hover:bg-primary/5 transition-all disabled:opacity-50"
          >
            {uploading ? (
              <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
            ) : (
              <>
                <UploadIcon />
                <span className="text-[11px] font-medium text-muted-foreground">Chọn ảnh</span>
              </>
            )}
          </button>
        )}
        {hint && <p className="text-[11px] text-muted-foreground flex-1 pt-1 leading-relaxed">{hint}</p>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  )
}

// ─── Multi image uploader (gallery) ─────────────────────────────────────────

interface ImagesUploaderProps {
  value: string[]
  onChange: (urls: string[]) => void
  bucket: string
  label?: string
  hint?: string
  max?: number
}

export function ImagesUploader({
  value,
  onChange,
  bucket,
  label = "Ảnh phụ",
  hint,
  max = 10,
}: ImagesUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    if (value.length + files.length > max) {
      toast.error(`Tối đa ${max} ảnh`)
      return
    }
    setUploading(true)
    try {
      const results = await Promise.all(files.map((f) => uploadFile(f, bucket)))
      onChange([...value, ...results.map((r) => r.url)])
      toast.success(`Đã tải ${results.length} ảnh`)
    } catch (err: any) {
      toast.error(err.message || "Tải ảnh thất bại")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">{label}</label>
          <span className="text-[11px] text-muted-foreground">
            {value.length}/{max}
          </span>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        {value.map((url, idx) => (
          <div key={idx} className="relative group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`Ảnh ${idx + 1}`}
              className="h-24 w-24 rounded-lg border object-cover bg-muted"
            />
            <button
              type="button"
              onClick={() => remove(idx)}
              className="absolute -right-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full bg-rose-500 text-white shadow opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-600"
              title="Xóa ảnh"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
        {value.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed bg-muted/30 hover:border-primary/40 hover:bg-primary/5 transition-all disabled:opacity-50"
          >
            {uploading ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
            ) : (
              <>
                <UploadIcon size={20} />
                <span className="text-[10px] font-medium text-muted-foreground">Thêm ảnh</span>
              </>
            )}
          </button>
        )}
      </div>
      {hint && <p className="text-[11px] text-muted-foreground leading-relaxed">{hint}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFiles}
      />
    </div>
  )
}

function UploadIcon({ size = 24 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-muted-foreground"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" x2="12" y1="3" y2="15" />
    </svg>
  )
}
