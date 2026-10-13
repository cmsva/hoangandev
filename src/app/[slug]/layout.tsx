import { TRPCReactProvider } from "@/trpc/client"
import { ThemeProvider } from "@/components/theme-provider"

/**
 * Layout cho trang tĩnh — KHÔNG dùng sidebar/dashboard shell.
 * Chỉ cần TRPC + ThemeProvider để StaticPageClient gọi siteInfo + toggle theme.
 */
export default function StaticPageLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ThemeProvider>
      <TRPCReactProvider>{children}</TRPCReactProvider>
    </ThemeProvider>
  )
}
