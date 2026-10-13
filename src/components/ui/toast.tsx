"use client"

import { useEffect, useState } from "react"
import { Toaster as HotToaster, toast } from "react-hot-toast"

export { toast }

/**
 * Toaster theo style levuphong — rounded, card bg, border, centered text.
 */
export function Toaster() {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) return null

  return (
    <HotToaster
      position="top-center"
      toastOptions={{
        duration: 4000,
        style: {
          borderRadius: "8px",
          background: "var(--color-card)",
          color: "var(--color-card-foreground)",
          border: "1px solid var(--color-border)",
          textAlign: "center",
          maxWidth: "fit-content",
        },
      }}
    />
  )
}
