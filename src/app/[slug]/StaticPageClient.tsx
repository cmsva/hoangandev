"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { useTRPC } from "@/trpc/client"
import { useQuery } from "@tanstack/react-query"
import { sanitizeRichHtml } from "@/lib/sanitize"

/**
 * Standalone Static Page renderer — KHÔNG sidebar / dashboard header.
 *
 * Layout độc lập (giống pattern Levuphong):
 *   - Top bar: logo + theme toggle + dashboard link
 *   - Hero block: breadcrumb + title + description sát nhau, canh giữa
 *   - Content: prose centered, max-width vừa đọc
 *   - Footer nhỏ: copyright + link nhanh
 */
export function StaticPageClient({
  title,
  description,
  content,
}: {
  title: string
  description: string | null
  content: string
}) {
  const trpc = useTRPC()
  const { data: site } = useQuery(trpc.public.siteInfo.queryOptions())
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const siteTitle = site?.siteTitle || "VanKhanh"
  const logoLight = site?.logoLight || ""
  const logoDark = site?.logoDark || logoLight
  const logo = mounted && resolvedTheme === "dark" ? logoDark : logoLight

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* ─── Top Bar ─── */}
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt={siteTitle} className="h-8 w-auto" />
            ) : (
              <span className="text-base font-bold tracking-tight text-foreground">
                {siteTitle}
              </span>
            )}
          </Link>

          <nav className="flex items-center gap-1.5">
            {/* Theme toggle */}
            <button
              type="button"
              aria-label="Chuyển giao diện"
              onClick={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {/* Sun */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="hidden h-4 w-4 dark:block"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
              </svg>
              {/* Moon */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="block h-4 w-4 dark:hidden"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            </button>

            {/* Dashboard link */}
            <Link
              href="/dashboard"
              className="hidden h-9 items-center gap-1.5 rounded-full border border-border/60 bg-card/40 px-3 text-xs font-semibold text-foreground transition-colors hover:bg-accent sm:inline-flex"
            >
              Dashboard
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </Link>
          </nav>
        </div>
      </header>

      {/* ─── Main ─── */}
      <main className="flex-1">
        {/* Hero — title + description sát nhau */}
        <section className="relative border-b border-border/40 bg-gradient-to-b from-primary/5 via-background to-background">
          <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
            <nav className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Link href="/" className="transition-colors hover:text-foreground">
                Trang chủ
              </Link>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-muted-foreground/50"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
              <span className="text-foreground">{title}</span>
            </nav>

            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {title}
            </h1>

            {description ? (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                {description}
              </p>
            ) : null}
          </div>
        </section>

        {/* Content */}
        <article className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
          <div
            className="prose prose-sm max-w-none dark:prose-invert sm:prose-base prose-headings:scroll-mt-20 prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-foreground prose-p:leading-relaxed prose-p:text-foreground/85 prose-a:font-medium prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-strong:text-foreground prose-code:rounded prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[0.875em] prose-code:before:content-[''] prose-code:after:content-[''] prose-pre:rounded-xl prose-pre:border prose-pre:border-border/60 prose-pre:bg-muted/50 prose-img:rounded-xl prose-img:border prose-img:border-border/60 prose-blockquote:border-l-primary prose-blockquote:text-foreground/85"
            dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(content) }}
          />
        </article>
      </main>

      {/* ─── Footer ─── */}
      <footer className="border-t border-border/40 bg-card/30">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <p>
            © {new Date().getFullYear()} {siteTitle}. Bảo lưu mọi quyền.
          </p>
          <nav className="flex items-center gap-4">
            <Link href="/contact" className="transition-colors hover:text-foreground">
              Liên hệ
            </Link>
            <Link href="/blogs" className="transition-colors hover:text-foreground">
              Tin tức
            </Link>
            <Link href="/dashboard" className="transition-colors hover:text-foreground">
              Dashboard
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
