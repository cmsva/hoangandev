import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { getPageSeo } from "@/lib/seo-config"
import { ContactClient } from "./ContactClient"

export const generateMetadata = () => getPageSeo("contact")

export default async function ContactPage() {
  prefetch(trpc.public.siteInfo.queryOptions())
  return (
    <HydrateClient>
      <ContactClient />
    </HydrateClient>
  )
}
