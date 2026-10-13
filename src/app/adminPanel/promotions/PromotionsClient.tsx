"use client"

import { useState } from "react"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { IconDollarCircle, IconPlus, IconTrash } from "@/components/icons"
import {
  useAdminPromotions,
  type PromotionFormState,
  type PromotionItem,
} from "@/hooks/use-admin-promotions"

function formatMoney(value: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(value)}đ`
}

export function PromotionsClient() {
  const {
    items,
    maxDiscount,
    isLoading,
    isFetching,
    isCreating,
    setIsCreating,
    editing,
    setEditing,
    deleting,
    setDeleting,
    submitForm,
    confirmDelete,
    isSubmitting,
    isDeleting,
    emptyForm,
  } = useAdminPromotions()

  return (
    <div className="space-y-6">
      <PageHeader count={items.length} maxDiscount={maxDiscount} />

      <MechanismCard />

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">Các mức khuyến mãi</h2>
          {isFetching && !isLoading && (
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
          )}
        </div>
        <Button onClick={() => setIsCreating(true)}>
          <IconPlus size={16} /> Thêm mức
        </Button>
      </div>

      {/* Desktop table */}
      <div className="hidden rounded-md border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Mức nạp tối thiểu</TableHead>
              <TableHead className="text-right">% Bonus</TableHead>
              <TableHead className="text-right">Ví dụ nạp 1.000.000đ</TableHead>
              <TableHead className="text-end">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, row) => (
                <TableRow key={row}>
                  {Array.from({ length: 5 }).map((__, cell) => (
                    <TableCell key={cell}>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : items.length > 0 ? (
              items.map((item, index) => {
                const sample = 1_000_000
                const eligible = sample >= item.amount
                const bonus = eligible ? Math.floor((sample * item.discount) / 100) : 0
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <span className="font-mono text-sm text-muted-foreground">{index + 1}</span>
                    </TableCell>
                    <TableCell className="font-semibold">{formatMoney(item.amount)}</TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-600">
                        +{item.discount}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {bonus > 0 ? `+${formatMoney(bonus)}` : "—"}
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => setEditing(item)}>
                          Sửa
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => setDeleting(item)}>
                          <IconTrash size={14} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  Chưa có mức khuyến mãi nào. Bấm &ldquo;Thêm mức&rdquo; để tạo.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        ) : items.length > 0 ? (
          items.map((item) => (
            <article key={item.id} className="space-y-3 rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Nạp từ</p>
                  <p className="font-bold">{formatMoney(item.amount)}</p>
                </div>
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-sm font-bold text-emerald-600">
                  +{item.discount}%
                </span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setEditing(item)}>
                  Sửa
                </Button>
                <Button size="sm" variant="destructive" className="flex-1" onClick={() => setDeleting(item)}>
                  Xóa
                </Button>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
            Chưa có mức khuyến mãi nào.
          </div>
        )}
      </div>

      {(isCreating || editing) && (
        <PromotionFormDialog
          promotion={editing}
          emptyForm={emptyForm}
          isPending={isSubmitting}
          onClose={() => {
            setIsCreating(false)
            setEditing(null)
          }}
          onSubmit={submitForm}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Xóa mức khuyến mãi?"
        description={
          deleting
            ? `Mức nạp ${formatMoney(deleting.amount)} (+${deleting.discount}%) sẽ bị xóa.`
            : undefined
        }
        variant="destructive"
        confirmText="Xóa"
        onConfirm={confirmDelete}
        isPending={isDeleting}
      />
    </div>
  )
}

function PageHeader({ count, maxDiscount }: { count: number; maxDiscount: number }) {
  return (
    <header className="space-y-1">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <a href="/adminPanel/dashboard" className="transition-colors hover:text-foreground">
          Admin
        </a>
        <span className="text-muted-foreground/50">/</span>
        <span className="text-foreground">Khuyến mãi nạp</span>
      </nav>
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-rose-500/15 text-rose-600">
          <IconDollarCircle size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Khuyến mãi nạp tiền</h1>
          <p className="text-sm text-muted-foreground">
            {count > 0
              ? `${count} mức đang áp dụng · bonus cao nhất +${maxDiscount}%`
              : "Cấu hình bonus thưởng theo mức nạp."}
          </p>
        </div>
      </div>
    </header>
  )
}

function MechanismCard() {
  return (
    <div className="rounded-xl border bg-muted/30 p-4 text-sm leading-relaxed text-muted-foreground">
      <p className="mb-1 font-medium text-foreground">Cơ chế hoạt động</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          Khi nạp tiền, hệ thống áp <strong className="text-foreground">mức bonus cao nhất</strong> mà số
          tiền nạp đạt được. Bonus được cộng thẳng vào số dư nhận.
        </li>
        <li>
          Ví dụ: nạp <strong className="text-foreground">1.000.000đ</strong> với mức &ldquo;≥ 500.000đ → +10%&rdquo;
          sẽ nhận <strong className="text-foreground">1.100.000đ</strong>.
        </li>
        <li>Hoa hồng tiếp thị liên kết (affiliate) cũng tính trên số tiền nhận cuối cùng.</li>
      </ul>
    </div>
  )
}

function PromotionFormDialog({
  promotion,
  emptyForm,
  isPending,
  onClose,
  onSubmit,
}: {
  promotion: PromotionItem | null
  emptyForm: PromotionFormState
  isPending: boolean
  onClose: () => void
  onSubmit: (form: PromotionFormState) => void
}) {
  const [form, setForm] = useState<PromotionFormState>(() =>
    promotion
      ? { amount: String(promotion.amount), discount: String(promotion.discount) }
      : emptyForm
  )

  function setField<K extends keyof PromotionFormState>(key: K, value: PromotionFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const amountNum = Number(form.amount) || 0
  const discountNum = Number(form.discount) || 0
  const previewBonus = Math.floor((amountNum * discountNum) / 100)

  return (
    <Dialog open onOpenChange={(open) => !open && !isPending && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{promotion ? "Sửa mức khuyến mãi" : "Thêm mức khuyến mãi"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Mức nạp tối thiểu (đ)</Label>
            <Input
              type="number"
              min="1"
              value={form.amount}
              onChange={(e) => setField("amount", e.target.value)}
              placeholder="VD: 500000"
            />
          </div>
          <div className="space-y-1.5">
            <Label>% Bonus</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={form.discount}
              onChange={(e) => setField("discount", e.target.value)}
              placeholder="VD: 10"
            />
          </div>
          {amountNum > 0 && discountNum > 0 && (
            <div className="rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">
              Nạp {formatMoney(amountNum)} → nhận{" "}
              <strong>{formatMoney(amountNum + previewBonus)}</strong> (+{formatMoney(previewBonus)})
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Hủy
          </Button>
          <Button onClick={() => onSubmit(form)} disabled={isPending}>
            {isPending ? "Đang lưu..." : "Lưu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
