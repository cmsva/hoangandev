"use client"

import * as React from "react"
import { ChevronsUpDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

export type SelectCustomOption<V extends string = string> = {
  value: V
  label: React.ReactNode
  /** Hiển thị trong trigger khi được chọn — fallback về label */
  triggerLabel?: React.ReactNode
  disabled?: boolean
  /** Subtitle hiển thị bên dưới label trong list */
  description?: React.ReactNode
}

interface SelectCustomProps<V extends string = string> {
  options: SelectCustomOption<V>[]
  value?: V
  onValueChange?: (value: V) => void
  placeholder?: React.ReactNode
  disabled?: boolean
  className?: string
  triggerClassName?: string
  contentClassName?: string
  searchable?: boolean
  searchPlaceholder?: string
  emptyMessage?: React.ReactNode
  size?: "sm" | "default" | "lg"
  id?: string
}

const sizeClasses = {
  sm: "h-8 text-xs px-3",
  default: "h-9 text-sm",
  lg: "h-11 text-sm",
} as const

/**
 * Combobox-style select dùng Popover + cmdk.
 * Đẹp hơn shadcn Select mặc định, hỗ trợ tìm kiếm, item có description.
 */
export function SelectCustom<V extends string = string>({
  options,
  value,
  onValueChange,
  placeholder = "Chọn...",
  disabled,
  className,
  triggerClassName,
  contentClassName,
  searchable = false,
  searchPlaceholder = "Tìm kiếm...",
  emptyMessage = "Không có kết quả",
  size = "default",
  id,
}: SelectCustomProps<V>) {
  const [open, setOpen] = React.useState(false)
  const selected = options.find((o) => o.value === value)

  return (
    <div className={cn("w-full", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "w-full justify-between font-normal",
              sizeClasses[size],
              !selected && "text-muted-foreground",
              triggerClassName
            )}
          >
            <span className="truncate text-left">
              {selected ? (selected.triggerLabel ?? selected.label) : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className={cn("w-[var(--radix-popover-trigger-width)] p-0", contentClassName)}
          align="start"
        >
          <Command shouldFilter={searchable}>
            {searchable && <CommandInput placeholder={searchPlaceholder} />}
            <CommandList>
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              <CommandGroup>
                {options.map((opt) => (
                  <CommandItem
                    key={opt.value}
                    value={searchable ? `${opt.value} ${typeof opt.label === "string" ? opt.label : ""}` : opt.value}
                    disabled={opt.disabled}
                    onSelect={() => {
                      onValueChange?.(opt.value)
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        value === opt.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                      <div className="font-medium truncate">{opt.label}</div>
                      {opt.description && (
                        <div className="text-[11px] text-muted-foreground truncate">
                          {opt.description}
                        </div>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
