import type { Metadata } from "next"
import { Montserrat } from "next/font/google"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toast"
import NextTopLoader from "nextjs-toploader"
import { GoogleTranslateInit } from "@/components/google-translate-init"
import { HydrationAttributeCleaner } from "@/components/hydration-attribute-cleaner"
import { getSecurityConfig } from "@/lib/security-config"
import { getCachedGeneralSettings } from "@/services/settings.service"

import "./globals.css"

const montserrat = Montserrat({ subsets: ["latin", "vietnamese"], variable: "--font-sans" })

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getCachedGeneralSettings().catch(() => null)

  const siteTitle = settings?.siteTitle || "VanKhanh"
  const description = settings?.siteDescription || "Quản lý dịch vụ mã nguồn, website, logo, cronjob, tên miền."
  const ogDescription = settings?.ogDescription || description

  return {
    metadataBase: new URL(appUrl),
    title: {
      default: siteTitle,
      template: `%s | ${siteTitle}`,
    },
    description,
    keywords: settings?.siteKeywords || undefined,
    authors: settings?.siteAuthor ? [{ name: settings.siteAuthor }] : undefined,
    icons: settings?.favicon ? { icon: settings.favicon } : undefined,
    openGraph: {
      title: siteTitle,
      description: ogDescription,
      url: appUrl,
      siteName: siteTitle,
      images: settings?.ogImage ? [{ url: settings.ogImage }] : undefined,
      locale: "vi_VN",
      type: "website",
    },
  }
}

export async function generateViewport() {
  const settings = await getCachedGeneralSettings().catch(() => null)
  return {
    themeColor: settings?.themeColor || "#6366f1",
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Maintenance mode + site settings
  const [cfg, siteSettings] = await Promise.all([
    getSecurityConfig().catch(() => null),
    getCachedGeneralSettings().catch(() => null),
  ])
  if (cfg?.maintenanceMode) {
    const h = await headers()
    const pathname = h.get("x-pathname") || "/"
    // Cho phép /maintenance, /api, /_next, static
    const isAllowed =
      pathname.startsWith("/maintenance") ||
      pathname.startsWith("/api") ||
      pathname.startsWith("/_next") ||
      pathname.startsWith("/adminPanel") ||
      pathname.startsWith("/authentication")
    if (!isAllowed) {
      // Admin được vào để tắt maintenance — fetch session lazy
      const { getSession } = await import("@/lib/session")
      const session = await getSession().catch(() => null)
      if (!session || session.admin !== 1) {
        redirect("/maintenance")
      }
    }
  }

  const themeColor = siteSettings?.themeColor || ""
  const fontFamily = siteSettings?.fontFamily || ""
  const siteTitle = siteSettings?.siteTitle || "VanKhanh"

  const bodyStyle = {
    ...(fontFamily ? { fontFamily } : {}),
    ...(themeColor ? { "--theme-color": themeColor } : {}),
  } as React.CSSProperties

  // Override brand color tokens from DB (chỉ khi admin đã cấu hình)
  const colorOverrideCss = themeColor
    ? `:root{--primary:${themeColor};--ring:${themeColor};--sidebar-primary:${themeColor};--sidebar-ring:${themeColor};--chart-1:${themeColor};}` +
      `.dark{--primary:${themeColor};--ring:${themeColor};--sidebar-primary:${themeColor};--sidebar-ring:${themeColor};--chart-1:${themeColor};}`
    : ""

  // Organization JSON-LD cho SEO
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteTitle,
    url: appUrl,
    ...(siteSettings?.logoLight ? { logo: siteSettings.logoLight } : {}),
    ...(siteSettings?.siteDescription ? { description: siteSettings.siteDescription } : {}),
    ...(siteSettings?.adminEmail || siteSettings?.adminHotline
      ? {
          contactPoint: {
            "@type": "ContactPoint",
            ...(siteSettings?.adminEmail ? { email: siteSettings.adminEmail } : {}),
            ...(siteSettings?.adminHotline ? { telephone: siteSettings.adminHotline } : {}),
            contactType: "customer support",
          },
        }
      : {}),
    ...(siteSettings?.adminFanpage ? { sameAs: [siteSettings.adminFanpage] } : {}),
  }

  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <HydrationAttributeCleaner />
        {siteSettings?.fontUrl ? <link rel="stylesheet" href={siteSettings.fontUrl} /> : null}
        {colorOverrideCss ? <style dangerouslySetInnerHTML={{ __html: colorOverrideCss }} /> : null}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${montserrat.variable} font-sans antialiased`} style={bodyStyle} suppressHydrationWarning>
        <NextTopLoader
          color="oklch(0.65 0.19 160)"
          height={3}
          showSpinner={true}
          shadow="0 0 10px oklch(0.65 0.19 160), 0 0 5px oklch(0.65 0.19 160)"
        />
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
        <GoogleTranslateInit />
      </body>
    </html>
  )
}
