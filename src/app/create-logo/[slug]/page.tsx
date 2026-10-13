import type { Metadata } from "next"
import { HydrateClient, caller, prefetch, trpc } from "@/trpc/server"
import { LogoDetailClient } from "./LogoDetailClient"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  try {
    const logo = (await caller.logo.detail({ slug })) as any
    if (logo) {
      return {
        title: `${logo.title} | Đặt Logo`,
        description: `Đặt logo ${logo.title} — bản quyền 100%, sửa miễn phí tới khi ưng ý.`,
        openGraph: {
          title: logo.title,
          images: logo.image ? [logo.image] : [],
        },
      }
    }
  } catch {
    // fallthrough
  }
  return { title: "Đặt Logo" }
}

export default async function LogoDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  void Promise.all([
    prefetch(trpc.logo.detail.queryOptions({ slug })),
    prefetch(trpc.logo.related.queryOptions({ slug }))
  ])

  return (
    <HydrateClient>
      <LogoDetailClient />
    </HydrateClient>
  )
}
