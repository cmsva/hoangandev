import "server-only"
import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query"
import type { TRPCQueryOptions } from "@trpc/tanstack-react-query"
import { headers } from "next/headers"
import { cache } from "react"
import { createTRPCContext } from "./init"
import { makeQueryClient } from "./query-client"
import { appRouter } from "./routers/_app"

export const getQueryClient = cache(makeQueryClient)

export const trpc = createTRPCOptionsProxy({
  ctx: async () =>
    createTRPCContext({
      headers: await headers(),
    }),
  router: appRouter,
  queryClient: getQueryClient,
})

export function HydrateClient(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient()
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {props.children}
    </HydrationBoundary>
  )
}

export function prefetch<T extends ReturnType<TRPCQueryOptions<any>>>(
  queryOptions: T,
) {
  const queryClient = getQueryClient()
  if ((queryOptions as any).queryKey?.[1]?.type === "infinite") {
    void queryClient.prefetchInfiniteQuery(queryOptions as any)
  } else {
    void queryClient.prefetchQuery(queryOptions)
  }
}

export const caller = appRouter.createCaller(async () =>
  createTRPCContext({ headers: await headers() }),
)
