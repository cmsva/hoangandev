"use client"

import { useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/client"
import { CKEditor } from "@/components/admin/ckeditor"
import { SelectCustom } from "@/components/ui/select-custom"
import { toast } from "@/components/ui/toast"

export interface StaticPageFormData {
  slug: string
  title: string
  description: string
  keywords: string[]
  content: string
  requireLogin: boolean
  status: number
}

const EMPTY_STATIC_PAGE: StaticPageFormData = {
  slug: "", title: "", description: "", keywords: [], content: "", requireLogin: false, status: 1,
}

export function newStaticPageFormData(): StaticPageFormData {
  return { ...EMPTY_STATIC_PAGE, keywords: [] }
}

export function StaticPageForm({ pageId, initialData }: {
  pageId: string | null
  initialData?: StaticPageFormData
}) {
  const trpc = useTRPC()
  const router = useRouter()
  const qc = useQueryClient()
  const [data, setData] = useState<StaticPageFormData>(initialData ?? EMPTY_STATIC_PAGE)
  const [keywordInput, setKeywordInput] = useState("")
  const isEdit = !!pageId

  const createMut = useMutation({
    ...trpc.adminStaticPage.create.mutationOptions(),
    onSuccess: () => {
      toast.success("Tạo trang thành công")
      qc.invalidateQueries({ queryKey: trpc.adminStaticPage.list.queryKey() })
      router.push("/adminPanel/static-pages")
    },
    onError: (err: any) => toast.error(err.message || "Tạo thất bại"),
  })
  const updateMut = useMutation({
    ...trpc.adminStaticPage.update.mutationOptions(),
    onSuccess: () => {
      toast.success("Cập nhật trang thành công")
      qc.invalidateQueries({ queryKey: trpc.adminStaticPage.list.queryKey() })
      router.push("/adminPanel/static-pages")
    },
    onError: (err: any) => toast.error(err.message || "Cập nhật thất bại"),
  })
  const isPending = createMut.isPending || updateMut.isPending

  function set<K extends keyof StaticPageFormData>(key: K, value: StaticPageFormData[K]) {
    setData((current) => ({ ...current, [key]: value }))
  }

  function addKeyword() {
    const value = keywordInput.trim().replace(/^#/, "")
    if (!value || data.keywords.includes(value)) { setKeywordInput(""); return }
    set("keywords", [...data.keywords, value])
    setKeywordInput("")
  }

  function removeKeyword(value: string) {
    set("keywords", data.keywords.filter((item) => item !== value))
  }

  function handleSubmit() {
    if (!data.title.trim()) return toast.error("Vui lòng nhập tiêu đề")
    if (!data.content.trim()) return toast.error("Vui lòng nhập nội dung")

    const payload = {
      slug: data.slug.trim() || undefined,
      title: data.title.trim(),
      description: data.description.trim() || null,
      keywords: data.keywords,
      content: data.content,
      requireLogin: data.requireLogin,
      status: data.status,
    }
    if (isEdit) updateMut.mutate({ id: pageId, data: payload })
    else createMut.mutate(payload)
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
          <h2 className="text-base font-bold">Thông tin trang</h2>
          <Field label="Tiêu đề" required>
            <input value={data.title} onChange={(event) => set("title", event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]" placeholder="VD: Điều khoản sử dụng" />
          </Field>
          <Field label="Slug (đường dẫn)">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">/</span>
              <input value={data.slug} onChange={(event) => set("slug", event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm font-mono outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]" placeholder="dieu-khoan (tự tạo từ tiêu đề nếu để trống)" />
            </div>
          </Field>
          <Field label="Mô tả (SEO description)">
            <textarea value={data.description} onChange={(event) => set("description", event.target.value)} rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]" placeholder="Mô tả ngắn hiển thị ở kết quả tìm kiếm..." />
          </Field>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
          <div>
            <h2 className="text-base font-bold">Nội dung trang</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">CKEditor — hỗ trợ HTML đầy đủ.</p>
          </div>
          <CKEditor value={data.content} onChange={(html) => set("content", html)} height={460} placeholder="Nhập nội dung trang..." />
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
          <h2 className="text-base font-bold">Xuất bản</h2>
          <Field label="Trạng thái">
            <SelectCustom value={String(data.status)} onValueChange={(value) => set("status", Number(value))} options={[{ value: "1", label: "Hiển thị" }, { value: "0", label: "Ẩn" }]} />
          </Field>
          <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
            <input type="checkbox" checked={data.requireLogin} onChange={(event) => set("requireLogin", event.target.checked)} className="size-4" />
            Yêu cầu đăng nhập để xem
          </label>
          <button onClick={handleSubmit} disabled={isPending} className="h-10 w-full rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50">
            {isPending ? "Đang lưu..." : isEdit ? "Cập nhật" : "Tạo trang"}
          </button>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
          <h2 className="text-base font-bold">Từ khóa SEO</h2>
          <Field label="Keywords">
            <div className="flex gap-2">
              <input value={keywordInput} onChange={(event) => setKeywordInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addKeyword() } }} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]" placeholder="Nhập từ khóa" />
              <button type="button" onClick={addKeyword} className="rounded-md border px-3 text-sm font-medium hover:bg-accent">Thêm</button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {data.keywords.map((keyword) => (
                <button key={keyword} type="button" onClick={() => removeKeyword(keyword)} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">#{keyword} x</button>
              ))}
            </div>
          </Field>
        </div>
      </div>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
    </div>
  )
}
