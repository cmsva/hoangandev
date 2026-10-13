"use client"

/**
 * CouponField — Component dùng chung cho tất cả nơi áp mã giảm giá.
 *
 * UI design (theo mockup):
 *  - Label "Mã giảm giá" (bold)
 *  - Input "Nhập mã nếu có" + button "Áp dụng" cùng hàng
 *  - Khi đã áp: hiển thị badge với mã + % + nút bỏ áp
 *
 * Dùng tại:
 *  - /create-website/[slug] (thuê website)
 *  - /source-code/[slug] (mua mã nguồn)
 *  - /domain (đăng ký domain)
 *  - mọi nơi cần coupon trong tương lai
 */
import { IconCheck } from "@/components/icons"

export interface AppliedCoupon {
  code: string
  /** Số tiền đã giảm (đã được tính sẵn từ server) */
  discountAmount?: number
  /** Phần trăm giảm (nếu coupon kiểu %) */
  discount?: number
}

export interface CouponFieldProps {
  /** Giá trị input chưa áp */
  value: string
  onChange: (v: string) => void
  /** Coupon đã áp thành công, null khi chưa áp */
  applied: AppliedCoupon | null
  onApply: () => void
  onRemove: () => void
  /** True khi đang gọi API validate */
  validating?: boolean
  /** Disable tất cả khi đang submit form */
  disabled?: boolean
}

export function CouponField({
  value,
  onChange,
  applied,
  onApply,
  onRemove,
  validating = false,
  disabled = false,
}: CouponFieldProps) {
  const canApply = !validating && !disabled && value.trim().length > 0

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold text-foreground">
        Mã giảm giá
      </label>

      {applied ? (
        <div className="flex items-center justify-between rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 h-10">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 min-w-0">
            <IconCheck size={16} className="h-4 w-4 shrink-0" />
            <span className="text-sm font-bold font-mono truncate">{applied.code}</span>
            {applied.discount !== undefined && (
              <span className="text-xs shrink-0">−{applied.discount}%</span>
            )}
            {applied.discountAmount !== undefined && applied.discount === undefined && (
              <span className="text-xs shrink-0">
                −{applied.discountAmount.toLocaleString()}đ
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            className="text-rose-600 hover:bg-rose-500/10 p-1 rounded shrink-0 ml-2 disabled:opacity-50"
            title="Bỏ áp mã"
            aria-label="Bỏ áp mã giảm giá"
          >
            <span aria-hidden="true" className="block text-sm leading-none">x</span>
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canApply) {
                e.preventDefault()
                onApply()
              }
            }}
            placeholder="Nhập mã nếu có"
            maxLength={64}
            disabled={validating || disabled}
            className="h-10 flex-1 min-w-0 rounded-md border border-input bg-background px-3 text-sm font-mono shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:opacity-50"
          />
          <button
            type="button"
            onClick={onApply}
            disabled={!canApply}
            className="rounded-md border bg-card hover:bg-accent h-10 px-4 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {validating ? "..." : "Áp dụng"}
          </button>
        </div>
      )}
    </div>
  )
}
