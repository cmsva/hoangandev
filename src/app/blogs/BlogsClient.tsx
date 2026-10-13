"use client"

import { useEffect, useState } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { AppSidebar } from "@/components/app-sidebar"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { useSidebar } from "@/components/sidebar-context"
import { Skeleton } from "@/components/ui/skeleton"
import { useTRPC } from "@/trpc/client"

export function BlogsClient() {
  const { collapsed } = useSidebar()
  const trpc = useTRPC()
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [categoryId, setCategoryId] = useState<string | undefined>()
  useEffect(() => { const timer = setTimeout(() => { setSearch(searchInput.trim()); setPage(1) }, 300); return () => clearTimeout(timer) }, [searchInput])
  const { data, isLoading, isFetching } = useQuery({ ...trpc.post.list.queryOptions({ page, limit: 12, search: search || undefined, categoryId }), placeholderData: keepPreviousData }) as { data: any; isLoading: boolean; isFetching: boolean }
  const { data: categories } = useQuery(trpc.post.categories.queryOptions()) as { data: any[] | undefined }

  return <div className="flex min-h-screen bg-background"><AppSidebar /><div className={`flex flex-1 flex-col transition-all duration-300 ${collapsed ? "lg:ml-[72px]" : "lg:ml-[260px]"}`}><DashboardHeader /><main className="flex-1 space-y-6 p-6"><div><nav className="mb-2 text-sm text-muted-foreground"><a href="/dashboard" className="hover:text-foreground">Trang chủ</a> / <span className="text-foreground">Tin tức</span></nav><h1 className="text-xl font-bold">Tin tức & hướng dẫn</h1><p className="mt-0.5 text-sm text-muted-foreground">Cập nhật kiến thức và thông báo mới nhất.</p></div><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="relative max-w-md flex-1"><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Tìm bài viết..." className="w-full rounded-lg border border-input bg-muted/40 px-4 py-2.5 text-sm outline-none focus:border-primary" />{isFetching && !isLoading && <span className="absolute right-3 top-1/2 size-3 -translate-y-1/2 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />}</div><div className="flex flex-wrap gap-2"><button onClick={() => { setCategoryId(undefined); setPage(1) }} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${!categoryId ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>Tất cả</button>{categories?.map((category) => <button key={category.id} onClick={() => { setCategoryId(category.id); setPage(1) }} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${categoryId === category.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{category.name}</button>)}</div></div>{isLoading ? <BlogSkeleton /> : data?.posts?.length ? <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">{data.posts.map((post: any) => <BlogCard key={post.id} post={post} />)}</div> : <div className="py-16 text-center text-muted-foreground">Không tìm thấy bài viết nào.</div>}{data?.pagination?.totalPages > 1 && <div className="flex justify-center gap-2 pt-4"><button onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40">Trước</button><span className="px-3 py-1.5 text-sm text-muted-foreground">{page} / {data.pagination.totalPages}</span><button onClick={() => setPage((current) => Math.min(data.pagination.totalPages, current + 1))} disabled={page === data.pagination.totalPages} className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40">Sau</button></div>}</main></div></div>
}
function BlogCard({ post }: { post: any }) {
  return <article className="group overflow-hidden rounded-xl border bg-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"><a href={`/blogs/${post.slug}`} className="block h-44 bg-muted">{post.thumbnail ? <img src={post.thumbnail} alt={post.title} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center text-muted-foreground">Tin tức</div>}</a><div className="space-y-3 p-4">{post.category && <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">{post.category.name}</span>}<a href={`/blogs/${post.slug}`}><h2 className="line-clamp-2 text-base font-bold leading-tight group-hover:text-primary">{post.title}</h2></a>{post.excerpt && <p className="line-clamp-3 text-sm text-muted-foreground">{post.excerpt}</p>}<div className="flex items-center justify-between text-xs text-muted-foreground"><span>{new Date(post.createdAt).toLocaleDateString("vi-VN")}</span><span>{post.view} lượt xem</span></div></div></article>
}

function BlogSkeleton() {
  return <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="rounded-xl border bg-card"><Skeleton className="h-44 w-full" /><div className="space-y-3 p-4"><Skeleton className="h-4 w-1/4" /><Skeleton className="h-5 w-4/5" /><Skeleton className="h-14 w-full" /></div></div>)}</div>
}
