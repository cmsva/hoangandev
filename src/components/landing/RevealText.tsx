"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

interface RevealTextProps {
  /** Text to reveal character by character */
  text: string
  /** Speed in ms per character */
  speed?: number
  /** Additional className */
  className?: string
}

/**
 * RevealText — port 1:1 từ levuphong.
 * Hiện text từng ký tự (hero description).
 */
export function RevealText({ text, speed = 20, className }: RevealTextProps) {
  const [displayed, setDisplayed] = useState("")
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!text) return
    setDisplayed("")
    setDone(false)
    let i = 0
    const timer = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) {
        clearInterval(timer)
        setDone(true)
      }
    }, speed)
    return () => clearInterval(timer)
  }, [text, speed])

  return (
    <p className={cn(className)}>
      {displayed}
      {!done && (
        <span className="inline-block w-[2px] animate-pulse text-muted-foreground">
          |
        </span>
      )}
    </p>
  )
}
