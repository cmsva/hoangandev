"use client"

import { useQuery } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/client"
import { PostForm } from "@/components/admin/post-form"
import { Skeleton } from "@/components/ui/skeleton"
import { IconDocument } from "@/components/icons"

export function AdminEditPostClient({ id }: { id: string }) {
  const trpc = useTRPC()
  const { data: post, isLoading: loadingPost } = useQuery(trpc.adminPost.getPost.queryOptions({ id })) as { data: any; isLoading: boolean }
  const { data: cats, isLoading: loadingCats } = useQuery(trpc.adminPost.categoriesForSelect.queryOptions()) as { data: any[] | undefined; isLoading: boolean }
  const isLoading = loadingPost || loadingCats

  return <div className="space-y-6"><div className="space-y-1"><nav className="flex items-center gap-1.5 text-sm text-muted-foreground"><a href="/adminPanel/dashboard">Admin</a><span>/</span><a href="/adminPanel/posts">Bài viết</a><span>/</span><span className="text-foreground">Chỉnh sửa</span></nav><div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600"><IconDocument size={20} /></div><div><h1 className="text-2xl font-bold tracking-tight">{post?.title || "Chỉnh sửa bài viết"}</h1><p className="text-sm text-muted-foreground">Cập nhật nội dung và cấu hình SEO.</p></div></div></div>{isLoading || !post || !cats ? <Skeleton className="h-96 w-full rounded-xl" /> : <PostForm postId={post.id} initialData={{ title: post.title, slug: post.slug, excerpt: post.excerpt ?? "", content: post.content ?? "", thumbnail: post.thumbnail, categoryId: post.categoryId, status: post.status, featured: post.featured, metaTitle: post.metaTitle ?? "", metaDescription: post.metaDescription ?? "", metaKeywords: post.metaKeywords ?? [] }} categories={cats} />}</div>
}
