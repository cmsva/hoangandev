"use client"

import { useQuery } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/client"
import { Skeleton } from "@/components/ui/skeleton"
import { StaticPageForm, type StaticPageFormData } from "@/components/admin/static-page-form"

export function EditStaticPageClient({ id }: { id: string }) {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(trpc.adminStaticPage.get.queryOptions({ id })) as {
    data: any
    isLoading: boolean
  }

  if (isLoading || !data) {
    return <Skeleton className="h-96 w-full rounded-xl" />
  }

  const initialData: StaticPageFormData = {
    slug: data.slug ?? "",
    title: data.title ?? "",
    description: data.description ?? "",
    keywords: data.keywords ?? [],
    content: data.content ?? "",
    requireLogin: !!data.requireLogin,
    status: data.status ?? 1,
  }

  return <StaticPageForm pageId={id} initialData={initialData} />
}
