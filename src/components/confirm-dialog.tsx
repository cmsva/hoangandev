"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Loader2 } from "lucide-react"

type Variant = "default" | "destructive" | "warning"

const VARIANT_STYLES: Record<Variant, { iconBg: string; iconColor: string; confirmVariant: "default" | "destructive" }> = {
  default: { iconBg: "bg-primary/10", iconColor: "text-primary", confirmVariant: "default" },
  destructive: { iconBg: "bg-red-500/10", iconColor: "text-red-500", confirmVariant: "destructive" },
  warning: { iconBg: "bg-amber-500/10", iconColor: "text-amber-500", confirmVariant: "default" },
}

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Tiêu đề dialog */
  title: string
  /** Mô tả ngắn */
  description?: React.ReactNode
  /** Optional content giữa description và footer (chi tiết bổ sung) */
  children?: React.ReactNode
  /** Variant: default | destructive | warning */
  variant?: Variant
  /** Custom icon — override default theo variant */
  icon?: React.ReactNode
  /** Text của nút confirm */
  confirmText?: string
  /** Text của nút cancel */
  cancelText?: string
  /** Callback khi nhấn confirm */
  onConfirm: () => void
  /** Loading state — disable buttons + show spinner */
  isPending?: boolean
}

/**
 * ConfirmDialog — dialog xác nhận hành động (hủy, xóa, kích hoạt, ...)
 *
 * Layout chuẩn:
 *   - Icon variant + Title (cùng dòng)
 *   - Description
 *   - Optional children (chi tiết)
 *   - Footer: Cancel (outline) + Confirm (variant theo prop) — sát nhau, không spread
 *
 * Sử dụng:
 *   <ConfirmDialog
 *     open={open}
 *     onOpenChange={setOpen}
 *     title="Xác nhận hủy hóa đơn"
 *     description="Bạn có chắc muốn hủy?"
 *     variant="destructive"
 *     confirmText="Xác nhận hủy"
 *     onConfirm={handleConfirm}
 *     isPending={mutation.isPending}
 *   />
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  variant = "default",
  icon,
  confirmText = "Xác nhận",
  cancelText = "Đóng",
  onConfirm,
  isPending = false,
}: ConfirmDialogProps) {
  const styles = VARIANT_STYLES[variant]
  const defaultIcon = variant === "destructive" || variant === "warning" ? (
    <AlertTriangle className={`size-5 ${styles.iconColor}`} />
  ) : null

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!isPending) onOpenChange(o) }}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <div className="flex items-start gap-3">
            {(icon || defaultIcon) && (
              <div className={`shrink-0 size-10 rounded-full ${styles.iconBg} flex items-center justify-center`}>
                {icon || defaultIcon}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base">{title}</DialogTitle>
              {description && (
                <DialogDescription className="text-sm text-muted-foreground mt-1">
                  {description}
                </DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        {children && <div className="text-sm text-muted-foreground">{children}</div>}

        {/* Footer — buttons compact, gap-2, justify-end (KHÔNG dùng DialogFooter
            mặc định vì shadcn DialogFooter có sm:justify-end + sm:space-x-2 thường
            bị stretch trên mobile và spacing mặc định không đẹp) */}
        <div className="flex items-center justify-end gap-2 mt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant={styles.confirmVariant}
            size="sm"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
            {confirmText}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
