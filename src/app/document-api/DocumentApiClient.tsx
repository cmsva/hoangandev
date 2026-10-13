"use client"

/**
 * /document-api — wrap trong layout dashboard chính (AppSidebar + DashboardHeader).
 *
 * Bố cục body:
 *  1. Page header (breadcrumb)
 *  2. ApiKeyManagerPanel (1 key/user)
 *  3. Reference docs với secondary nav 220px + content + code samples
 */
import * as React from "react"
import { cn } from "@/lib/utils"
import { AppSidebar } from "@/components/app-sidebar"
import { useSidebar } from "@/components/sidebar-context"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardFooter } from "@/components/dashboard/dashboard-footer"
import { API_DOCS_SECTIONS, type ApiEndpoint } from "@/lib/api-docs-catalog"
import { CodeSamples } from "./CodeSamples"

interface Props {
  // Hiện nay docs công khai. API key quản lý ở /customer/profile.
  isAuthenticated?: boolean
}

export function DocumentApiClient({ isAuthenticated }: Props) {
  const { collapsed } = useSidebar()
  const [isMounted, setIsMounted] = React.useState(false)

  React.useEffect(() => setIsMounted(true), [])
  if (!isMounted) {
    return <div className="flex min-h-screen bg-background" suppressHydrationWarning />
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div
        className={cn(
          "flex flex-1 flex-col transition-all duration-300 ease-in-out",
          collapsed ? "lg:ml-[72px]" : "lg:ml-[260px]"
        )}
      >
        <DashboardHeader />
        <DocumentApiBody />
        <DashboardFooter />
      </div>
    </div>
  )
}

// ─── Body ───────────────────────────────────────────────────────────────────

function DocumentApiBody() {
  const [baseUrl, setBaseUrl] = React.useState("")
  const [activeId, setActiveId] = React.useState<string>(
    API_DOCS_SECTIONS[0]?.endpoints[0]?.id ?? ""
  )

  React.useEffect(() => {
    if (typeof window !== "undefined") setBaseUrl(window.location.origin)
  }, [])

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > 0.4) {
            setActiveId(entry.target.id.replace("ep-", ""))
            break
          }
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: [0, 0.4, 1] }
    )
    document.querySelectorAll<HTMLElement>("[id^='ep-']").forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <main className="flex-1 space-y-6 p-6">
      {/* Breadcrumb */}
      <div className="space-y-1">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <a href="/dashboard" className="transition-colors hover:text-foreground">
            Trang chủ
          </a>
          <span>/</span>
          <span className="font-medium text-foreground">Tài liệu API</span>
        </nav>
        <h1 className="text-xl font-bold text-foreground">Agency Reseller API</h1>
        <p className="text-sm text-muted-foreground">
          Tích hợp REST API để bán lại mã nguồn, website, domain, cronjob, logo từ hệ thống.
        </p>
      </div>

      {/* Reference Docs */}
      <section id="docs" className="scroll-mt-20 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
          <DocsSidebar activeId={activeId} setActiveId={setActiveId} />
          <DocsContent baseUrl={baseUrl} />
        </div>
      </section>
    </main>
  )
}

// ─── Docs sidebar (nested) ──────────────────────────────────────────────────

function DocsSidebar({
  activeId,
  setActiveId,
}: {
  activeId: string
  setActiveId: (id: string) => void
}) {
  return (
    <nav className="hidden lg:block sticky top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto pr-2">
      <ul className="space-y-4 text-sm">
        {API_DOCS_SECTIONS.map((section) => (
          <li key={section.id}>
            <div className="mb-1 px-2 text-[10px] uppercase tracking-wider font-bold text-muted-foreground/80">
              {section.title}
            </div>
            <ul className="space-y-0.5">
              {section.endpoints.map((ep) => {
                const isActive = activeId === ep.id
                return (
                  <li key={ep.id}>
                    <a
                      href={`#ep-${ep.id}`}
                      onClick={() => setActiveId(ep.id)}
                      className={cn(
                        "flex items-center gap-2 rounded px-2 py-1.5 text-[12.5px] transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      <MethodBadge method={ep.method} small />
                      <span className="truncate">{ep.title}</span>
                    </a>
                  </li>
                )
              })}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  )
}

// ─── Docs content ──────────────────────────────────────────────────────────

function DocsContent({ baseUrl }: { baseUrl: string }) {
  return (
    <div className="space-y-10 min-w-0">
      {API_DOCS_SECTIONS.map((section) => (
        <div key={section.id}>
          <div className="mb-4">
            <h3 className="text-base font-bold tracking-tight">{section.title}</h3>
            {section.intro && (
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{section.intro}</p>
            )}
          </div>
          <div className="space-y-6">
            {section.endpoints.map((ep) => (
              <EndpointCard key={ep.id} endpoint={ep} baseUrl={baseUrl} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function EndpointCard({ endpoint, baseUrl }: { endpoint: ApiEndpoint; baseUrl: string }) {
  return (
    <div
      id={`ep-${endpoint.id}`}
      className="scroll-mt-20 grid grid-cols-1 xl:grid-cols-2 gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm"
    >
      <div className="space-y-3">
        <div>
          <div className="flex flex-wrap items-start gap-2">
            <MethodBadge method={endpoint.method} />
            <code className="text-[12.5px] font-mono px-2 py-1 rounded bg-muted text-foreground break-all">
              {endpoint.path}
            </code>
          </div>
          <h4 className="mt-2 text-base font-bold">{endpoint.title}</h4>
          {endpoint.description && (
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              {endpoint.description}
            </p>
          )}
          {endpoint.scope && (
            <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 text-[10.5px] rounded font-mono bg-primary/10 text-primary border border-primary/20">
              scope: {endpoint.scope}
            </div>
          )}
        </div>

        {endpoint.pathParams && endpoint.pathParams.length > 0 && (
          <ParamTable title="Path Params" params={endpoint.pathParams} />
        )}
        {endpoint.queryParams && endpoint.queryParams.length > 0 && (
          <ParamTable title="Query Params" params={endpoint.queryParams} />
        )}
        {endpoint.bodyParams && endpoint.bodyParams.length > 0 && (
          <ParamTable title="Body Params" params={endpoint.bodyParams} />
        )}
      </div>

      <div className="space-y-3 min-w-0">
        <CodeSamples endpoint={endpoint} baseUrl={baseUrl} />
        <ResponsePanel example={endpoint.responseExample} />
      </div>
    </div>
  )
}

function ParamTable({
  title,
  params,
}: {
  title: string
  params: { name: string; type: string; required?: boolean; description?: string }[]
}) {
  return (
    <div>
      <div className="mb-1.5 text-[10.5px] uppercase tracking-wider font-bold text-muted-foreground">
        {title}
      </div>
      <div className="overflow-hidden rounded-lg border border-border">
        {params.map((p, i) => (
          <div
            key={p.name}
            className={cn(
              "px-3 py-2 text-sm hover:bg-muted/30",
              i > 0 && "border-t border-border"
            )}
          >
            <div className="mb-0.5 flex items-center gap-2">
              <code className="font-mono text-[12.5px] font-semibold">{p.name}</code>
              <span className="text-[10px] text-muted-foreground">{p.type}</span>
              {p.required && (
                <span className="text-[10px] font-semibold text-rose-500">required</span>
              )}
            </div>
            {p.description && (
              <div className="text-[12px] text-muted-foreground leading-relaxed">
                {p.description}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function ResponsePanel({ example }: { example: unknown }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-zinc-950">
      <div className="border-b border-white/5 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
        200 Response
      </div>
      <pre className="overflow-x-auto p-4 text-[12px] font-mono leading-5 text-zinc-100">
        <code>{JSON.stringify(example, null, 2)}</code>
      </pre>
    </div>
  )
}

function MethodBadge({
  method,
  small,
}: {
  method: ApiEndpoint["method"]
  small?: boolean
}) {
  const colors: Record<ApiEndpoint["method"], string> = {
    GET: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30",
    POST: "bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30",
    PUT: "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30",
    PATCH: "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30",
    DELETE: "bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30",
  }
  return (
    <span
      className={cn(
        "inline-block rounded font-mono font-bold border",
        colors[method],
        small ? "text-[9px] px-1 py-0.5 leading-none w-12 text-center" : "text-[10px] px-1.5 py-0.5"
      )}
    >
      {method}
    </span>
  )
}
