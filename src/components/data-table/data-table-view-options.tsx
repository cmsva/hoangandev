"use client"

import type { Table } from "@tanstack/react-table"
import { Check, Settings2 } from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface DataTableViewOptionsProps<TData>
  extends React.ComponentProps<typeof PopoverContent> {
  table: Table<TData>
  disabled?: boolean
}

export function DataTableViewOptions<TData>({
  table,
  disabled,
  ...props
}: DataTableViewOptionsProps<TData>) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _visibilityState = table.getState().columnVisibility
  const [open, setOpen] = React.useState(false)

  const columns = table
    .getAllColumns()
    .filter(
      (column) =>
        typeof column.accessorFn !== "undefined" && column.getCanHide(),
    )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          aria-label="Hiển thị cột"
          role="combobox"
          variant="outline"
          className="w-full h-9 font-normal"
          disabled={disabled}
        >
          <Settings2 className="text-muted-foreground" />
          Cột
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-0" {...props}>
        <Command>
          <CommandInput placeholder="Tìm cột..." />
          <CommandList>
            <CommandEmpty>Không có cột nào.</CommandEmpty>
            <CommandGroup>
              {columns.map((column) => {
                const isVisible = column.getIsVisible()
                return (
                  <CommandItem
                    key={column.id}
                    onSelect={() => column.toggleVisibility(!isVisible)}
                  >
                    <span className="truncate">
                      {(column.columnDef.meta as any)?.label ?? column.id}
                    </span>
                    <Check
                      className={cn(
                        "ml-auto size-4 shrink-0",
                        isVisible ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
