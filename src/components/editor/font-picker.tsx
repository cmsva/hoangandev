"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
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
import { IconCheck, IconChevronDown, IconLoader } from "@/components/icons"

type GoogleFont = {
  family: string
  category: string
  variants: string[]
}

type FontOption = {
  label: string
  value: string
  url: string
}

function buildFontOption(font: GoogleFont): FontOption {
  const value = `'${font.family}', ${font.category}`
  const url = `https://fonts.googleapis.com/css2?family=${font.family.replace(/\s+/g, "+")}:wght@400;500;600;700&display=swap`
  return { label: font.family, value, url }
}

interface FontPickerProps {
  value?: string
  onValueChange: (value: string, url: string) => void
  className?: string
}

export function FontPicker({ value, onValueChange, className }: FontPickerProps) {
  const [open, setOpen] = React.useState(false)
  const [fonts, setFonts] = React.useState<FontOption[]>([])
  const [loading, setLoading] = React.useState(false)
  const [fetched, setFetched] = React.useState(false)

  // Fetch fonts from API
  React.useEffect(() => {
    if (fetched) return
    setLoading(true)
    fetch("/api/google-fonts")
      .then((res) => res.json())
      .then((data: GoogleFont[]) => {
        if (Array.isArray(data)) {
          setFonts(data.map(buildFontOption))
        }
      })
      .catch(() => {
        // Silently fail
      })
      .finally(() => {
        setLoading(false)
        setFetched(true)
      })
  }, [fetched])

  // Lazy load fonts for preview
  const [loadedFontNames, setLoadedFontNames] = React.useState<Set<string>>(new Set())

  const loadFontPreview = React.useCallback(
    (fontLabel: string, fontUrl: string) => {
      if (loadedFontNames.has(fontLabel)) return
      const fontId = `font-preview-${fontLabel.replace(/\s+/g, "-")}`
      if (!document.getElementById(fontId)) {
        const link = document.createElement("link")
        link.id = fontId
        link.href = fontUrl
        link.rel = "stylesheet"
        document.head.appendChild(link)
      }
      setLoadedFontNames((prev) => new Set(prev).add(fontLabel))
    },
    [loadedFontNames]
  )

  // Load currently selected font
  React.useEffect(() => {
    if (value) {
      const selected = fonts.find((f) => f.value === value)
      if (selected) loadFontPreview(selected.label, selected.url)
    }
  }, [value, fonts, loadFontPreview])

  const selectedFont = fonts.find((font) => font.value === value)

  const handleSelect = (currentValue: string) => {
    const matchedFont = fonts.find(
      (font) =>
        font.value.toLowerCase() === currentValue.toLowerCase() ||
        font.label.toLowerCase() === currentValue.toLowerCase()
    )

    if (matchedFont) {
      loadFontPreview(matchedFont.label, matchedFont.url)
      onValueChange(matchedFont.value, matchedFont.url)
      setOpen(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", className)}
        >
          {loading ? (
            <span className="flex items-center gap-2 text-muted-foreground">
              <IconLoader size={16} className="animate-spin" />
              Đang tải fonts...
            </span>
          ) : selectedFont ? (
            <span className="truncate" style={{ fontFamily: selectedFont.value }}>
              {selectedFont.label}
            </span>
          ) : (
            value || "Chọn font chữ..."
          )}
          <IconChevronDown size={16} className="ml-2 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Tìm kiếm font..." />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>
              {loading ? "Đang tải..." : "Không tìm thấy font."}
            </CommandEmpty>
            <CommandGroup>
              {fonts.map((font) => (
                <CommandItem
                  key={font.value}
                  value={font.label}
                  onSelect={(val) => {
                    handleSelect(val)
                    loadFontPreview(font.label, font.url)
                  }}
                  className="cursor-pointer"
                  style={{ pointerEvents: "auto" }}
                >
                  <IconCheck
                    size={16}
                    className={cn(
                      "mr-2",
                      value === font.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span
                    className="text-base truncate"
                    style={
                      loadedFontNames.has(font.label)
                        ? { fontFamily: font.value }
                        : undefined
                    }
                  >
                    {font.label}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
