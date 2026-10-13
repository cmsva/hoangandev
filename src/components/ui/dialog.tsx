"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface DialogContextValue {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const DialogContext = React.createContext<DialogContextValue | null>(null)

function useDialogContext() {
  const ctx = React.useContext(DialogContext)
  if (!ctx) throw new Error("Dialog components must be used inside <Dialog>")
  return ctx
}

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

function Dialog({ open, onOpenChange, children }: DialogProps) {
  // Close on Escape
  React.useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false)
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open, onOpenChange])

  // Lock body scroll when open
  React.useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = original }
  }, [open])

  return (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      {children}
    </DialogContext.Provider>
  )
}

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  scrollable?: boolean
}

function DialogContent({
  className,
  children,
  scrollable = true,
  ...props
}: DialogContentProps) {
  const { open, onOpenChange } = useDialogContext()
  if (!open) return null

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex justify-center p-4",
        scrollable ? "items-center" : "items-start overflow-y-auto py-8"
      )}
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false)
      }}
    >
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in-0" />

      {/* Content */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 flex w-full max-w-lg flex-col rounded-xl border border-border bg-background shadow-xl animate-in fade-in-0 zoom-in-95 overflow-hidden",
          scrollable ? "max-h-[90vh]" : "my-auto",
          className
        )}
        {...props}
      >
        <div className={cn(scrollable ? "overflow-y-auto" : "overflow-visible", "p-6")}>
          {children}
        </div>
        {/* Close button */}
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground opacity-70 transition-opacity hover:opacity-100 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring z-10"
          aria-label="Đóng"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
        </button>
      </div>
    </div>
  )
}

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-1.5 pr-8", className)} {...props} />
}

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:space-x-2", className)}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-lg font-semibold leading-snug tracking-tight", className)} {...props} />
}

function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />
}

export { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription }
