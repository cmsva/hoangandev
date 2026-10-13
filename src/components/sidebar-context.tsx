"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

interface SidebarContextType {
  collapsed: boolean
  setCollapsed: (value: boolean) => void
  toggle: () => void
  mobileOpen: boolean
  setMobileOpen: (value: boolean) => void
  toggleMobile: () => void
  closeMobile: () => void
}

const SidebarContext = createContext<SidebarContextType>({
  collapsed: false,
  setCollapsed: () => {},
  toggle: () => {},
  mobileOpen: false,
  setMobileOpen: () => {},
  toggleMobile: () => {},
  closeMobile: () => {},
})

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const toggle = () => setCollapsed((prev) => !prev)
  const toggleMobile = () => setMobileOpen((prev) => !prev)
  const closeMobile = () => setMobileOpen(false)

  // Body scroll lock khi mobile sidebar mở
  useEffect(() => {
    if (typeof document === "undefined") return
    if (mobileOpen) {
      const original = document.body.style.overflow
      document.body.style.overflow = "hidden"
      return () => {
        document.body.style.overflow = original
      }
    }
  }, [mobileOpen])

  // ESC để đóng mobile sidebar
  useEffect(() => {
    if (!mobileOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [mobileOpen])

  return (
    <SidebarContext.Provider
      value={{
        collapsed,
        setCollapsed,
        toggle,
        mobileOpen,
        setMobileOpen,
        toggleMobile,
        closeMobile,
      }}
    >
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  return useContext(SidebarContext)
}
