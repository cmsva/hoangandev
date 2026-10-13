"use client"

/**
 * SiteNotificationsConfig — Admin tab cấu hình banner dashboard + popup.
 *
 *  - Banner: nhiều ô alert (max 5), mỗi ô = HTML CKEditor + chọn màu.
 *  - Popup : 1 dialog HTML CKEditor (2 button đóng / ẩn 1 giờ).
 *
 * Live preview render thật bằng <DashboardBanners preview /> + <FloatingPopup preview />.
 */
import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/client"
import { toast } from "@/components/ui/toast"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { SelectCustom } from "@/components/ui/select-custom"
import { CKEditor } from "@/components/admin/ckeditor"
import { DashboardBanners } from "@/components/notifications/dashboard-banners"
import { FloatingPopup } from "@/components/notifications/floating-popup"
import { IconPlus, IconTrash } from "@/components/icons"
import type {
  BannerItem,
  BannerVariant,
  FloatingPopupConfig,
} from "@/services/site-notification.service"

const VARIANT_OPTIONS: { value: BannerVariant; label: string }[] = [
  { value: "info", label: "Thông tin (xanh dương)" },
  { value: "success", label: "Thành công (xanh lá)" },
  { value: "warning", label: "Cảnh báo (vàng)" },
  { value: "promo", label: "Khuyến mãi (hồng)" },
  { value: "danger", label: "Nguy hiểm (đỏ)" },
]

const MAX_BANNERS = 5

function makeId(): string {
  return `bn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function emptyBanner(): BannerItem {
  return { id: makeId(), enabled: true, variant: "info", contentHtml: "" }
}

const emptyPopup: FloatingPopupConfig = { enabled: false, contentHtml: "" }

export function SiteNotificationsConfig() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery(
    trpc.adminNotification.getSiteNotifications.queryOptions()
  )

  const [bannersEnabled, setBannersEnabled] = useState(false)
  const [banners, setBanners] = useState<BannerItem[]>([])
  const [popup, setPopup] = useState<FloatingPopupConfig>(emptyPopup)

  // Hydrate form once data arrives
  useEffect(() => {
    if (data) {
      setBannersEnabled(data.bannersEnabled)
      setBanners(data.banners)
      setPopup(data.popup)
    }
  }, [data])

  const saveMut = useMutation(
    trpc.adminNotification.saveSiteNotifications.mutationOptions({
      onSuccess: () => {
        toast.success("Đã lưu banner & popup")
        queryClient.invalidateQueries({
          queryKey: trpc.adminNotification.getSiteNotifications.queryKey(),
        })
        queryClient.invalidateQueries({
          queryKey: trpc.public.siteNotifications.queryKey(),
        })
      },
      onError: (err) => toast.error(err.message),
    })
  )

  // ─── Banner handlers ───────────────────────────────────────────────────
  function addBanner() {
    if (banners.length >= MAX_BANNERS) {
      toast.error(`Tối đa ${MAX_BANNERS} banner`)
      return
    }
    setBanners((prev) => [...prev, emptyBanner()])
  }

  function updateBanner<K extends keyof BannerItem>(idx: number, key: K, value: BannerItem[K]) {
    setBanners((prev) => prev.map((b, i) => (i === idx ? { ...b, [key]: value } : b)))
  }

  function removeBanner(idx: number) {
    setBanners((prev) => prev.filter((_, i) => i !== idx))
  }

  function moveBanner(idx: number, dir: -1 | 1) {
    setBanners((prev) => {
      const next = [...prev]
      const target = idx + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next
    })
  }

  function handleSave() {
    saveMut.mutate({ bannersEnabled, banners, popup })
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    )
  }

  const previewBanners = banners.filter((b) => b.contentHtml.trim())

  return (
    <div className="space-y-6">
      {/* ─── Banner dashboard ─── */}
      <section className="space-y-4 rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold">Banner dashboard</h3>
            <p className="text-xs text-muted-foreground">
              Hiển thị dưới breadcrumb dashboard, tối đa {MAX_BANNERS} banner. Mỗi banner soạn HTML
              tự do (CKEditor) và chọn màu.
            </p>
          </div>
          <Switch checked={bannersEnabled} onCheckedChange={setBannersEnabled} />
        </div>

        {bannersEnabled && (
          <div className="space-y-4 border-t pt-4">
            {banners.length === 0 && (
              <p className="rounded-lg border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
                Chưa có banner nào. Bấm <strong>+ Thêm banner</strong> để tạo.
              </p>
            )}

            {banners.map((banner, idx) => (
              <div
                key={banner.id}
                className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="rounded-md bg-primary/10 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">
                      Banner #{idx + 1}
                    </span>
                    <Switch
                      checked={banner.enabled}
                      onCheckedChange={(v) => updateBanner(idx, "enabled", v)}
                    />
                    <span className="text-xs text-muted-foreground">
                      {banner.enabled ? "Đang bật" : "Đang tắt"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => moveBanner(idx, -1)}
                      disabled={idx === 0}
                      aria-label="Lên trên"
                    >
                      ↑
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => moveBanner(idx, 1)}
                      disabled={idx === banners.length - 1}
                      aria-label="Xuống dưới"
                    >
                      ↓
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeBanner(idx)}
                      className="text-rose-600 hover:text-rose-700 dark:text-rose-400"
                    >
                      <IconTrash size={14} />
                      <span className="ms-1">Xóa</span>
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Màu sắc</Label>
                    <SelectCustom
                      value={banner.variant}
                      onValueChange={(v) => updateBanner(idx, "variant", v as BannerVariant)}
                      options={VARIANT_OPTIONS}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nội dung HTML</Label>
                    <CKEditor
                      value={banner.contentHtml}
                      onChange={(v) => updateBanner(idx, "contentHtml", v)}
                      height={180}
                    />
                  </div>
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={addBanner}
              disabled={banners.length >= MAX_BANNERS}
              className="w-full"
            >
              <IconPlus size={14} />
              <span className="ms-1">Thêm banner ({banners.length}/{MAX_BANNERS})</span>
            </Button>

            {/* Live preview */}
            {previewBanners.length > 0 && (
              <div className="space-y-2 rounded-xl border border-dashed border-border/60 bg-background p-4">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Xem trước
                </Label>
                <DashboardBanners enabled banners={previewBanners} preview />
              </div>
            )}
          </div>
        )}
      </section>

      {/* ─── Popup ─── */}
      <section className="space-y-4 rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold">Popup dashboard</h3>
            <p className="text-xs text-muted-foreground">
              Dialog hiển thị khi user vào dashboard. Có 2 nút: Đóng (đóng phiên) và Ẩn 1 giờ.
              Soạn nội dung tự do bằng CKEditor.
            </p>
          </div>
          <Switch
            checked={popup.enabled}
            onCheckedChange={(v) => setPopup((p) => ({ ...p, enabled: v }))}
          />
        </div>

        {popup.enabled && (
          <div className="space-y-3 border-t pt-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Nội dung HTML</Label>
              <CKEditor
                value={popup.contentHtml}
                onChange={(v) => setPopup((p) => ({ ...p, contentHtml: v }))}
                height={300}
              />
            </div>

            {/* Preview button — mở dialog xem trước */}
            {popup.contentHtml.trim() && <PopupPreview config={popup} />}
          </div>
        )}
      </section>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saveMut.isPending}>
          {saveMut.isPending ? "Đang lưu..." : "Lưu cấu hình"}
        </Button>
      </div>
    </div>
  )
}

/**
 * Mini wrapper để admin bấm xem trước popup mà không tự mở.
 * FloatingPopup auto-open khi preview=true, nên ta gói vào key={n} để
 * remount-mở-lại mỗi lần admin bấm.
 */
function PopupPreview({ config }: { config: FloatingPopupConfig }) {
  const [openCount, setOpenCount] = useState(0)
  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" size="sm" onClick={() => setOpenCount((n) => n + 1)}>
        Xem trước popup
      </Button>
      {openCount > 0 && (
        <FloatingPopup key={openCount} config={config} preview />
      )}
    </div>
  )
}
