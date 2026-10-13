"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/client"
import { CKEditor } from "@/components/admin/ckeditor"
import { ImageUploader, ImagesUploader } from "@/components/admin/image-uploader"
import { SelectCustom } from "@/components/ui/select-custom"
import { toast } from "@/components/ui/toast"

export interface WebsitePricingFormData {
  durationMonths: number
  pricePerMonth: number
  priceExtendPerMonth: number
}

export interface WebsiteTemplateFormData {
  serviceName: string
  slug: string
  categoryId: string
  image: string | null
  listImage: string[]
  description: string
  demoUrl: string
  adminDemoUrl: string
  featuresList: string[]
  sourceZipUrl: string
  configFilePaths: string[]
  sqlFilePaths: string[]
  deployMode: "manual" | "auto"
  deployServerId: string
  deployCodeId: string
  deployPhpVersion: string
  deployDefaultAccount: string
  deployDefaultPassword: string
  status: number
  stt: number
  pricings: WebsitePricingFormData[]
}

const EMPTY_DATA: WebsiteTemplateFormData = {
  serviceName: "",
  slug: "",
  categoryId: "",
  image: null,
  listImage: [],
  description: "",
  demoUrl: "",
  adminDemoUrl: "",
  featuresList: [],
  sourceZipUrl: "",
  configFilePaths: [".env", "config.php", "cmstdev.php"],
  sqlFilePaths: [],
  deployMode: "manual",
  deployServerId: "",
  deployCodeId: "",
  deployPhpVersion: "80",
  deployDefaultAccount: "admin",
  deployDefaultPassword: "",
  status: 1,
  stt: 0,
  pricings: [{ durationMonths: 1, pricePerMonth: 0, priceExtendPerMonth: 0 }],
}

export function newWebsiteTemplateFormData(): WebsiteTemplateFormData {
  return { ...EMPTY_DATA, pricings: [...EMPTY_DATA.pricings] }
}

interface Props {
  templateId: string | null
  initialData: WebsiteTemplateFormData
  categories: Array<{ id: string; name: string }>
  deployCodes?: Array<{ id: string; name: string; status: number; phpVersions?: string[]; defaultPhpVersion?: string; configFilePath?: string; sqlFilePath?: string; codeUrl?: string }>
}

export function WebsiteTemplateForm({ templateId, initialData, categories, deployCodes = [] }: Props) {
  const trpc = useTRPC()
  const router = useRouter()
  const qc = useQueryClient()
  const isEdit = !!templateId
  const [data, setData] = useState(initialData)
  const [featureInput, setFeatureInput] = useState("")
  const selectedDeployCode = deployCodes.find((item) => item.id === data.deployCodeId)
  const selectedDeployPhpVersion = selectedDeployCode?.phpVersions?.[0] || selectedDeployCode?.defaultPhpVersion || "80"

  const createMut = useMutation({
    ...trpc.adminWebsite.createTemplate.mutationOptions(),
    onSuccess: () => {
      toast.success("Đã tạo mẫu website")
      qc.invalidateQueries({ queryKey: trpc.adminWebsite.listTemplates.queryKey() })
      router.push("/adminPanel/websites/templates")
    },
    onError: (err: any) => toast.error(err.message || "Tạo thất bại"),
  })
  const updateMut = useMutation({
    ...trpc.adminWebsite.updateTemplate.mutationOptions(),
    onSuccess: () => {
      toast.success("Đã cập nhật mẫu website")
      qc.invalidateQueries({ queryKey: trpc.adminWebsite.listTemplates.queryKey() })
      router.push("/adminPanel/websites/templates")
    },
    onError: (err: any) => toast.error(err.message || "Cập nhật thất bại"),
  })

  const isPending = createMut.isPending || updateMut.isPending

  function set<K extends keyof WebsiteTemplateFormData>(key: K, value: WebsiteTemplateFormData[K]) {
    setData((prev) => ({ ...prev, [key]: value }))
  }

  function addFeature() {
    const value = featureInput.trim()
    if (!value) return
    set("featuresList", [...data.featuresList, value])
    setFeatureInput("")
  }

  function updatePricing(index: number, key: keyof WebsitePricingFormData, value: number) {
    set("pricings", data.pricings.map((p, i) => i === index ? { ...p, [key]: value } : p))
  }

  function removePricing(index: number) {
    if (data.pricings.length <= 1) {
      toast.error("Cần ít nhất 1 thời hạn")
      return
    }
    set("pricings", data.pricings.filter((_, i) => i !== index))
  }

  function handleSubmit() {
    if (!data.serviceName.trim()) return toast.error("Vui lòng nhập tên mẫu")
    if (!data.categoryId) return toast.error("Vui lòng chọn danh mục")
    if (!data.deployCodeId) return toast.error("Vui lòng chọn code deploy")
    if (data.pricings.length === 0) return toast.error("Vui lòng nhập thời hạn")

    const payload = {
      serviceName: data.serviceName.trim(),
      slug: data.slug.trim() || undefined,
      categoryId: data.categoryId,
      image: data.image,
      listImage: data.listImage,
      description: data.description || null,
      demoUrl: data.demoUrl.trim() || null,
      adminDemoUrl: data.adminDemoUrl.trim() || null,
      featuresList: data.featuresList,
      sourceZipUrl: null,
      configFilePaths: [],
      sqlFilePaths: [],
      deployMode: "auto" as const,
      deployServerId: null,
      deployCodeId: data.deployCodeId,
      deployPhpVersion: selectedDeployPhpVersion,
      deployDefaultAccount: null,
      deployDefaultPassword: null,
      status: data.status,
      stt: data.stt,
      pricings: data.pricings.map((p) => ({
        durationMonths: Number(p.durationMonths) || 1,
        pricePerMonth: Number(p.pricePerMonth) || 0,
        priceExtendPerMonth: Number(p.priceExtendPerMonth) || 0,
      })),
    }

    if (isEdit) updateMut.mutate({ id: templateId, data: payload })
    else createMut.mutate(payload)
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="text-base font-bold">Thông tin chính</h2>
            <Field label="Tên mẫu website" required><input value={data.serviceName} onChange={(e) => set("serviceName", e.target.value)} className={inputCls} placeholder="VD: Website bán acc tự động" /></Field>
            <Field label="Slug"><input value={data.slug} onChange={(e) => set("slug", e.target.value)} className={`${inputCls} font-mono`} placeholder="Tự sinh nếu để trống" /></Field>
            <Field label="Danh mục" required><SelectCustom value={data.categoryId} onValueChange={(value) => set("categoryId", value)} options={categories.map((c) => ({ value: c.id, label: c.name }))} placeholder="Chọn danh mục" /></Field>
            <Field label="Demo URL"><input value={data.demoUrl} onChange={(e) => set("demoUrl", e.target.value)} className={inputCls} placeholder="https://demo.domain.com" /></Field>
            <Field label="Admin demo URL"><input value={data.adminDemoUrl} onChange={(e) => set("adminDemoUrl", e.target.value)} className={inputCls} placeholder="https://demo.domain.com/admin" /></Field>
          </section>

          <section className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
            <div><h2 className="text-base font-bold">Mô tả chi tiết</h2><p className="text-xs text-muted-foreground">CKEditor HTML hiển thị ở trang chi tiết mẫu website.</p></div>
            <CKEditor value={data.description} onChange={(html) => set("description", html)} height={420} placeholder="Nhập mô tả chi tiết..." />
          </section>

          <section className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="text-base font-bold">Hình ảnh</h2>
            <ImageUploader value={data.image} onChange={(url) => set("image", url)} bucket="websites" label="Thumbnail" hint="Ảnh đại diện hiển thị ở danh sách và detail." />
            <ImagesUploader value={data.listImage} onChange={(urls) => set("listImage", urls)} bucket="websites" label="Gallery ảnh mẫu" hint="Ảnh preview giao diện website." max={12} />
          </section>
        </div>

        <div className="space-y-6">
          <section className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
            <div><h2 className="text-base font-bold">Code deploy</h2><p className="text-xs text-muted-foreground">Chọn một mẫu code deploy, hệ thống tự lấy zip, config template, file config, SQL và PHP version từ đó.</p></div>
            <Field label="Code deploy" required><SelectCustom value={data.deployCodeId} onValueChange={(value) => { const code = deployCodes.find((item) => item.id === value); const nextPhp = code?.phpVersions?.[0] || code?.defaultPhpVersion || "80"; setData((prev) => ({ ...prev, deployMode: "auto", deployCodeId: value, deployPhpVersion: nextPhp })) }} options={deployCodes.filter((c) => c.status === 1).map((c) => ({ value: c.id, label: c.name }))} placeholder="Chọn code deploy" /></Field>
            {selectedDeployCode && <div className="space-y-1.5 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground"><p><span className="font-semibold text-foreground">PHP:</span> {selectedDeployPhpVersion}</p><p><span className="font-semibold text-foreground">Zip:</span> <span className="break-all font-mono">{selectedDeployCode.codeUrl || "-"}</span></p><p><span className="font-semibold text-foreground">Config:</span> <span className="font-mono">{selectedDeployCode.configFilePath || "-"}</span></p><p><span className="font-semibold text-foreground">SQL:</span> <span className="font-mono">{selectedDeployCode.sqlFilePath || "Không có"}</span></p></div>}
          </section>

          <section className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between"><h2 className="text-base font-bold">Thời hạn & giá</h2><button type="button" onClick={() => set("pricings", [...data.pricings, { durationMonths: 1, pricePerMonth: 0, priceExtendPerMonth: 0 }])} className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">+ Thêm</button></div>
            <div className="space-y-3">{data.pricings.map((p, index) => <div key={index} className="rounded-lg border p-3 space-y-2"><div className="flex items-center justify-between"><span className="text-sm font-semibold">Gói #{index + 1}</span><button type="button" onClick={() => removePricing(index)} className="text-xs font-medium text-rose-600">Xóa</button></div><div className="grid grid-cols-3 gap-2"><MiniField label="Tháng" value={p.durationMonths} onChange={(value) => updatePricing(index, "durationMonths", value)} /><MiniField label="Giá/tháng" value={p.pricePerMonth} onChange={(value) => updatePricing(index, "pricePerMonth", value)} /><MiniField label="Gia hạn/tháng" value={p.priceExtendPerMonth} onChange={(value) => updatePricing(index, "priceExtendPerMonth", value)} /></div></div>)}</div>
          </section>

          <section className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="text-base font-bold">Tính năng nổi bật</h2>
            <div className="flex gap-2"><input value={featureInput} onChange={(e) => setFeatureInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addFeature() } }} className={`${inputCls} flex-1`} placeholder="VD: Auto thanh toán" /><button type="button" onClick={addFeature} className="rounded-md bg-primary/10 px-3 text-xs font-bold text-primary">Thêm</button></div>
            <div className="flex flex-wrap gap-1.5">{data.featuresList.map((feature, index) => <button type="button" key={`${feature}-${index}`} onClick={() => set("featuresList", data.featuresList.filter((_, i) => i !== index))} className="rounded-md bg-muted px-2 py-1 text-xs font-medium">{feature} x</button>)}</div>
          </section>

          <section className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="text-base font-bold">Trạng thái</h2>
            <Field label="Trạng thái"><SelectCustom value={String(data.status)} onValueChange={(value) => set("status", Number(value))} options={[{ value: "1", label: "Hiển thị" }, { value: "0", label: "Ẩn" }]} /></Field>
            <Field label="Thứ tự"><input type="number" value={data.stt} onChange={(e) => set("stt", Number(e.target.value) || 0)} className={inputCls} /></Field>
          </section>
        </div>
      </div>

      <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-2 border-t bg-background/80 px-4 py-3 backdrop-blur sm:mx-0 sm:px-0">
        <button type="button" onClick={() => router.push("/adminPanel/websites/templates")} disabled={isPending} className="rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50">Hủy</button>
        <button type="button" onClick={handleSubmit} disabled={isPending} className="rounded-md bg-primary px-5 py-2 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50">{isPending ? "Đang lưu..." : isEdit ? "Cập nhật" : "Tạo mẫu"}</button>
      </div>
    </div>
  )
}

const inputCls = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:opacity-50"

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return <div className="space-y-1.5"><label className="block text-sm font-medium">{label}{required && <span className="ml-0.5 text-rose-500">*</span>}</label>{children}{hint && <p className="text-[11px] leading-relaxed text-muted-foreground">{hint}</p>}</div>
}

function MiniField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="space-y-1"><span className="text-[11px] text-muted-foreground">{label}</span><input type="number" min={0} value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50" /></label>
}
