"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/client"
import { cn } from "@/lib/utils"
import { LoginTab } from "./_tabs/LoginTab"
import { NotificationTab } from "./_tabs/NotificationTab"
import { CaptchaTab } from "./_tabs/CaptchaTab"
import { MailTemplateTab } from "./_tabs/MailTemplateTab"
import { TelegramTemplateTab } from "./_tabs/TelegramTemplateTab"

type TabKey = "login" | "notification" | "captcha" | "mail" | "telegram"

const TABS: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
  {
    key: "login",
    label: "ĐĂNG NHẬP",
    icon: (
      <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
        <path d="M12.4216 2.75L7.27299 7.8984C6.9446 7.8112 6.6059 7.75 6.25 7.75C4.0408 7.75 2.25 9.5408 2.25 11.75C2.25 13.9592 4.0408 15.75 6.25 15.75C8.4592 15.75 10.25 13.959 10.25 11.75C10.25 11.394 10.1887 11.0554 10.1014 10.7271L12.25 8.5789V6.5074H14.321L15.25 5.5784V2.75H12.4216Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="6.4" cy="11.6" r="1" fill="currentColor" />
      </svg>
    ),
  },
  {
    key: "notification",
    label: "THÔNG BÁO",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
    ),
  },
  {
    key: "captcha",
    label: "CAPTCHA",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    key: "mail",
    label: "MAIL TEMPLATE",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m2 7 10 6 10-6" />
      </svg>
    ),
  },
  {
    key: "telegram",
    label: "TELEGRAM TEMPLATE",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
      </svg>
    ),
  },
]

export function ExtensionsClient() {
  const trpc = useTRPC()
  const [activeTab, setActiveTab] = React.useState<TabKey>("login")

  // OAuth query — already prefetched in RSC
  const oauthQ = useQuery(trpc.adminExtensions.getOAuthConfig.queryOptions())

  return (
    <div className="space-y-6">
      {/* Breadcrumb + heading */}
      <div className="space-y-1">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <a href="/adminPanel/dashboard" className="transition-colors hover:text-foreground">Admin</a>
          <ChevronRight />
          <span className="text-foreground">Tiện ích mở rộng</span>
        </nav>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-violet-500/15 text-violet-600">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Tiện ích mở rộng</h1>
            <p className="text-sm text-muted-foreground">
              Phương thức đăng nhập, captcha, kênh thông báo và template tin nhắn.
            </p>
          </div>
        </div>
      </div>

      {/* Tab nav */}
      <nav className="border-b border-border">
        <ul className="-mb-px flex flex-wrap items-center gap-1">
          {TABS.map((tab) => {
            const active = activeTab === tab.key
            return (
              <li key={tab.key}>
                <button
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm font-bold uppercase tracking-wide transition-all",
                    active
                      ? "border-b-2 border-primary text-primary"
                      : "border-b-2 border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Tab content */}
      <div>
        {activeTab === "login" && <LoginTab oauthConfig={oauthQ.data} isLoading={oauthQ.isLoading} />}
        {activeTab === "notification" && <NotificationTab />}
        {activeTab === "captcha" && <CaptchaTab />}
        {activeTab === "mail" && <MailTemplateTab />}
        {activeTab === "telegram" && <TelegramTemplateTab />}
      </div>
    </div>
  )
}

function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/50">
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}
