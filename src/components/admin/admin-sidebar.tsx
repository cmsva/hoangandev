"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSidebar } from "@/components/sidebar-context"
import {
  getAdminGroupedSections,
  adminActivePath,
  type AdminNavSection,
} from "./admin-menu-config"

export function AdminSidebar() {
  const pathname = usePathname()
  const { collapsed, mobileOpen, closeMobile, toggle } = useSidebar()
  const isCollapsed = collapsed && !mobileOpen
  const groups = useMemo(() => getAdminGroupedSections(), [])

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {}
    groups.forEach((g) => (map[g.group] = true))
    return map
  })

  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null)

  useEffect(() => {
    for (const g of groups) {
      for (const item of g.items) {
        if (item.items?.some((c) => adminActivePath(pathname, c.href, c.exact))) {
          setOpenSubmenu((prev) => prev ?? item.label)
          return
        }
      }
    }
  }, [groups, pathname])

  const toggleGroup = (title: string) => {
    setOpenGroups((p) => ({ ...p, [title]: !p[title] }))
  }
  const toggleSubmenu = (label: string) => {
    setOpenSubmenu((prev) => (prev === label ? null : label))
  }

  return (
    <aside
      className={`dark fixed ltr:left-0 rtl:right-0 top-0 z-40 h-screen flex-col border-e border-sidebar-border bg-sidebar shadow-xl transition-all duration-300 ease-in-out ${
        mobileOpen ? "flex w-[260px]" : "hidden w-[260px]"
      } lg:flex lg:shadow-none ${isCollapsed ? "lg:w-[72px]" : "lg:w-[260px]"}`}
    >
      {mobileOpen && (
        <button
          type="button"
          aria-label="Đóng menu"
          onClick={() => closeMobile()}
          className="fixed inset-0 -z-10 bg-background/80 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
        <Link
          href="/adminPanel/dashboard"
          className="flex items-center gap-2 overflow-hidden"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-sidebar-primary/15 text-sidebar-primary">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 18 18"
              fill="none"
            >
              <path
                d="M9 1.5L3 4.5V9c0 4.5 6 7.5 6 7.5s6-3 6-7.5V4.5L9 1.5z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
                opacity="0.4"
              />
              <path
                d="M6.5 9L8 10.5L11.5 7"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          {!isCollapsed && (
            <div className="leading-tight overflow-hidden">
              <p className="text-[13px] font-bold tracking-tight">Admin Panel</p>
              <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-wider">
                Control Center
              </p>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav
        role="navigation"
        aria-label="Admin navigation"
        className="scrollbar-fade flex-1 space-y-3 overflow-y-auto px-3 py-4"
      >
        {groups.map(({ group, items }) => (
          <div key={group}>
            <button
              onClick={() => toggleGroup(group)}
              className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/30 transition-colors hover:text-sidebar-foreground/70"
            >
              {!isCollapsed && <span className="flex-1 text-start">{group}</span>}
              {!isCollapsed && (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`size-3 transition-transform duration-200 ${
                    openGroups[group] ? "rotate-90" : ""
                  }`}
                  aria-hidden="true"
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              )}
            </button>

            <div
              className={`grid transition-all duration-200 ease-in-out ${
                openGroups[group]
                  ? "grid-rows-[1fr] opacity-100"
                  : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <div className="mt-1 space-y-0.5">
                  {items.map((section: AdminNavSection) => {
                    const Icon = section.icon
                    const hasChildren = !!section.items?.length
                    const isSubmenuOpen = openSubmenu === section.label
                    const directHrefMatch = section.href
                      ? adminActivePath(pathname, section.href)
                      : false
                    const childMatch = hasChildren
                      ? section.items!.some((c) =>
                          adminActivePath(pathname, c.href, c.exact)
                        )
                      : false
                    const isActive = directHrefMatch || childMatch

                    if (hasChildren) {
                      return (
                        <div key={section.label}>
                          <button
                            onClick={() => toggleSubmenu(section.label)}
                            className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                              isSubmenuOpen || isActive
                                ? "bg-sidebar-accent text-sidebar-primary"
                                : "text-sidebar-foreground/90 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                            }`}
                          >
                            {(isSubmenuOpen || isActive) && (
                              <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-sidebar-primary" />
                            )}
                            {Icon && (
                              <Icon
                                size={18}
                                className={`h-[18px] w-[18px] shrink-0 transition-colors ${
                                  isSubmenuOpen || isActive
                                    ? "text-sidebar-primary"
                                    : "text-sidebar-foreground/70 group-hover:text-sidebar-foreground/80"
                                }`}
                              />
                            )}
                            {!isCollapsed && (
                              <span className="flex-1 text-start">
                                {section.label}
                              </span>
                            )}
                            {!isCollapsed && (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className={`size-3.5 transition-transform duration-200 ${
                                  isSubmenuOpen ? "rotate-90" : ""
                                }`}
                                aria-hidden="true"
                              >
                                <path d="m9 18 6-6-6-6" />
                              </svg>
                            )}
                          </button>

                          {!isCollapsed && (
                            <div
                              className={`grid transition-all duration-200 ease-in-out ${
                                isSubmenuOpen
                                  ? "grid-rows-[1fr] opacity-100"
                                  : "grid-rows-[0fr] opacity-0"
                              }`}
                            >
                              <div className="overflow-hidden">
                                <div className="mt-0.5 space-y-0.5 ps-[30px]">
                                  {section.items!.map((child) => {
                                    const childActive = adminActivePath(
                                      pathname,
                                      child.href,
                                      child.exact
                                    )
                                    return (
                                      <Link
                                        key={child.href}
                                        href={child.href}
                                        className={`block rounded-md px-3 py-1.5 text-[13px] transition-colors ${
                                          childActive
                                            ? "text-sidebar-primary font-medium"
                                            : "text-sidebar-foreground/70 hover:text-sidebar-foreground/80"
                                        }`}
                                      >
                                        {child.label}
                                      </Link>
                                    )
                                  })}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    }

                    return (
                      <Link
                        key={section.label}
                        href={section.href || "/adminPanel/dashboard"}
                        aria-current={isActive ? "page" : undefined}
                        className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                          isActive
                            ? "bg-sidebar-accent text-sidebar-primary"
                            : "text-sidebar-foreground/90 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                        }`}
                      >
                        {isActive && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-sidebar-primary" />
                        )}
                        {Icon && (
                          <Icon
                            size={18}
                            className={`h-[18px] w-[18px] shrink-0 transition-colors ${
                              isActive
                                ? "text-sidebar-primary"
                                : "text-sidebar-foreground/70 group-hover:text-sidebar-foreground/80"
                            }`}
                          />
                        )}
                        {!isCollapsed && (
                          <span className="flex-1">{section.label}</span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        ))}
      </nav>

      {/* Back to user panel */}
      {!isCollapsed && (
        <div className="border-t border-sidebar-border p-3">
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-2 rounded-lg bg-sidebar-accent/30 px-3 py-2 text-xs font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            ← Quay lại trang người dùng
          </Link>
        </div>
      )}

      {/* Collapse Toggle */}
      <button
        aria-label="Collapse sidebar"
        onClick={() => toggle()}
        className="absolute ltr:-right-3 rtl:-left-3 top-20 hidden h-6 w-6 lg:flex items-center justify-center rounded-full border border-border bg-card text-foreground shadow-md transition-all hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-3.5 w-3.5 transition-transform duration-300 ${
            isCollapsed ? "ltr:rotate-180 rtl:rotate-0" : "ltr:rotate-0 rtl:rotate-180"
          }`}
          aria-hidden="true"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>
    </aside>
  )
}
