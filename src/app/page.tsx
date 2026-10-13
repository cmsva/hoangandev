import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { isSetupComplete } from "@/services/setup.service"
import { getCachedGeneralSettings } from "@/services/settings.service"
import { getLandingStats } from "@/services/landing.service"
import { getCachedSiteNotifications } from "@/services/site-notification.service"
import { LandingPage } from "@/components/landing/LandingPage"

// Trang chủ gating redirect /setup theo DB → BẮT BUỘC chạy runtime mỗi request.
// Nếu để prerender static, quyết định redirect bị đóng băng lúc build → setup loop.
export const dynamic = "force-dynamic"

/**
 * Landing metadata: title gốc (không qua template "%s | Site").
 * Description + keywords lấy động từ admin General Settings.
 */
export async function generateMetadata(): Promise<Metadata> {
  const site = await getCachedGeneralSettings().catch(() => null)
  const title = site?.siteTitle || "Trang chủ"
  const description =
    site?.siteDescription ||
    "Nền tảng cung cấp dịch vụ số chuyên nghiệp."

  return {
    // `absolute` bypass parent template `%s | siteTitle`
    title: { absolute: title },
    description,
    keywords: site?.siteKeywords || undefined,
    openGraph: {
      title,
      description,
      ...(site?.ogImage ? { images: [{ url: site.ogImage }] } : {}),
    },
  }
}

export default async function HomePage() {
  // Lần đầu deploy → redirect setup wizard
  const setupDone = await isSetupComplete()
  if (!setupDone) {
    redirect("/setup")
  }

  const [site, stats, notifications] = await Promise.all([
    getCachedGeneralSettings(),
    getLandingStats(),
    getCachedSiteNotifications().catch(() => null),
  ])

  return <LandingPage site={site} stats={stats} notifications={notifications} />
}
