import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import DOMPurify from "isomorphic-dompurify"
import { connectDB } from "@/lib/db"
import { getSession } from "@/lib/session"
import { findStaticPageBySlug, incrementStaticPageView } from "@/services/static-page.service"
import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { StaticPageClient } from "./StaticPageClient"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  try {
    await connectDB()
    const page = await findStaticPageBySlug(slug)
    if (page) {
      return {
        title: page.title,
        description: page.description || undefined,
        keywords: page.keywords.length > 0 ? page.keywords : undefined,
        openGraph: { title: page.title, description: page.description || undefined },
      }
    }
  } catch {}
  return { title: "Không tìm thấy trang" }
}

export default async function StaticPageRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  await connectDB()
  const page = await findStaticPageBySlug(slug)
  if (!page) notFound()

  // Login gate
  if (page.requireLogin) {
    const session = await getSession()
    if (!session) {
      redirect(`/authentication/login?redirect=${encodeURIComponent("/" + page.slug)}`)
    }
  }

  // Sanitize HTML (chống XSS) trước khi render
  const safeHtml = DOMPurify.sanitize(page.content, { USE_PROFILES: { html: true } })

  // View counter — best-effort, không block render
  void incrementStaticPageView(page.slug)

  // Prefetch siteInfo cho header/footer logo + tên website
  prefetch(trpc.public.siteInfo.queryOptions())

  return (
    <HydrateClient>
      <StaticPageClient
        title={page.title}
        description={page.description}
        content={safeHtml}
      />
    </HydrateClient>
  )
}
