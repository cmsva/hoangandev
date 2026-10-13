"use client"

import { useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/client"
import { CKEditor } from "@/components/admin/ckeditor"
import { ImageUploader } from "@/components/admin/image-uploader"
import { SelectCustom } from "@/components/ui/select-custom"
import { toast } from "@/components/ui/toast"

export interface PostFormData {
  title: string
  slug: string
  excerpt: string
  content: string
  thumbnail: string | null
  categoryId: string
  status: number
  featured: boolean
  metaTitle: string
  metaDescription: string
  metaKeywords: string[]
}

const EMPTY_DATA: PostFormData = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  thumbnail: null,
  categoryId: "",
  status: 1,
  featured: false,
  metaTitle: "",
  metaDescription: "",
  metaKeywords: [],
}

export function newPostFormData(): PostFormData {
  return { ...EMPTY_DATA, metaKeywords: [] }
}

export function PostForm({ postId, initialData, categories }: {
  postId: string | null
  initialData: PostFormData
  categories: Array<{ id: string; name: string }>
}) {
  const trpc = useTRPC()
  const router = useRouter()
  const qc = useQueryClient()
  const [data, setData] = useState<PostFormData>(initialData)
  const [keywordInput, setKeywordInput] = useState("")
  const isEdit = !!postId

  const createMut = useMutation({
    ...trpc.adminPost.createPost.mutationOptions(),
    onSuccess: () => {
      toast.success("Tạo bài viết thành công")
      qc.invalidateQueries({ queryKey: trpc.adminPost.listPosts.queryKey() })
      router.push("/adminPanel/posts")
    },
    onError: (err: any) => toast.error(err.message || "Tạo thất bại"),
  })

  const updateMut = useMutation({
    ...trpc.adminPost.updatePost.mutationOptions(),
    onSuccess: () => {
      toast.success("Cập nhật bài viết thành công")
      qc.invalidateQueries({ queryKey: trpc.adminPost.listPosts.queryKey() })
      router.push("/adminPanel/posts")
    },
    onError: (err: any) => toast.error(err.message || "Cập nhật thất bại"),
  })
  const isPending = createMut.isPending || updateMut.isPending

  function set<K extends keyof PostFormData>(key: K, value: PostFormData[K]) {
    setData((current) => ({ ...current, [key]: value }))
  }

  function addKeyword() {
    const value = keywordInput.trim().replace(/^#/, "")
    if (!value || data.metaKeywords.includes(value)) {
      setKeywordInput("")
      return
    }
    set("metaKeywords", [...data.metaKeywords, value])
    setKeywordInput("")
  }

  function removeKeyword(value: string) {
    set("metaKeywords", data.metaKeywords.filter((item) => item !== value))
  }

  function handleSubmit() {
    if (!data.title.trim()) return toast.error("Vui lòng nhập tiêu đề")
    if (!data.categoryId) return toast.error("Vui lòng chọn chuyên mục")
    if (!data.content.trim()) return toast.error("Vui lòng nhập nội dung")

    const payload = {
      title: data.title.trim(),
      slug: data.slug.trim() || undefined,
      excerpt: data.excerpt.trim() || null,
      content: data.content,
      thumbnail: data.thumbnail,
      categoryId: data.categoryId,
      status: data.status,
      featured: data.featured,
      metaTitle: data.metaTitle.trim() || null,
      metaDescription: data.metaDescription.trim() || null,
      metaKeywords: data.metaKeywords,
    }

    if (isEdit) updateMut.mutate({ id: postId, data: payload })
    else createMut.mutate(payload)
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
          <h2 className="text-base font-bold">Thông tin bài viết</h2>
          <Field label="Tiêu đề" required>
            <input value={data.title} onChange={(event) => set("title", event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]" placeholder="VD: Hướng dẫn chọn mã nguồn phù hợp" />
          </Field>
          <Field label="Slug">
            <input value={data.slug} onChange={(event) => set("slug", event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm font-mono outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]" placeholder="tu-dong-tao-tu-tieu-de" />
          </Field>
          <Field label="Mô tả ngắn">
            <textarea value={data.excerpt} onChange={(event) => set("excerpt", event.target.value)} rows={4} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]" placeholder="Tóm tắt hiển thị ở danh sách bài viết..." />
          </Field>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
          <div>
            <h2 className="text-base font-bold">Nội dung bài viết</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">CKEditor CDN giống trang thêm mã nguồn, hỗ trợ HTML đầy đủ.</p>
          </div>
          <CKEditor value={data.content} onChange={(html) => set("content", html)} height={460} placeholder="Nhập nội dung bài viết..." />
        </div>
      </div>
      <div className="space-y-6">
        <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
          <h2 className="text-base font-bold">Xuất bản</h2>
          <Field label="Chuyên mục" required>
            <SelectCustom value={data.categoryId} onValueChange={(value) => set("categoryId", value)} options={categories.map((category) => ({ value: category.id, label: category.name }))} />
          </Field>
          <Field label="Trạng thái">
            <SelectCustom value={String(data.status)} onValueChange={(value) => set("status", Number(value))} options={[{ value: "1", label: "Hiển thị" }, { value: "0", label: "Ẩn" }]} />
          </Field>
          <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
            <input type="checkbox" checked={data.featured} onChange={(event) => set("featured", event.target.checked)} className="size-4" />
            Ghim bài nổi bật
          </label>
          <button onClick={handleSubmit} disabled={isPending} className="h-10 w-full rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50">
            {isPending ? "Đang lưu..." : isEdit ? "Cập nhật" : "Tạo bài viết"}
          </button>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
          <h2 className="text-base font-bold">Ảnh đại diện</h2>
          <ImageUploader value={data.thumbnail} onChange={(value) => set("thumbnail", value)} bucket="posts" />
        </div>


        <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
          <h2 className="text-base font-bold">SEO từng bài</h2>
          <Field label="Meta title">
            <input value={data.metaTitle} onChange={(event) => set("metaTitle", event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]" placeholder="Tiêu đề SEO" />
          </Field>
          <Field label="Meta description">
            <textarea value={data.metaDescription} onChange={(event) => set("metaDescription", event.target.value)} rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]" placeholder="Mô tả SEO..." />
          </Field>
          <Field label="Từ khóa">
            <div className="flex gap-2">
              <input value={keywordInput} onChange={(event) => setKeywordInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addKeyword() } }} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]" placeholder="Nhập từ khóa" />
              <button type="button" onClick={addKeyword} className="rounded-md border px-3 text-sm font-medium hover:bg-accent">Thêm</button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {data.metaKeywords.map((keyword) => (
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
