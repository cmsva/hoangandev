"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/client"
import { SelectCustom } from "@/components/ui/select-custom"
import { ImageUploader, ImagesUploader } from "@/components/admin/image-uploader"
import { CKEditor } from "@/components/admin/ckeditor"
import { toast } from "@/components/ui/toast"
import { GenerateAiButton } from "@/components/admin/generate-ai-button"

export interface ProductFormData {
  title: string
  slug: string
  description: string
  detail: string
  price: number
  salePrice: number | null
  discountPercentage: number | null
  categoryId: string
  thumbnail: string | null
  images: string[]
  fileUrl: string
  status: number
  isFree: boolean
  approved: boolean
  tags: string[]
}

interface ProductFormProps {
  /** Editing → product id; null → create */
  productId: string | null
  initialData: ProductFormData
  categories: Array<{ id: string; name: string }>
}

const EMPTY_DATA: ProductFormData = {
  title: "",
  slug: "",
  description: "",
  detail: "",
  price: 0,
  salePrice: null,
  discountPercentage: null,
  categoryId: "",
  thumbnail: null,
  images: [],
  fileUrl: "",
  status: 1,
  isFree: false,
  approved: true,
  tags: [],
}

export function newProductFormData(): ProductFormData {
  return { ...EMPTY_DATA }
}

export function ProductForm({ productId, initialData, categories }: ProductFormProps) {
  const trpc = useTRPC()
  const router = useRouter()
  const qc = useQueryClient()
  const isEdit = !!productId

  const [data, setData] = useState<ProductFormData>(initialData)
  const [tagInput, setTagInput] = useState("")

  const createMut = useMutation({
    ...trpc.adminProduct.createProduct.mutationOptions(),
    onSuccess: () => {
      toast.success("Tạo mã nguồn thành công")
      qc.invalidateQueries({ queryKey: trpc.adminProduct.listProducts.queryKey() })
      router.push("/adminPanel/source-code/products")
    },
    onError: (err: any) => toast.error(err.message || "Tạo thất bại"),
  })

  const updateMut = useMutation({
    ...trpc.adminProduct.updateProduct.mutationOptions(),
    onSuccess: () => {
      toast.success("Cập nhật thành công")
      qc.invalidateQueries({ queryKey: trpc.adminProduct.listProducts.queryKey() })
      router.push("/adminPanel/source-code/products")
    },
    onError: (err: any) => toast.error(err.message || "Cập nhật thất bại"),
  })

  const isPending = createMut.isPending || updateMut.isPending

  function set<K extends keyof ProductFormData>(key: K, value: ProductFormData[K]) {
    setData((d) => ({ ...d, [key]: value }))
  }

  function addTag() {
    const t = tagInput.trim().replace(/^#/, "")
    if (!t) return
    if (data.tags.includes(t)) {
      setTagInput("")
      return
    }
    set("tags", [...data.tags, t])
    setTagInput("")
  }

  function removeTag(t: string) {
    set("tags", data.tags.filter((x) => x !== t))
  }

  function handleSubmit() {
    if (!data.title.trim()) {
      toast.error("Vui lòng nhập tên mã nguồn")
      return
    }
    if (!data.categoryId) {
      toast.error("Vui lòng chọn danh mục")
      return
    }
    if (!data.fileUrl.trim()) {
      toast.error("Vui lòng nhập link tải file")
      return
    }
    if (data.salePrice !== null && data.salePrice >= data.price) {
      toast.error("Giá khuyến mãi phải nhỏ hơn giá gốc")
      return
    }

    const payload = {
      title: data.title.trim(),
      slug: data.slug.trim() || undefined,
      description: data.description || null,
      detail: data.detail || null,
      price: Number(data.price) || 0,
      salePrice: data.salePrice !== null ? Number(data.salePrice) : null,
      discountPercentage:
        data.discountPercentage !== null ? Number(data.discountPercentage) : null,
      categoryId: data.categoryId,
      thumbnail: data.thumbnail,
      images: data.images,
      fileUrl: data.fileUrl.trim(),
      status: data.status,
      isFree: data.isFree,
      approved: data.approved,
      tags: data.tags,
    }

    if (isEdit) {
      updateMut.mutate({ id: productId!, data: payload })
    } else {
      createMut.mutate(payload)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ─── Left: main fields ─── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card: Thông tin chính */}
          <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
            <h2 className="text-base font-bold">Thông tin chính</h2>

            <Field label="Tên mã nguồn" required>
              <input
                type="text"
                value={data.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="VD: Source code bán hàng MMO Store"
                className={inputCls}
              />
            </Field>

            <Field label="Slug" hint="URL-friendly. Để trống sẽ tự sinh từ tên.">
              <input
                type="text"
                value={data.slug}
                onChange={(e) => set("slug", e.target.value)}
                placeholder="auto-from-title"
                className={`${inputCls} font-mono`}
              />
            </Field>

            <Field
              label="Mô tả ngắn (tính năng)"
              hint="Mỗi dòng = 1 dấu tích trong sidebar trang sản phẩm. VD: 'Hỗ trợ setup hoàn chỉnh'."
            >
              <textarea
                rows={5}
                value={data.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder={"Hỗ trợ setup hoàn chỉnh\nTài liệu hướng dẫn chi tiết\nBản quyền vĩnh viễn"}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              />
            </Field>
          </div>

          {/* Card: Mô tả chi tiết (CKEditor) */}
          <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold">Mô tả chi tiết (HTML)</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Hiển thị ở khối chính trang sản phẩm. Hỗ trợ ảnh, bảng, link, format đầy đủ.
                </p>
              </div>
              <GenerateAiButton
                kind="rich_description"
                onApply={(html) => set("detail", html)}
                related={[
                  { label: "Loại", value: "Mã nguồn / source code" },
                  { label: "Tên sản phẩm", value: data.title },
                  {
                    label: "Danh mục",
                    value: categories.find((c) => c.id === data.categoryId)?.name || "",
                  },
                  { label: "Mô tả ngắn", value: data.description.slice(0, 300) },
                  { label: "Tags / Tech", value: data.tags.join(", ") },
                ]}
                hintPlaceholder={`VD: Mô tả mã nguồn "${data.title || "..."}" — nêu tính năng, yêu cầu hệ thống (PHP/Node/MySQL), demo, phù hợp với ai`}
                size="sm"
                label="Generated by AI"
              />
            </div>
            <CKEditor
              value={data.detail}
              onChange={(html) => set("detail", html)}
              height={400}
              placeholder="Nhập mô tả chi tiết..."
            />
          </div>

          {/* Card: Hình ảnh */}
          <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
            <h2 className="text-base font-bold">Hình ảnh</h2>
            <ImageUploader
              value={data.thumbnail}
              onChange={(url) => set("thumbnail", url)}
              bucket="products"
              label="Ảnh bìa (thumbnail)"
              hint="Hiện ở list, card và detail. Tỉ lệ 16:10 / 4:3 đẹp nhất."
            />
            <ImagesUploader
              value={data.images}
              onChange={(urls) => set("images", urls)}
              bucket="products"
              label="Gallery ảnh phụ"
              hint="Hiện ở thanh thumbnail dưới ảnh bìa, click để chuyển. Tối đa 10 ảnh."
              max={10}
            />
          </div>

          {/* Card: File tải */}
          <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
            <h2 className="text-base font-bold">File tải về</h2>
            <Field
              label="Link tải mã nguồn"
              required
              hint="Drive / Mega / Dropbox... User chỉ thấy link sau khi mua thành công."
            >
              <input
                type="url"
                value={data.fileUrl}
                onChange={(e) => set("fileUrl", e.target.value)}
                placeholder="https://drive.google.com/..."
                className={`${inputCls} font-mono`}
              />
            </Field>
          </div>
        </div>

        {/* ─── Right: meta / pricing / tags ─── */}
        <div className="space-y-6">
          {/* Pricing */}
          <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
            <h2 className="text-base font-bold">Giá bán</h2>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={data.isFree}
                onChange={(e) => set("isFree", e.target.checked)}
                className="size-4 rounded border-input"
              />
              <span className="font-medium">Miễn phí</span>
            </label>

            <Field label="Giá gốc (VND)" required>
              <input
                type="number"
                min={0}
                value={data.price}
                onChange={(e) => set("price", Number(e.target.value) || 0)}
                disabled={data.isFree}
                className={`${inputCls} tabular-nums`}
              />
            </Field>

            <Field
              label="Giá khuyến mãi (VND)"
              hint="Để trống nếu không sale. Phải nhỏ hơn giá gốc."
            >
              <input
                type="number"
                min={0}
                value={data.salePrice ?? ""}
                onChange={(e) =>
                  set("salePrice", e.target.value === "" ? null : Number(e.target.value))
                }
                disabled={data.isFree}
                className={`${inputCls} tabular-nums`}
              />
            </Field>

            <Field label="% giảm hiển thị" hint="Tự động tính nếu để trống.">
              <input
                type="number"
                min={0}
                max={100}
                value={data.discountPercentage ?? ""}
                onChange={(e) =>
                  set(
                    "discountPercentage",
                    e.target.value === "" ? null : Number(e.target.value)
                  )
                }
                disabled={data.isFree}
                className={`${inputCls} tabular-nums`}
              />
            </Field>
          </div>

          {/* Meta */}
          <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
            <h2 className="text-base font-bold">Phân loại & trạng thái</h2>

            <Field label="Danh mục" required>
              <SelectCustom
                value={data.categoryId}
                onValueChange={(v) => set("categoryId", v)}
                placeholder="Chọn danh mục..."
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
              />
            </Field>

            <Field label="Trạng thái">
              <SelectCustom
                value={String(data.status)}
                onValueChange={(v) => set("status", Number(v))}
                options={[
                  { value: "1", label: "Hiển thị" },
                  { value: "0", label: "Ẩn" },
                ]}
              />
            </Field>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={data.approved}
                onChange={(e) => set("approved", e.target.checked)}
                className="size-4 rounded border-input"
              />
              <span className="font-medium">Đã duyệt (cho phép bán)</span>
            </label>
          </div>

          {/* Tags */}
          <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
            <h2 className="text-base font-bold">Tags / Công nghệ</h2>
            <p className="text-xs text-muted-foreground">
              Hiển thị ở sidebar trang sản phẩm. Enter để thêm.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addTag()
                  }
                }}
                placeholder="VD: PHP, React, Laravel..."
                className={`${inputCls} flex-1`}
              />
              <button
                type="button"
                onClick={addTag}
                className="rounded-md bg-primary/10 text-primary px-3 text-xs font-bold hover:bg-primary/20 transition-colors"
              >
                + Thêm
              </button>
            </div>
            {data.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {data.tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium"
                  >
                    #{t}
                    <button
                      type="button"
                      onClick={() => removeTag(t)}
                      className="size-4 flex items-center justify-center rounded-full hover:bg-rose-500/20 hover:text-rose-600 transition-colors"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-end gap-2 sticky bottom-0 -mx-4 sm:mx-0 px-4 sm:px-0 py-3 bg-background/80 backdrop-blur border-t">
        <button
          type="button"
          onClick={() => router.push("/adminPanel/source-code/products")}
          disabled={isPending}
          className="rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50 transition-colors"
        >
          Hủy
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-5 py-2 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isPending ? (
            <>
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Đang lưu...
            </>
          ) : isEdit ? (
            "Cập nhật"
          ) : (
            "Tạo mã nguồn"
          )}
        </button>
      </div>
    </div>
  )
}

const inputCls =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:opacity-50 disabled:cursor-not-allowed"

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium block">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground leading-relaxed">{hint}</p>}
    </div>
  )
}
