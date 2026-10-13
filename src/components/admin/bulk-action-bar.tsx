"use client"

import { useState } from "react"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { TableCell, TableHead } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"

interface BulkActionBarProps {
  selectedCount: number
  onClearAll: () => void
  onBulkDelete: () => void
  isPending?: boolean
  /** Label thực thể, ví dụ "đơn hàng", "bài viết" */
  entityLabel?: string
}

/**
 * Floating action bar hiện khi có items selected.
 * Sticky bottom với animation.
 */
export function BulkActionBar({
  selectedCount,
  onClearAll,
  onBulkDelete,
  isPending,
  entityLabel = "mục",
}: BulkActionBarProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)

  if (selectedCount === 0) return null

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-center p-4 animate-in slide-in-from-bottom-4 fade-in duration-200">
        <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-2.5 shadow-lg ring-1 ring-border/50">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
              {selectedCount}
            </span>
            <span className="text-sm font-medium text-muted-foreground">
              {entityLabel} đã chọn
            </span>
          </div>
          <div className="h-5 w-px bg-border" />
          <Button size="sm" variant="ghost" onClick={onClearAll}>
            Bỏ chọn
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setConfirmOpen(true)}
            disabled={isPending}
          >
            {isPending ? "Đang xóa..." : `Xóa ${selectedCount} ${entityLabel}`}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Xóa ${selectedCount} ${entityLabel}`}
        description={`Bạn có chắc muốn xóa ${selectedCount} ${entityLabel} đã chọn? Hành động này không thể hoàn tác.`}
        variant="destructive"
        confirmText="Xóa tất cả"
        cancelText="Hủy"
        isPending={isPending}
        onConfirm={onBulkDelete}
      />
    </>
  )
}

/**
 * Checkbox trong header table — toggle select all.
 */
export function BulkSelectHead({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: () => void
}) {
  return (
    <TableHead className="w-[40px]">
      <Checkbox checked={checked} onCheckedChange={onChange} aria-label="Chọn tất cả" />
    </TableHead>
  )
}

/**
 * Checkbox trong row table — toggle single item.
 */
export function BulkSelectCell({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: () => void
}) {
  return (
    <TableCell className="w-[40px]">
      <Checkbox checked={checked} onCheckedChange={onChange} aria-label="Chọn mục này" />
    </TableCell>
  )
}
