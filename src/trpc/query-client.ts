import {
  defaultShouldDehydrateQuery,
  QueryClient,
  type Query,
} from "@tanstack/react-query"
import superjson from "superjson"

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data ổn định 60s — giảm refetch khi navigate giữa pages
        staleTime: 60 * 1_000,
        // Giữ cache 5 phút sau khi không có observer
        gcTime: 5 * 60_000,
        // Retry hợp lý — không retry lỗi auth/permission
        retry: (failureCount, error: any) => {
          const code = error?.data?.code
          if (code === "UNAUTHORIZED" || code === "FORBIDDEN" || code === "NOT_FOUND") return false
          return failureCount < 2
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
        refetchOnWindowFocus: false,
        refetchOnReconnect: "always",
      },
      mutations: {
        // Mutation không retry tự động (an toàn cho purchase, etc.)
        retry: false,
      },
      // RSC dehydrate: chỉ dehydrate queries đã resolved (success/error).
      // KHÔNG dehydrate pending — gây hydration mismatch khi dùng useQuery (vs useSuspenseQuery).
      // Pending streaming yêu cầu <Suspense> + useSuspenseQuery; ở đây ta dùng useQuery thường.
      dehydrate: {
        serializeData: superjson.serialize,
        shouldDehydrateQuery: (query: Query) => defaultShouldDehydrateQuery(query),
      },
      hydrate: {
        deserializeData: superjson.deserialize,
      },
    },
  })
}
