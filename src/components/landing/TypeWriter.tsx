"use client"

import { useEffect, useState, useCallback } from "react"
import { cn } from "@/lib/utils"

interface TypeWriterProps {
  /** Array of strings to cycle through */
  words: string[]
  /** Typing speed in ms per character */
  typeSpeed?: number
  /** Deleting speed in ms per character */
  deleteSpeed?: number
  /** Pause duration after typing a word (ms) */
  pauseDuration?: number
  /** Additional className for the text */
  className?: string
  /** Cursor character */
  cursor?: string
  /** Cursor blink class */
  cursorClassName?: string
}

/**
 * TypeWriter — port 1:1 từ levuphong landing.
 * Gõ chữ rồi xoá, cycle qua mảng words.
 */
export function TypeWriter({
  words,
  typeSpeed = 80,
  deleteSpeed = 50,
  pauseDuration = 2000,
  className,
  cursor = "|",
  cursorClassName,
}: TypeWriterProps) {
  const [displayText, setDisplayText] = useState("")
  const [wordIndex, setWordIndex] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isPaused, setIsPaused] = useState(false)

  const tick = useCallback(() => {
    const currentWord = words[wordIndex]

    if (isPaused) return

    if (!isDeleting) {
      const next = currentWord.slice(0, displayText.length + 1)
      setDisplayText(next)

      if (next === currentWord) {
        setIsPaused(true)
        setTimeout(() => {
          setIsPaused(false)
          setIsDeleting(true)
        }, pauseDuration)
      }
    } else {
      const next = currentWord.slice(0, displayText.length - 1)
      setDisplayText(next)

      if (next === "") {
        setIsDeleting(false)
        setWordIndex((prev) => (prev + 1) % words.length)
      }
    }
  }, [displayText, isDeleting, isPaused, wordIndex, words, pauseDuration])

  useEffect(() => {
    const speed = isDeleting ? deleteSpeed : typeSpeed
    const timer = setTimeout(tick, speed)
    return () => clearTimeout(timer)
  }, [tick, isDeleting, typeSpeed, deleteSpeed])

  return (
    <span className={cn("inline", className)}>
      {displayText}
      <span
        className={cn("inline-block w-[2px] animate-pulse", cursorClassName)}
      >
        {cursor}
      </span>
    </span>
  )
}
