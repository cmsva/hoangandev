/**
 * Product detail — RSC.
 * Generate dynamic metadata + prefetch product detail.
 */
import type { Metadata } from "next"
import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { connectDB } from "@/lib/db"
import { findProductBySlug, serializeProductMeta } from "@/services/product.service"
import { ProductDetailClient } from "./ProductDetailClient"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  try {
    await connectDB()
    const product = serializeProductMeta(await findProductBySlug(slug))
    if (product) {
      const desc = product.description?.slice(0, 160) || `Chi tiết mã nguồn ${product.title}`
      return {
        title: `${product.title} | Mã nguồn`,
        description: desc,
        openGraph: {
          title: product.title,
          description: desc,
          images: product.thumbnail ? [product.thumbnail] : [],
        },
      }
    }
  } catch {
    // fallthrough to default
  }
  return { title: "Mã nguồn" }
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  prefetch(trpc.product.detail.queryOptions({ slug }))

  return (
    <HydrateClient>
      <ProductDetailClient slug={slug} />
    </HydrateClient>
  )
}
