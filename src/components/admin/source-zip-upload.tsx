"use client"

/**
 * SourceZipUpload — ô nhập URL ZIP + nút upload file thẳng lên storage.
 *
 * Admin có thể: (1) dán link trực tiếp, hoặc (2) bấm "Upload ZIP" chọn file .zip
 * → đẩy lên `/api/admin/upload-source` (lưu qua storage chung với ảnh: local/S3/R2)
 * → URL trả về tự điền vào ô. Dùng XHR để hiện tiến độ upload (file tới 200MB).
 */
import { useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"

const MAX_MB = 200

interface SourceZipUploadProps {
  value: string
  onChange: (url: string) => void
  placeholder?: string
  disabled?: boolean
}

export function SourceZipUpload({
  value,
  onChange,
  placeholder = "https://.../source.zip",
  disabled,
}: SourceZipUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  function pickFile(): void {
    inputRef.current?.click()
  }

  function handleFile(event: React.ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0]
    event.target.value = "" // reset để chọn lại cùng file vẫn trigger
    if (!file) return

    if (!file.name.toLowerCase().endsWith(".zip")) {
      toast.error("Chỉ chấp nhận file .zip")
      return
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`File quá lớn (tối đa ${MAX_MB}MB)`)
      return
    }

    const formData = new FormData()
    formData.set("file", file)

    const xhr = new XMLHttpRequest()
    xhr.open("POST", "/api/admin/upload-source")
    xhr.withCredentials = true

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      setUploading(false)
      setProgress(0)
      try {
        const res = JSON.parse(xhr.responseText)
        if (xhr.status >= 200 && xhr.status < 300 && res.url) {
          onChange(res.url)
          toast.success("Đã upload source ZIP")
        } else {
          toast.error(res.error || "Upload thất bại")
        }
      } catch {
        toast.error("Upload thất bại")
      }
    }
    xhr.onerror = () => {
      setUploading(false)
      setProgress(0)
      toast.error("Lỗi kết nối khi upload")
    }

    setUploading(true)
    setProgress(0)
    xhr.send(formData)
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="font-mono"
          placeholder={placeholder}
          disabled={disabled || uploading}
        />
        <Button
          type="button"
          variant="outline"
          onClick={pickFile}
          disabled={disabled || uploading}
          className="shrink-0"
        >
          {uploading ? `Đang tải ${progress}%` : "Upload ZIP"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          onChange={handleFile}
        />
      </div>
      {uploading && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  )
}
