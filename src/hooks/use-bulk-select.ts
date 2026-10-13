import { useCallback, useMemo, useState } from "react"

/**
 * Hook quản lý bulk select cho admin data tables.
 * 
 * @param items - Mảng items hiện tại trên trang (phải có `id: string`)
 */
export function useBulkSelect<T extends { id: string }>(items: T[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const selectedCount = useMemo(() => {
    // Chỉ đếm IDs nằm trong items hiện tại (trang hiện tại)
    let count = 0
    for (const item of items) {
      if (selectedIds.has(item.id)) count++
    }
    return count
  }, [items, selectedIds])

  const isAllSelected = useMemo(
    () => items.length > 0 && items.every((item) => selectedIds.has(item.id)),
    [items, selectedIds]
  )

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  )

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (items.every((item) => prev.has(item.id))) {
        // Deselect all current page items
        const next = new Set(prev)
        for (const item of items) next.delete(item.id)
        return next
      }
      // Select all current page items
      const next = new Set(prev)
      for (const item of items) next.add(item.id)
      return next
    })
  }, [items])

  const clearAll = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  /** IDs đã chọn mà vẫn thuộc items hiện tại */
  const getSelectedIds = useCallback((): string[] => {
    return items.filter((item) => selectedIds.has(item.id)).map((item) => item.id)
  }, [items, selectedIds])

  return {
    selectedIds,
    selectedCount,
    isAllSelected,
    isSelected,
    toggle,
    toggleAll,
    clearAll,
    getSelectedIds,
  }
}
