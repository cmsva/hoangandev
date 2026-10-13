import type { Metadata } from "next"
import { HydrateClient, caller, prefetch, trpc } from "@/trpc/server"
import { ServiceDetailClient } from "./ServiceDetailClient"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  try {
    const service = (await caller.service.detail({ slug })) as any
    if (service) {
      const desc =
        service.description?.replace(/<[^>]+>/g, "").slice(0, 160) ||
        `Thuê website ${service.serviceName}`
      return {
        title: `${service.serviceName} | Tạo Website`,
        description: desc,
        openGraph: {
          title: service.serviceName,
          description: desc,
          images: service.image ? [service.image] : [],
        },
      }
    }
  } catch {
    // fallthrough
  }
  return { title: "Tạo Website" }
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  prefetch(trpc.service.detail.queryOptions({ slug }))

  return (
    <HydrateClient>
      <ServiceDetailClient />
    </HydrateClient>
  )
}
