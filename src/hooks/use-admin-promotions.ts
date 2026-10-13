/**
 * useAdminPromotions — Client controller cho page Khuyến mãi nạp.
 *
 * Quản lý: list query, form state (amount, discount), add/update/delete mutations,
 * dialog state. View chỉ destructure và render.
 */
"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/client"
import { toast } from "@/components/ui/toast"

export interface PromotionItem {
  id: string
  amount: number
  discount: number
  createdAt?: Date | string
  updatedAt?: Date | string
}

export interface PromotionFormState {
  amount: string
  discount: string
}

const emptyForm: PromotionFormState = { amount: "100000", discount: "10" }

export function useAdminPromotions() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  // ─── Dialog state ───
  const [isCreating, setIsCreating] = useState(false)
  const [editing, setEditing] = useState<PromotionItem | null>(null)
  const [deleting, setDeleting] = useState<PromotionItem | null>(null)

  // ─── Server query ───
  const { data, isLoading, isFetching } = useQuery(
    trpc.adminDeposit.getAdminPromotions.queryOptions()
  )
  const items = (data ?? []) as PromotionItem[]

  // ─── Computed: sorted asc + max discount preview ───
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.amount - b.amount),
    [items]
  )
  const maxDiscount = useMemo(
    () => (items.length ? Math.max(...items.map((p) => p.discount)) : 0),
    [items]
  )

  function invalidateList() {
    queryClient.invalidateQueries({
      queryKey: trpc.adminDeposit.getAdminPromotions.queryKey(),
    })
    // Invalidate customer-facing promotions list too
    queryClient.invalidateQueries({
      queryKey: trpc.deposit.getPromotions.queryKey(),
    })
  }

  // ─── Mutations ───
  const createMut = useMutation(
    trpc.adminDeposit.addAdminPromotion.mutationOptions({
      onSuccess: () => {
        toast.success("Đã thêm mức khuyến mãi")
        setIsCreating(false)
        invalidateList()
      },
      onError: (err) => toast.error(err.message),
    })
  )

  const updateMut = useMutation(
    trpc.adminDeposit.updateAdminPromotion.mutationOptions({
      onSuccess: () => {
        toast.success("Đã cập nhật khuyến mãi")
        setEditing(null)
        invalidateList()
      },
      onError: (err) => toast.error(err.message),
    })
  )

  const deleteMut = useMutation(
    trpc.adminDeposit.deleteAdminPromotion.mutationOptions({
      onSuccess: () => {
        toast.success("Đã xóa khuyến mãi")
        setDeleting(null)
        invalidateList()
      },
      onError: (err) => toast.error(err.message),
    })
  )

  // ─── Handlers ───
  function submitForm(form: PromotionFormState) {
    const amount = Number(form.amount)
    const discount = Number(form.discount)
    if (!Number.isFinite(amount) || amount < 1) {
      toast.error("Mức nạp phải lớn hơn 0")
      return
    }
    if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
      toast.error("% bonus phải từ 0 đến 100")
      return
    }
    if (editing) {
      updateMut.mutate({ id: editing.id, amount, discount })
    } else {
      createMut.mutate({ amount, discount })
    }
  }

  function confirmDelete() {
    if (deleting) deleteMut.mutate({ id: deleting.id })
  }

  // ─── Public API ───
  return {
    items: sortedItems,
    maxDiscount,
    isLoading,
    isFetching,
    // dialog state
    isCreating,
    setIsCreating,
    editing,
    setEditing,
    deleting,
    setDeleting,
    // handlers
    submitForm,
    confirmDelete,
    isSubmitting: createMut.isPending || updateMut.isPending,
    isDeleting: deleteMut.isPending,
    emptyForm,
  }
}
