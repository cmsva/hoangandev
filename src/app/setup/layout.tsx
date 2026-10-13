import { TRPCReactProvider } from "@/trpc/client"
import { ThemeProvider } from "@/components/theme-provider"

/**
 * Layout độc lập cho trang setup. Không sidebar, không session — DB còn rỗng.
 */
export default function SetupLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <TRPCReactProvider>{children}</TRPCReactProvider>
    </ThemeProvider>
  )
}
