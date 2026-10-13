"use client"

import type { QueryClient } from "@tanstack/react-query"
import { QueryClientProvider } from "@tanstack/react-query"
import { createTRPCClient, httpBatchLink } from "@trpc/client"
import { createTRPCContext } from "@trpc/tanstack-react-query"
import { useState } from "react"
import superjson from "superjson"
import { makeQueryClient } from "./query-client"
import type { AppRouter } from "./routers/_app"
import { AiChatWidget } from "@/components/ai/AiChatWidget"
import { SocketProvider } from "@/components/realtime/SocketProvider"
import { RealtimeBridge } from "@/components/realtime/RealtimeBridge"

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>()

let browserQueryClient: QueryClient
function getQueryClient() {
  if (typeof window === "undefined") {
    return makeQueryClient()
  }
  if (!browserQueryClient) browserQueryClient = makeQueryClient()
  return browserQueryClient
}

function getUrl() {
  const base = (() => {
    if (typeof window !== "undefined") return ""
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
    return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  })()
  return `${base}/api/trpc`
}

export function TRPCReactProvider(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient()

  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          url: getUrl(),
          transformer: superjson,
          fetch(url, options) {
            return fetch(url, { ...options, credentials: "include" })
          },
        }),
      ],
    }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        <SocketProvider>
          <RealtimeBridge />
          {props.children}
          <AiChatWidget />
        </SocketProvider>
      </TRPCProvider>
    </QueryClientProvider>
  )
}
