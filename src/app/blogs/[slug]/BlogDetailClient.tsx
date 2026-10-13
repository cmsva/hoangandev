"use client"

import { useQuery } from "@tanstack/react-query"
import { AppSidebar } from "@/components/app-sidebar"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { useSidebar } from "@/components/sidebar-context"
import { Skeleton } from "@/components/ui/skeleton"
import { useTRPC } from "@/trpc/client"
import { sanitizeRichHtml } from "@/lib/sanitize"

export function BlogDetailClient({ slug }: { slug: string }) {
  const { collapsed } = useSidebar()
  const trpc = useTRPC()
  const { data: post, isLoading } = useQuery(trpc.post.detail.queryOptions({ slug })) as { data: any; isLoading: boolean }
  const { data: related } = useQuery(trpc.post.related.queryOptions({ slug, categoryId: post?.categoryId || undefined }, { enabled: !!post })) as { data: any[] | undefined }

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className={`flex min-w-0 flex-1 flex-col transition-all duration-300 ${collapsed ? "lg:ml-[72px]" : "lg:ml-[260px]"}`}>
        <DashboardHeader />
        <main className="min-w-0 flex-1 p-6">
          {isLoading ? (
            <DetailSkeleton />
          ) : !post ? (
            <div className="py-20 text-center text-muted-foreground">Không tìm thấy bài viết.</div>
          ) : (
            <div className="w-full space-y-4">
              <nav className="text-sm text-muted-foreground">
                <a href="/dashboard">Trang chủ</a> / <a href="/blogs">Tin tức</a> / <span className="text-foreground">{post.title}</span>
              </nav>

              <div className="grid w-full grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
                <article className="min-w-0 space-y-6">
                  {post.thumbnail && (
                    <img src={post.thumbnail} alt={post.title} className="max-h-[460px] w-full rounded-xl border object-cover" />
                  )}
                  <div className="rounded-xl border bg-card p-6">
                    <div className="mb-5 border-b pb-5">
                      <span className="text-xs font-semibold uppercase tracking-wider text-primary">{post.category?.name ?? "Tin tức"}</span>
                      <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">{post.title}</h1>
                      {post.excerpt && <p className="mt-3 text-base text-muted-foreground">{post.excerpt}</p>}
                      <div className="mt-3 text-xs text-muted-foreground">{new Date(post.createdAt).toLocaleDateString("vi-VN")} • {post.view} lượt xem</div>
                    </div>
                    <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(post.content) }} />
                  </div>
                </article>

                <aside className="min-w-0 self-stretch">
                  <div className="sticky top-6 rounded-xl border bg-card p-5">
                    <h2 className="mb-4 text-base font-bold">Bài viết liên quan</h2>
                    <div className="space-y-3">
                      {related?.length ? (
                        related.map((item) => <RelatedPost key={item.id} post={item} />)
                      ) : (
                        <p className="text-sm text-muted-foreground">Chưa có bài viết liên quan.</p>
                      )}
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
function RelatedPost({ post }: { post: any }) {
  return (
    <a href={`/blogs/${post.slug}`} className="group flex gap-3 rounded-lg border p-3 transition-colors hover:bg-accent">
      <div className="h-16 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
        {post.thumbnail ? (
          <img src={post.thumbnail} alt={post.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">Blog</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-semibold leading-snug group-hover:text-primary">{post.title}</p>
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{post.excerpt}</p>
      </div>
    </a>
  )
}

function DetailSkeleton() {
  return <div className="w-full max-w-5xl space-y-4"><Skeleton className="h-6 w-72" /><Skeleton className="h-[360px] w-full rounded-xl" /><Skeleton className="h-64 w-full rounded-xl" /></div>
}
