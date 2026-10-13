import type { ReactNode } from "react"
import Link from "next/link"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { ThemeProvider } from "@/components/theme-provider"
import { TRPCReactProvider } from "@/trpc/client"
import { getCachedGeneralSettings } from "@/services/settings.service"
import { isSetupComplete } from "@/services/setup.service"
import { verifyToken } from "@/services/auth.service"
import { AnimatedGridPattern } from "@/components/ui/animated-grid-pattern"
import { AuthBrandProvider } from "@/components/auth/auth-brand-context"
import { cn } from "@/lib/utils"

// Auth layout gating redirect /setup theo DB → phải chạy runtime mỗi request.
export const dynamic = "force-dynamic"

/* ── Duotone feature icons (branding panel) ── */
function ShieldDuo({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 01-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 011-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 011.52 0C14.51 3.81 17 5 19 5a1 1 0 011 1z" opacity=".5" />
      <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}
function RocketDuo({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z" opacity=".5" />
      <path d="M12 15l-3-3c1-4 4.5-7.5 10-9-1.5 5.5-5 9-9 12z" />
    </svg>
  )
}
function BoltDuo({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" opacity=".55" />
    </svg>
  )
}

const HIGHLIGHTS = [
  { Icon: ShieldDuo, title: "Bảo mật 2FA", desc: "Mã hóa & giám sát 24/7" },
  { Icon: RocketDuo, title: "Kích hoạt tức thì", desc: "Tự động ngay sau thanh toán" },
  { Icon: BoltDuo, title: "Uptime 99.9%", desc: "Hạ tầng ổn định, tốc độ cao" },
]

export default async function AuthLayout({ children }: { children: ReactNode }) {
  // Gate: chưa setup → redirect /setup
  const setupDone = await isSetupComplete()
  if (!setupDone) {
    redirect("/setup")
  }

  // Gate: đã đăng nhập → đẩy thẳng dashboard, không hiện form login/register.
  // Tránh user nhầm là "hết session" khi vào lại /authentication/login.
  // Lưu ý: redirect() throw NEXT_REDIRECT — phải gọi NGOÀI try/catch.
  const cookieStore = await cookies()
  const token = cookieStore.get("token")?.value
  let isAuthed = false
  if (token) {
    try {
      const payload = verifyToken(token)
      if (payload?.sub) isAuthed = true
    } catch {
      // Token hỏng/expired → cho qua, hiện form login để user đăng nhập lại.
    }
  }
  if (isAuthed) {
    redirect("/dashboard")
  }

  const site = await getCachedGeneralSettings()
  const title = site.siteTitle || "VanKhanh"
  const desc =
    site.siteDescription ||
    "Nền tảng cung cấp mã nguồn, hosting, tên miền và dịch vụ số uy tín."
  const logo = site.logoDark || site.logoLight || null

  return (
    <ThemeProvider>
      <AuthBrandProvider logo={logo} title={title}>
        <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
          {/* ── Left: Form area ── */}
          <main className="relative flex flex-col items-center justify-center bg-background px-6 py-10 md:px-10">
            {/* subtle top accent bar */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-violet-500 to-primary/0" />

            <div className="relative z-10 w-full max-w-md">
              <TRPCReactProvider>{children}</TRPCReactProvider>
            </div>

            <p className="relative z-10 mt-10 text-center text-xs text-muted-foreground">
              © {new Date().getFullYear()} {title}. Bảo lưu mọi quyền.
            </p>
          </main>

          {/* ── Right: Branding panel with animated grid ── */}
          <aside className="relative hidden flex-col justify-between overflow-hidden bg-zinc-950 p-12 text-white lg:flex xl:p-16">
            {/* Animated grid background */}
            <AnimatedGridPattern
              numSquares={40}
              maxOpacity={0.35}
              duration={3}
              repeatDelay={0.8}
              width={48}
              height={48}
              className={cn(
                "inset-0 h-full w-full skew-y-0 fill-primary/25 stroke-primary/25",
                "[mask-image:radial-gradient(600px_circle_at_center,white,transparent)]"
              )}
            />
            {/* Color wash */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/25 via-transparent to-violet-500/20" />
              <div className="absolute -top-24 -right-24 size-[420px] rounded-full bg-primary/20 blur-[130px]" />
              <div className="absolute -bottom-32 -left-24 size-[420px] rounded-full bg-violet-500/15 blur-[130px]" />
            </div>

            {/* Top: logo */}
            <div className="relative z-10">
              <Link href="/" className="inline-flex items-center gap-2">
                {logo ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={logo} alt={title} className="h-10 w-auto" />
                ) : (
                  <span className="text-xl font-extrabold tracking-tight text-white">{title}</span>
                )}
              </Link>
            </div>

            {/* Middle: headline + highlights */}
            <div className="relative z-10 space-y-10">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-300 backdrop-blur-sm">
                  <span className="size-1.5 rounded-full bg-emerald-400" />
                  Nền tảng dịch vụ số #1
                </span>
                <h2 className="mt-5 text-3xl font-bold leading-tight xl:text-4xl">
                  Mọi dịch vụ số,
                  <br />
                  <span className="bg-gradient-to-r from-primary to-violet-400 bg-clip-text text-transparent">
                    trong một nền tảng.
                  </span>
                </h2>
                <p className="mt-4 max-w-md text-sm leading-relaxed text-zinc-400">{desc}</p>
              </div>

              <ul className="space-y-4">
                {HIGHLIGHTS.map((h, i) => (
                  <li key={i} className="flex items-center gap-4">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
                      <h.Icon className="size-6 text-primary" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white">{h.title}</h4>
                      <p className="text-xs text-zinc-400">{h.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Bottom: quote */}
            <div className="relative z-10">
              <blockquote className="border-l-2 border-primary/50 pl-4">
                <p className="text-sm italic text-zinc-300">
                  &ldquo;Hệ thống ổn định, thanh toán nhanh, giao hàng tức thì.&rdquo;
                </p>
                <footer className="mt-2 text-xs text-zinc-500">— Hàng nghìn khách hàng tin dùng</footer>
              </blockquote>
            </div>
          </aside>
        </div>
      </AuthBrandProvider>
    </ThemeProvider>
  )
}
