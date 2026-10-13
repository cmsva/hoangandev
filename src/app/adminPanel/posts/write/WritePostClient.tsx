"use client"

import { useQuery } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/client"
import { PostForm, newPostFormData } from "@/components/admin/post-form"
import { Skeleton } from "@/components/ui/skeleton"
import { IconDocument } from "@/components/icons"

export function WritePostClient() {
  const trpc = useTRPC()
  const { data: cats, isLoading } = useQuery(trpc.adminPost.categoriesForSelect.queryOptions()) as { data: any[] | undefined; isLoading: boolean }

  return <div className="space-y-6"><div className="space-y-1"><nav className="flex items-center gap-1.5 text-sm text-muted-foreground"><a href="/adminPanel/dashboard">Admin</a><span>/</span><a href="/adminPanel/posts">Bài viết</a><span>/</span><span className="text-foreground">Thêm mới</span></nav><div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600"><IconDocument size={20} /></div><div><h1 className="text-2xl font-bold tracking-tight">Thêm bài viết mới</h1><p className="text-sm text-muted-foreground">Soạn nội dung với CKEditor và cấu hình SEO riêng.</p></div></div></div>{isLoading || !cats ? <Skeleton className="h-96 w-full rounded-xl" /> : <PostForm postId={null} initialData={newPostFormData()} categories={cats} />}</div>
}
