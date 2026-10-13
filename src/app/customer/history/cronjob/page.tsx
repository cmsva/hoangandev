/**
 * Customer cronjob history — RSC.
 *
 * Prefetch myCronjobs (page=1, sort createdAt desc) + listServers
 * để client query hit cache, không có flash skeleton lúc load đầu.
 */
import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { CronjobHistoryClient } from "./HistoryClient"

export const metadata = {
  title: "Cronjob đang chạy",
}

export default async function CronjobHistoryPage() {
  void Promise.all([
    prefetch(
    trpc.cronjob.myCronjobs.queryOptions({
    page: 1,
    limit: 10,
    sortField: "createdAt",
    sortDir: "desc",
    })
    ),
    prefetch(trpc.cronjob.listServers.queryOptions())
  ])

  return (
    <HydrateClient>
      <CronjobHistoryClient />
    </HydrateClient>
  )
}
