"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/client"
import { useSidebar } from "@/components/sidebar-context"
import {
  IconDashboard,
  IconLogout,
  IconEnvelope as IconContact,
  IconDollarCircle as IconAffiliate,
  IconShield as IconSecurity,
  IconCreditCard as IconDeposit,
  IconBracketsCurly as IconSourceCode,
  IconDocument as IconNews,
  IconTicket,
  IconMonitor as IconWebsite,
  IconBrush as IconLogo,
  IconClock as IconCronjob,
  IconLink as IconDomain,
  IconQuestionCircle as IconFAQ,
} from "@/components/icons"

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  badge?: number
  children?: { label: string; href: string }[]
}

interface NavGroup {
  title: string
  items: NavItem[]
}

const navigation: NavGroup[] = [
  {
    title: "DASHBOARD",
    items: [
      { label: "Trang chủ", href: "/dashboard", icon: IconDashboard },
    ],
  },
  {
    title: "SERVICES",
    items: [
      {
        label: "Mã Nguồn",
        href: "/source-code",
        icon: IconSourceCode,
        children: [
          { label: "Danh sách mã nguồn", href: "/source-code" },
          { label: "Mã nguồn đã mua", href: "/customer/history/code" },
        ],
      },
      {
        label: "Tên Miền",
        href: "/domain",
        icon: IconDomain,
        children: [
          { label: "Đăng ký tên miền", href: "/domain" },
          { label: "Tên miền đã mua", href: "/customer/history/domain" },
        ],
      },
      {
        label: "Cronjob",
        href: "/cronjob",
        icon: IconCronjob,
        children: [
          { label: "Tạo Cronjob", href: "/cronjob" },
          { label: "Cronjob đang chạy", href: "/customer/history/cronjob" },
        ],
      },
      {
        label: "Tạo Logo",
        href: "/create-logo",
        icon: IconLogo,
        children: [
          { label: "Thuê logo mẫu", href: "/create-logo" },
          { label: "Logo đã thuê", href: "/customer/history/logo" },
        ],
      },
      {
        label: "Tạo Website",
        href: "/create-website",
        icon: IconWebsite,
        children: [
          { label: "Tạo website mới", href: "/create-website" },
          { label: "Website đã tạo", href: "/customer/history/website" },
        ],
      },
    ],
  },
  {
    title: "CUSTOMER",
    items: [
      {
        label: "Nạp tiền",
        href: "/customer/deposit",
        icon: IconDeposit,
        children: [
          { label: "Nạp thẻ cào", href: "/customer/card" },
          { label: "Nạp ngân hàng", href: "/customer/deposit" },
        ],
      },
      {
        label: "Tiếp thị liên kết",
        href: "/customer/affiliate",
        icon: IconAffiliate,
        children: [
          { label: "Thống kê", href: "/customer/affiliate" },
          { label: "Lịch sử hoa hồng", href: "/customer/history/affiliate" },
          { label: "Rút tiền", href: "/customer/withdraw/affiliate" },
        ],
      },
      {
        label: "Vé hỗ trợ",
        href: "/customer/history/ticket",
        icon: IconTicket,
        children: [
          { label: "Tạo vé mới", href: "/ticket/create" },
          { label: "Lịch sử vé", href: "/customer/history/ticket" },
        ],
      },
    ],
  },
  {
    title: "OTHERS",
    items: [
      { label: "Tài liệu API", href: "/document-api", icon: IconSourceCode },
      { label: "Tin Tức", href: "/blogs", icon: IconNews },
      { label: "FAQ", href: "/faq", icon: IconFAQ },
      { label: "Liên Hệ", href: "/contact", icon: IconContact },
    ],
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const trpc = useTRPC()
  const { data: siteInfo } = useQuery(trpc.public.siteInfo.queryOptions())
  const { collapsed, mobileOpen, closeMobile, toggle } = useSidebar()
  const isCollapsed = collapsed && !mobileOpen
  const [isMounted, setIsMounted] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const groups: Record<string, boolean> = {}
    navigation.forEach((g) => { groups[g.title] = true })
    return groups
  })
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    for (const group of navigation) {
      for (const item of group.items) {
        if (item.children) {
          const isChildActive = item.children.some((c) => pathname === c.href || pathname.startsWith(c.href + "/"))
          if (isChildActive || pathname === item.href || pathname.startsWith(item.href + "/")) {
            setOpenSubmenu((prev) => prev ?? item.href)
            return
          }
        }
      }
    }
  }, [pathname])

  // Auto-close mobile drawer khi route thay đổi
  useEffect(() => {
    if (mobileOpen) closeMobile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  if (!isMounted) {
    return <aside className="dark fixed ltr:left-0 rtl:right-0 top-0 z-40 hidden h-screen w-[260px] flex-col border-e border-sidebar-border bg-sidebar lg:flex" suppressHydrationWarning />
  }

  const toggleGroup = (title: string) => {
    setOpenGroups((prev) => ({ ...prev, [title]: !prev[title] }))
  }

  const toggleSubmenu = (href: string) => {
    // Accordion: close current if same, otherwise open new and close old
    setOpenSubmenu((prev) => (prev === href ? null : href))
  }

  return (
    <>
      {/* Backdrop overlay (mobile only) — tách ra ngoài aside để phủ toàn màn hình */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Đóng menu"
          onClick={() => closeMobile()}
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm lg:hidden animate-in fade-in duration-200"
        />
      )}

      <aside
        className={`dark fixed ltr:left-0 rtl:right-0 top-0 z-50 h-screen flex-col border-e border-sidebar-border bg-sidebar shadow-2xl transition-transform duration-300 ease-in-out w-[260px] ${
          mobileOpen ? "flex translate-x-0" : "flex -translate-x-full lg:translate-x-0"
        } lg:flex lg:shadow-none lg:z-40 ${isCollapsed ? "lg:w-[72px]" : "lg:w-[260px]"}`}
      >

      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
        <a href="/" className="relative block h-10 w-full overflow-hidden rounded-md">
          <img
            alt={siteInfo?.siteTitle || "VanKhanh"}
            className="h-10 w-auto object-contain"
            src={
              siteInfo?.logoDark ||
              siteInfo?.logoLight ||
              "https://cmstdev.vn/uploads/logo-0e7c1aeb-2d48-4a47-b178-da4c731cfd6f.png"
            }
          />
        </a>
      </div>

      {/* Navigation */}
      <nav role="navigation" aria-label="Main navigation" className="scrollbar-fade flex-1 space-y-3 overflow-y-auto px-3 py-4">
        {navigation.map((group) => (
          <div key={group.title}>
            {/* Group Header - collapsible */}
            <button
              onClick={() => toggleGroup(group.title)}
              className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/30 transition-colors hover:text-sidebar-foreground/70"
            >
              {!isCollapsed && <span className="flex-1 text-start">{group.title}</span>}
              {!isCollapsed && (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`size-3 transition-transform duration-200 ${openGroups[group.title] ? "rotate-90" : ""}`} aria-hidden="true">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              )}
            </button>

            {/* Group Items */}
            <div className={`grid transition-all duration-200 ease-in-out ${openGroups[group.title] ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
              <div className="overflow-hidden">
                <div className="mt-1 space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname === item.href
                    const hasChildren = item.children && item.children.length > 0
                    const isSubmenuOpen = openSubmenu === item.href

                    return (
                      <div key={item.href}>
                        {hasChildren ? (
                          <button
                            onClick={() => toggleSubmenu(item.href)}
                            className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${isSubmenuOpen || isActive
                                ? "bg-sidebar-accent text-sidebar-primary"
                                : "text-sidebar-foreground/90 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                              }`}
                          >
                            {(isSubmenuOpen || isActive) && (
                              <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-sidebar-primary" />
                            )}
                            <Icon
                              size={18}
                              className={`h-[18px] w-[18px] shrink-0 transition-colors ${isSubmenuOpen || isActive ? "text-sidebar-primary" : "text-sidebar-foreground/70 group-hover:text-sidebar-foreground/80"
                                }`}
                            />
                            {!isCollapsed && <span className="flex-1 text-start">{item.label}</span>}
                            {!isCollapsed && (
                              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`size-3.5 transition-transform duration-200 ${isSubmenuOpen ? "rotate-90" : ""}`} aria-hidden="true">
                                <path d="m9 18 6-6-6-6" />
                              </svg>
                            )}
                          </button>
                        ) : (
                          <Link
                            href={item.href}
                            
                            aria-current={isActive ? "page" : undefined}
                            className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${isActive
                                ? "bg-sidebar-accent text-sidebar-primary"
                                : "text-sidebar-foreground/90 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                              }`}
                          >
                            {isActive && (
                              <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-sidebar-primary" />
                            )}
                            <Icon
                              size={18}
                              className={`h-[18px] w-[18px] shrink-0 transition-colors ${isActive ? "text-sidebar-primary" : "text-sidebar-foreground/70 group-hover:text-sidebar-foreground/80"
                                }`}
                            />
                            {!isCollapsed && <span className="flex-1">{item.label}</span>}
                            {!isCollapsed && item.badge && (
                              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-sidebar-primary/15 px-1.5 text-[10px] font-semibold text-sidebar-primary">
                                {item.badge}
                              </span>
                            )}
                          </Link>
                        )}

                        {/* Submenu */}
                        {hasChildren && !isCollapsed && (
                          <div className={`grid transition-all duration-200 ease-in-out ${isSubmenuOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                            <div className="overflow-hidden">
                              <div className="mt-0.5 space-y-0.5 ps-[30px]">
                                {item.children!.map((child) => {
                                  const isChildActive = pathname === child.href
                                  return (
                                    <Link
                                      key={child.href}
                                      href={child.href}
                                      
                                      className={`block rounded-md px-3 py-1.5 text-[13px] transition-colors ${isChildActive
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
                  })}
                </div>
              </div>
            </div>
          </div>
        ))}
      </nav>



      {/* Collapse Toggle Button */}
      <button
        aria-label="Collapse sidebar"
        onClick={() => toggle()}
        className="absolute ltr:-right-3 rtl:-left-3 top-20 hidden h-6 w-6 lg:flex items-center justify-center rounded-full border border-border bg-card text-foreground shadow-md transition-all hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`h-3.5 w-3.5 transition-transform duration-300 ${isCollapsed ? "ltr:rotate-180 rtl:rotate-0" : "ltr:rotate-0 rtl:rotate-180"}`} aria-hidden="true">
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>
      </aside>
    </>
  )
}
