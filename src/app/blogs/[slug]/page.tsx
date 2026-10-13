import type { Metadata } from "next"
import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { connectDB } from "@/lib/db"
import { findPostBySlug, serializePostMeta } from "@/services/post.service"
import { BlogDetailClient } from "./BlogDetailClient"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  try {
    await connectDB()
    const post = serializePostMeta(await findPostBySlug(slug))
    if (post) {
      const description = post.description?.slice(0, 160) || "Bài viết VanKhanh"
      return { title: `${post.title}`, description, keywords: post.keywords, openGraph: { title: post.title, description, images: post.thumbnail ? [post.thumbnail] : [] } }
    }
  } catch {}
  return { title: "Tin tức" }
}

export default async function BlogDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  void Promise.all([
    prefetch(trpc.post.detail.queryOptions({ slug })),
    prefetch(trpc.post.related.queryOptions({ slug }))
  ])
  return <HydrateClient><BlogDetailClient slug={slug} /></HydrateClient>
}
