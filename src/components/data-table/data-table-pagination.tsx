"use client"

import { useState, useEffect } from "react"
import type { Table } from "@tanstack/react-table"
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface DataTablePaginationProps<TData> extends React.ComponentProps<"div"> {
  table: Table<TData>
  pageSizeOptions?: number[]
}

export function DataTablePagination<TData>({
  table,
  pageSizeOptions = [10, 20, 30, 40, 50],
  className,
  ...props
}: DataTablePaginationProps<TData>) {
  const tablePageSize = table.getState().pagination.pageSize
  const [localPageSize, setLocalPageSize] = useState(tablePageSize)

  useEffect(() => {
    setLocalPageSize(tablePageSize)
  }, [tablePageSize])

  const selectedCount = table.getFilteredSelectedRowModel().rows.length
  const totalCount = table.getFilteredRowModel().rows.length
  const pageIndex = table.getState().pagination.pageIndex
  const pageCount = table.getPageCount()
  const canPrev = table.getCanPreviousPage()
  const canNext = table.getCanNextPage()

  return (
    <div
      className={cn(
        "flex w-full flex-col-reverse items-center justify-between gap-6 overflow-auto p-1 sm:flex-row sm:gap-8",
        className,
      )}
      {...props}
    >
      <div className="flex-1 whitespace-nowrap text-muted-foreground text-xs sm:text-sm">
        {selectedCount > 0 ? (
          <>
            Đã chọn {selectedCount} / {totalCount} dòng
          </>
        ) : (
          <>{totalCount} kết quả</>
        )}
      </div>
      <div className="flex flex-col-reverse items-center gap-4 sm:flex-row sm:gap-6 lg:gap-8">
        <div className="flex items-center space-x-2">
          <p className="whitespace-nowrap font-medium text-sm">Hiển thị</p>
          <Select
            value={`${localPageSize}`}
            onValueChange={(value) => {
              const newSize = Number(value)
              setLocalPageSize(newSize)
              table.setPageSize(newSize)
            }}
          >
            <SelectTrigger className="h-8 w-18 data-size:h-8">
              <SelectValue placeholder={localPageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {pageSizeOptions.map((pageSize) => (
                <SelectItem key={pageSize} value={`${pageSize}`}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-center font-medium text-sm">
          Trang {pageIndex + 1} / {pageCount || 1}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            aria-label="Đầu"
            variant="outline"
            size="icon"
            className="hidden size-8 lg:flex"
            onClick={() => table.setPageIndex(0)}
            disabled={!canPrev}
          >
            <ChevronsLeft />
          </Button>
          <Button
            aria-label="Trước"
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => table.previousPage()}
            disabled={!canPrev}
          >
            <ChevronLeft />
          </Button>
          <Button
            aria-label="Sau"
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => table.nextPage()}
            disabled={!canNext}
          >
            <ChevronRight />
          </Button>
          <Button
            aria-label="Cuối"
            variant="outline"
            size="icon"
            className="hidden size-8 lg:flex"
            onClick={() => table.setPageIndex(pageCount - 1)}
            disabled={!canNext}
          >
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </div>
  )
}
