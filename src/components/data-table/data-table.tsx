"use client"

import {
  flexRender,
  type Column,
  type Table as TanstackTable,
} from "@tanstack/react-table"
import type * as React from "react"

import { DataTablePagination } from "@/components/data-table/data-table-pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

/* Skeleton row for empty-state animated background */
function SkeletonRow() {
  const flexes = [1, 1.5, 2, 1.2, 0.8, 1, 1.5, 2, 1.2, 0.8]
  const colors = [
    "bg-muted-foreground/10",
    "bg-primary/30",
    "bg-muted-foreground/10",
    "bg-blue-500/30",
    "bg-muted-foreground/10",
    "bg-primary/30",
    "bg-muted-foreground/10",
    "bg-blue-500/30",
    "bg-muted-foreground/10",
    "bg-primary/30",
  ]
  const widths = ["w-full", "w-1/2", "w-full", "w-3/4", "w-full", "w-1/2", "w-full", "w-3/4", "w-full", "w-1/2"]
  return (
    <div className="flex gap-4 items-center w-full">
      {flexes.map((f, i) => (
        <div key={i} className="h-5 bg-muted/40 rounded flex items-center px-2 shrink-0 overflow-hidden" style={{ flex: `${f} 1 0%` }}>
          <div className={`h-1.5 rounded ${colors[i]} ${widths[i]}`} />
        </div>
      ))}
    </div>
  )
}

function getCommonPinningStyles<TData>({
  column,
}: {
  column: Column<TData>
}): React.CSSProperties {
  const isPinned = column.getIsPinned()
  const isLastLeftPinned = column.getIsLastColumn?.("left")
  const isFirstRightPinned = column.getIsFirstColumn?.("right")

  const style: React.CSSProperties = {
    position: isPinned ? "sticky" : undefined,
    left: isPinned === "left" ? `${column.getStart("left")}px` : undefined,
    right: isPinned === "right" ? `${column.getAfter("right")}px` : undefined,
    zIndex: isPinned ? 1 : undefined,
    background: isPinned ? "hsl(var(--background))" : undefined,
  }

  if (isPinned && (isLastLeftPinned || isFirstRightPinned)) {
    style.boxShadow = [
      "inset 0 1px 0 rgba(0,0,0,0.03)",
      isLastLeftPinned ? "6px 0 6px -6px rgba(0,0,0,0.3)" : undefined,
      isFirstRightPinned ? "-6px 0 6px -6px rgba(0,0,0,0.3)" : undefined,
    ]
      .filter(Boolean)
      .join(", ")
  }

  return style
}

interface DataTableProps<TData> extends React.ComponentProps<"div"> {
  table: TanstackTable<TData>
  actionBar?: React.ReactNode
}

export function DataTable<TData>({
  table,
  actionBar,
  children,
  className,
  ...props
}: DataTableProps<TData>) {
  const headerGroups = table.getHeaderGroups()
  const rowModel = table.getRowModel()
  const allColumnsLength = table.getAllColumns().length
  const filteredSelectedCount = table.getFilteredSelectedRowModel().rows.length

  return (
    <div className={cn("flex w-full flex-col gap-0", className)} {...props}>
      {children}
      <Table>
        <TableHeader>
          {headerGroups.map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  colSpan={header.colSpan}
                  style={{ ...getCommonPinningStyles({ column: header.column }) }}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rowModel.rows?.length ? (
            rowModel.rows.map((row) => (
              <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    style={{ ...getCommonPinningStyles({ column: cell.column }) }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={allColumnsLength} className="p-0 border-none shadow-none hover:bg-transparent">
                <div className="relative w-full min-h-[400px] flex items-center justify-center overflow-hidden bg-background/50 border border-dashed border-muted-foreground/20">
                  {/* Blurred skeleton grid background */}
                  <div className="absolute inset-0 z-0 pointer-events-none select-none mt-4 overflow-hidden">
                    <div className="absolute inset-0 opacity-100">
                      <div className="w-full space-y-5 px-4 pt-4">
                        {Array.from({ length: 12 }).map((_, i) => (
                          <SkeletonRow key={i} />
                        ))}
                      </div>
                    </div>
                    <div
                      className="absolute inset-0 z-10"
                      style={{
                        backdropFilter: "blur(8px)",
                        maskImage: "linear-gradient(transparent 0%, rgba(0,0,0,0.4) 0%, black 100%)",
                      }}
                    />
                  </div>
                  {/* Center content */}
                  <div className="relative z-10 flex flex-col items-center text-center p-6 bg-muted/50 rounded-xl space-y-2">
                    <svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="size-20 rounded-md text-muted-foreground" width="1em" height="1em" viewBox="0 0 24 24">
                      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5">
                        <path d="m15.578 3.382l2 1.05c2.151 1.129 3.227 1.693 3.825 2.708C22 8.154 22 9.417 22 11.942v.117c0 2.524 0 3.787-.597 4.801c-.598 1.015-1.674 1.58-3.825 2.709l-2 1.049C13.822 21.539 12.944 22 12 22s-1.822-.46-3.578-1.382l-2-1.05c-2.151-1.129-3.227-1.693-3.825-2.708C2 15.846 2 14.583 2 12.06v-.117c0-2.525 0-3.788.597-4.802c.598-1.015 1.674-1.58 3.825-2.708l2-1.05C10.178 2.461 11.056 2 12 2s1.822.46 3.578 1.382Z" />
                        <path d="M21 7.5L12 12m0 0L3 7.5m9 4.5v9.5" opacity=".5" />
                      </g>
                    </svg>
                    <h3 className="text-xl font-bold tracking-tight mb-2 text-foreground">Chưa có dữ liệu</h3>
                    <p className="text-muted-foreground mb-4">Thử tìm kiếm hoặc lọc lại để xem dữ liệu.</p>
                  </div>
                  {/* Top/bottom fades */}
                  <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-background to-transparent z-[5] pointer-events-none" />
                  <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-background to-transparent z-[5] pointer-events-none" />
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <div className="flex flex-col gap-2.5 mt-3">
        <DataTablePagination table={table} />
        {actionBar && filteredSelectedCount > 0 && actionBar}
      </div>
    </div>
  )
}
