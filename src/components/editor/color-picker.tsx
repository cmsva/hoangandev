"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { HexColorPicker } from "react-colorful"
import { IconCheck } from "@/components/icons"

const colorPresets = [
  "#fecaca", "#fca5a5", "#f87171", "#ef4444", "#dc2626", "#b91c1c",
  "#fecdd3", "#fda4af", "#fb7185", "#f43f5e", "#e11d48", "#be123c",
  "#fed7aa", "#fdba74", "#fb923c", "#f97316", "#ea580c", "#c2410c",
  "#fde68a", "#fcd34d", "#fbbf24", "#f59e0b", "#d97706", "#b45309",
  "#d9f99d", "#bef264", "#a3e635", "#84cc16", "#65a30d", "#4d7c0f",
  "#bbf7d0", "#86efac", "#4ade80", "#22c55e", "#16a34a", "#15803d",
  "#a5f3fc", "#67e8f9", "#22d3ee", "#06b6d4", "#0891b2", "#0e7490",
  "#bfdbfe", "#93c5fd", "#60a5fa", "#3b82f6", "#2563eb", "#1d4ed8",
  "#c7d2fe", "#a5b4fc", "#818cf8", "#6366f1", "#4f46e5", "#4338ca",
  "#e9d5ff", "#d8b4fe", "#c084fc", "#a855f7", "#9333ea", "#7e22ce",
  "#fbcfe8", "#f9a8d4", "#f472b6", "#ec4899", "#db2777", "#be185d",
  "#ffffff", "#cbd5e1", "#64748b", "#475569", "#0f172a", "#000000",
]

const isHexDark = (hex: string) => {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return r * 0.299 + g * 0.587 + b * 0.114 < 128
}

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  label?: string
  className?: string
}

export function ColorPicker({ value, onChange, label, className }: ColorPickerProps) {
  const [color, setColor] = React.useState(value)
  const [open, setOpen] = React.useState(false)
  const [eyeDropperSupported, setEyeDropperSupported] = React.useState(false)

  React.useEffect(() => {
    setColor(value)
  }, [value])

  React.useEffect(() => {
    if (typeof window !== "undefined" && "EyeDropper" in window) {
      setEyeDropperSupported(true)
    }
  }, [])

  const onColorChange = (newColor: string) => {
    setColor(newColor)
    onChange(newColor)
  }

  const onEyeDropperColorChange = async () => {
    if (!eyeDropperSupported) return
    try {
      const eyeDropper = new (window as any).EyeDropper()
      const result = await eyeDropper.open()
      if (result?.sRGBHex) onColorChange(result.sRGBHex)
    } catch {
      // User cancelled
    }
  }

  return (
    <div className={cn("grid w-full gap-2 self-start", className)}>
      {label && <label className="text-sm font-medium text-foreground leading-none">{label}</label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative flex w-full items-center gap-2">
            <button
              type="button"
              className="border-foreground/15 absolute top-1/2 left-2 z-10 size-[22px] shrink-0 -translate-y-1/2 rounded-lg border"
              style={{ backgroundColor: color }}
              title="Color preview"
            />
            <Input
              value={color}
              onChange={(e) => onColorChange(e.target.value)}
              className="w-full pl-10 text-sm"
            />
            {eyeDropperSupported && (
              <button
                type="button"
                onClick={onEyeDropperColorChange}
                className="absolute top-1/2 right-2 -translate-y-1/2 p-1 hover:opacity-50 transition-opacity"
                title="Pick color from screen"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m2 22 1-1h3l9-9" /><path d="M3 21v-3l9-9" /><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3L15 6" />
                </svg>
              </button>
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-[228px] p-3">
          <Tabs defaultValue="presets" className="w-full">
            <TabsList className="mb-3 grid grid-cols-2 w-full">
              <TabsTrigger value="presets">Presets</TabsTrigger>
              <TabsTrigger value="picker">Custom</TabsTrigger>
            </TabsList>
            <TabsContent value="presets" className="space-y-2">
              <div className="flex max-h-44 flex-wrap gap-1 overflow-y-auto">
                {colorPresets.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onColorChange(preset)}
                    className={cn(
                      "relative size-7 rounded-full border-2 transition-all",
                      color === preset && "ring-2 ring-blue-500"
                    )}
                    style={{ backgroundColor: preset }}
                  >
                    {color === preset && (
                      <div className="absolute inset-0 grid place-content-center">
                        <IconCheck
                          size={14}
                          className={cn("drop-shadow", isHexDark(preset) ? "text-white" : "text-black")}
                        />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="picker" className="space-y-2">
              <HexColorPicker color={color} onChange={onColorChange} />
            </TabsContent>
            <div className="relative mt-2">
              <div className="absolute top-1/2 left-3 -translate-y-1/2 text-xs">HEX</div>
              <Input value={color} onChange={(e) => onColorChange(e.target.value)} className="pl-10" />
            </div>
          </Tabs>
        </PopoverContent>
      </Popover>
    </div>
  )
}
