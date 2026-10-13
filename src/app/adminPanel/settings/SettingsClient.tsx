"use client"

import * as React from "react"
import { useTRPC } from "@/trpc/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@/components/ui/toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { ImagePicker } from "@/components/admin/image-picker"
import { ColorPicker } from "@/components/editor/color-picker"
import { FontPicker } from "@/components/editor/font-picker"
import { IconBrush, IconCheck, IconEnvelope, IconLoader, IconShield, IconBell, IconDollarCircle, IconDatabase, IconQuestionCircle, IconClock } from "@/components/icons"
import { cn } from "@/lib/utils"
import { SecurityTab } from "./SecurityTab"
import { RewardsTab } from "./RewardsTab"
import { RedisTab } from "./RedisTab"
import { AiTab } from "./AiTab"
import { CronjobTab } from "./CronjobTab"
import { StorageTab } from "./StorageTab"

type TabKey = "identity" | "visuals" | "contact" | "security" | "rewards" | "redis" | "ai" | "cronjob" | "storage"
const TABS: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
  { key: "identity", label: "Thông tin", icon: <IconShield size={16} /> },
  { key: "visuals", label: "Giao diện", icon: <IconBrush size={16} /> },
  { key: "contact", label: "Liên hệ", icon: <IconEnvelope size={16} /> },
  { key: "rewards", label: "Điểm thưởng", icon: <IconDollarCircle size={16} /> },
  { key: "security", label: "Bảo mật", icon: <IconBell size={16} /> },
  { key: "storage", label: "Lưu trữ", icon: <IconDatabase size={16} /> },
  { key: "redis", label: "Redis", icon: <IconDatabase size={16} /> },
  { key: "cronjob", label: "Cronjob", icon: <IconClock size={16} /> },
  { key: "ai", label: "Trợ lý AI", icon: <IconQuestionCircle size={16} /> },
]

// ─── Card wrapper ──────────────────────────────────────────────────────────
function SettingsCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="space-y-6 p-6">{children}</div>
    </div>
  )
}

// ─── Field wrapper ─────────────────────────────────────────────────────────
function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string
  hint?: string
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function ChevronRight() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/50">
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

export function SettingsClient() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const settingsQuery = useQuery(trpc.admin.getGeneralSettings.queryOptions())
  const saveMutation = useMutation({
    ...trpc.admin.saveGeneralSettings.mutationOptions(),
    onSuccess: () => {
      toast.success("Đã lưu cài đặt")
      queryClient.invalidateQueries({ queryKey: trpc.admin.getGeneralSettings.queryOptions().queryKey })
    },
    onError: (err: any) => toast.error(err.message || "Lưu thất bại"),
  })

  const [activeTab, setActiveTab] = React.useState<TabKey>("identity")
  const [siteTitle, setSiteTitle] = React.useState("")
  const [siteDomain, setSiteDomain] = React.useState("")
  const [siteDescription, setSiteDescription] = React.useState("")
  const [siteKeywords, setSiteKeywords] = React.useState("")
  const [siteAuthor, setSiteAuthor] = React.useState("")
  const [adminEmail, setAdminEmail] = React.useState("")
  const [adminHotline, setAdminHotline] = React.useState("")
  const [adminFanpage, setAdminFanpage] = React.useState("")
  const [adminZalo, setAdminZalo] = React.useState("")
  const [adminTelegram, setAdminTelegram] = React.useState("")
  const [adminName, setAdminName] = React.useState("")
  const [logoLight, setLogoLight] = React.useState("")
  const [logoDark, setLogoDark] = React.useState("")
  const [favicon, setFavicon] = React.useState("")
  const [ogImage, setOgImage] = React.useState("")
  const [ogDescription, setOgDescription] = React.useState("")
  const [themeColor, setThemeColor] = React.useState("")
  const [fontFamily, setFontFamily] = React.useState("")
  const [fontUrl, setFontUrl] = React.useState("")
  const [loaded, setLoaded] = React.useState(false)

  React.useEffect(() => {
    if (settingsQuery.data && !loaded) {
      const d = settingsQuery.data
      setSiteTitle(d.siteTitle)
      setSiteDomain(d.siteDomain)
      setSiteDescription(d.siteDescription)
      setSiteKeywords(d.siteKeywords)
      setSiteAuthor(d.siteAuthor)
      setAdminEmail(d.adminEmail)
      setAdminHotline(d.adminHotline)
      setAdminFanpage(d.adminFanpage)
      setAdminZalo(d.adminZalo)
      setAdminTelegram(d.adminTelegram)
      setAdminName(d.adminName)
      setLogoLight(d.logoLight)
      setLogoDark(d.logoDark)
      setFavicon(d.favicon)
      setOgImage(d.ogImage)
      setOgDescription(d.ogDescription)
      setThemeColor(d.themeColor)
      setFontFamily(d.fontFamily)
      setFontUrl(d.fontUrl)
      setLoaded(true)
    }
  }, [settingsQuery.data, loaded])

  const handleSave = React.useCallback(() => {
    saveMutation.mutate({
      siteTitle,
      siteDescription,
      siteKeywords,
      siteAuthor,
      adminEmail,
      adminHotline,
      adminFanpage,
      adminZalo,
      adminTelegram,
      adminName,
      logoLight,
      logoDark,
      favicon,
      ogImage,
      ogDescription,
      themeColor,
      fontFamily,
      fontUrl,
    })
  }, [siteTitle, siteDescription, siteKeywords, siteAuthor, adminEmail, adminHotline, adminFanpage, adminZalo, adminTelegram, adminName, logoLight, logoDark, favicon, ogImage, ogDescription, themeColor, fontFamily, fontUrl, saveMutation])

  if (settingsQuery.isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-9 w-56" />
        </div>
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-[420px] w-full rounded-xl" />
      </div>
    )
  }

  const activeTabDef = TABS.find((t) => t.key === activeTab)!

  return (
    <div className="space-y-6">
      {/* ─── Breadcrumb + Title ─── */}
      <div className="space-y-1">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <a href="/adminPanel/dashboard" className="transition-colors hover:text-foreground">
            Admin
          </a>
          <ChevronRight />
          <span>Hệ thống</span>
          <ChevronRight />
          <span className="font-normal text-foreground">Cài đặt chung</span>
        </nav>
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <IconShield size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Cài đặt chung</h1>
            <p className="text-sm text-muted-foreground">
              Quản lý SEO, hình ảnh thương hiệu, màu chủ đạo và font chữ.
            </p>
          </div>
        </div>
      </div>

      {/* ─── Tab Navigation ─── */}
      <nav className="border-b border-border">
        <ul className="flex flex-row flex-wrap items-center gap-2 pb-2 lg:flex-nowrap lg:overflow-x-auto">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <li key={tab.key}>
                <button
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-1.5 text-sm font-semibold transition-all duration-300 ease-in-out",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
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

      {/* ─── Section title + Save ─── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-primary">
          {activeTabDef.icon}
          <span className="text-lg font-bold uppercase tracking-wide text-foreground">
            {activeTabDef.label}
          </span>
        </div>
        {activeTab !== "security" && activeTab !== "rewards" && activeTab !== "redis" && activeTab !== "ai" && activeTab !== "cronjob" && activeTab !== "storage" && (
          <Button type="button" size="sm" onClick={handleSave} disabled={saveMutation.isPending} className="gap-2">
            {saveMutation.isPending ? <IconLoader size={16} className="animate-spin" /> : <IconCheck size={16} />}
            Lưu cấu hình
          </Button>
        )}
      </div>

      {/* ════════ THÔNG TIN ════════ */}
      {activeTab === "identity" && (
        <SettingsCard>
          <div className="grid gap-6 lg:grid-cols-2">
            <Field label="Tên website" htmlFor="siteTitle" hint="Dùng cho title template: Trang | Tên website">
              <Input id="siteTitle" value={siteTitle} onChange={(e) => setSiteTitle(e.target.value)} placeholder="VanKhanh" />
            </Field>
            <Field label="Domain" htmlFor="siteDomain" hint="Lấy từ .env NEXT_PUBLIC_APP_URL">
              <Input id="siteDomain" value={siteDomain} disabled className="bg-muted text-muted-foreground" />
            </Field>
          </div>

          <Field label="Mô tả" htmlFor="siteDescription" hint="Meta description mặc định cho website">
            <Textarea id="siteDescription" value={siteDescription} onChange={(e) => setSiteDescription(e.target.value)} placeholder="Mô tả website..." rows={3} />
          </Field>

          <div className="grid gap-6 lg:grid-cols-2">
            <Field label="Từ khóa SEO" htmlFor="siteKeywords" hint="Phân cách bằng dấu phẩy">
              <Input id="siteKeywords" value={siteKeywords} onChange={(e) => setSiteKeywords(e.target.value)} placeholder="website, mã nguồn, domain" />
            </Field>
            <Field label="Tác giả" htmlFor="siteAuthor" hint="Meta author">
              <Input id="siteAuthor" value={siteAuthor} onChange={(e) => setSiteAuthor(e.target.value)} placeholder="Tên công ty / tác giả" />
            </Field>
          </div>
        </SettingsCard>
      )}

      {/* ════════ HÌNH ẢNH & GIAO DIỆN ════════ */}
      {activeTab === "visuals" && (
        <SettingsCard>
          <div className="grid gap-6 lg:grid-cols-2">
            <Field label="Logo sáng (Light mode)" hint="Hiển thị khi dùng giao diện sáng">
              <ImagePicker value={logoLight} onChange={setLogoLight} bucket="site" aspect="logo" />
            </Field>
            <Field label="Logo tối (Dark mode)" hint="Hiển thị khi dùng giao diện tối">
              <ImagePicker value={logoDark} onChange={setLogoDark} bucket="site" aspect="logo" />
            </Field>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Field label="Favicon" hint="Icon tab trình duyệt (khuyến nghị 32×32 hoặc .ico)">
              <ImagePicker value={favicon} onChange={setFavicon} bucket="site" aspect="square" />
            </Field>
            <Field label="Ảnh chia sẻ (OG Image)" hint="Hiển thị khi chia sẻ link (khuyến nghị 1200×630)">
              <ImagePicker value={ogImage} onChange={setOgImage} bucket="site" aspect="wide" />
            </Field>
          </div>

          <Field label="Mô tả OG" htmlFor="ogDescription" hint="Mô tả khi chia sẻ link lên mạng xã hội">
            <Textarea id="ogDescription" value={ogDescription} onChange={(e) => setOgDescription(e.target.value)} placeholder="Mô tả khi chia sẻ link..." rows={3} />
          </Field>

          <div className="grid gap-6 lg:grid-cols-2">
            <Field label="Màu chủ đạo (Theme Color)" hint="Áp dụng cho toàn website và browser toolbar">
              <ColorPicker value={themeColor} onChange={setThemeColor} />
            </Field>
            <Field label="Font chữ" hint="Google Fonts, áp dụng toàn website">
              <FontPicker value={fontFamily} onValueChange={(val, url) => { setFontFamily(val); setFontUrl(url) }} />
            </Field>
          </div>
        </SettingsCard>
      )}

      {/* ════════ LIÊN HỆ ════════ */}
      {activeTab === "contact" && (
        <SettingsCard>
          <div className="grid gap-6 lg:grid-cols-2">
            <Field label="Email" htmlFor="adminEmail">
              <Input id="adminEmail" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="admin@example.com" />
            </Field>
            <Field label="Hotline" htmlFor="adminHotline">
              <Input id="adminHotline" value={adminHotline} onChange={(e) => setAdminHotline(e.target.value)} placeholder="0123 456 789" />
            </Field>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Field label="Fanpage" htmlFor="adminFanpage">
              <Input id="adminFanpage" value={adminFanpage} onChange={(e) => setAdminFanpage(e.target.value)} placeholder="https://facebook.com/..." />
            </Field>
            <Field label="Zalo" htmlFor="adminZalo">
              <Input id="adminZalo" value={adminZalo} onChange={(e) => setAdminZalo(e.target.value)} placeholder="Zalo OA hoặc số Zalo" />
            </Field>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Field label="Telegram" htmlFor="adminTelegram">
              <Input id="adminTelegram" value={adminTelegram} onChange={(e) => setAdminTelegram(e.target.value)} placeholder="@username hoặc link Telegram" />
            </Field>
            <Field label="Tên Admin" htmlFor="adminName">
              <Input id="adminName" value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Tên người quản trị" />
            </Field>
          </div>
        </SettingsCard>
      )}

      {/* ════════ ĐIỂM THƯỞNG ════════ */}
      {activeTab === "rewards" && <RewardsTab />}

      {/* ════════ BẢO MẬT ════════ */}
      {activeTab === "security" && <SecurityTab />}

      {/* ════════ REDIS ════════ */}
      {activeTab === "redis" && <RedisTab />}

      {/* ════════ AI ASSISTANT ════════ */}
      {activeTab === "ai" && <AiTab />}

      {/* ════════ CRONJOB ════════ */}
      {activeTab === "cronjob" && <CronjobTab />}

      {/* ════════ LƯU TRỮ ════════ */}
      {activeTab === "storage" && <StorageTab />}
    </div>
  )
}
