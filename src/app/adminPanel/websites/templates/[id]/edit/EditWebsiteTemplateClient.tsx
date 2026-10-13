"use client"

import { useQuery } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/client"
import { IconMonitor } from "@/components/icons"
import { Skeleton } from "@/components/ui/skeleton"
import { WebsiteTemplateForm } from "@/components/admin/website-template-form"

export function AdminEditWebsiteTemplateClient({ id }: { id: string }) {
  const trpc = useTRPC()
  const template = useQuery(trpc.adminWebsite.getTemplate.queryOptions({ id })) as { data: any; isLoading: boolean }
  const cats = useQuery(trpc.adminWebsite.categoriesForSelect.queryOptions()) as { data: any[] | undefined; isLoading: boolean }
  const deployCodes = useQuery(trpc.adminWebsite.listDeployCodes.queryOptions({ page: 1, limit: 100 })) as { data: { items: any[] } | undefined; isLoading: boolean }
  const isLoading = template.isLoading || cats.isLoading || deployCodes.isLoading

  return (
    <div className="space-y-6">
      <Header title={template.data?.serviceName || "Sửa mẫu website"} description="Cập nhật thông tin mẫu, code deploy, ảnh gallery và bảng giá thời hạn." />
      {isLoading || !template.data || !cats.data ? <Skeleton className="h-96 w-full rounded-xl" /> : <WebsiteTemplateForm templateId={id} initialData={{ 
        serviceName: template.data.serviceName,
        slug: template.data.slug,
        categoryId: template.data.categoryId,
        image: template.data.image,
        listImage: template.data.listImage ?? [],
        description: template.data.description ?? "",
        demoUrl: template.data.demoUrl ?? "",
        adminDemoUrl: template.data.adminDemoUrl ?? "",
        featuresList: template.data.featuresList ?? [],
        sourceZipUrl: template.data.sourceZipUrl ?? "",
        configFilePaths: template.data.configFilePaths ?? [".env", "config.php", "cmstdev.php"],
        sqlFilePaths: template.data.sqlFilePaths ?? [],
        deployMode: template.data.deployMode ?? "manual",
        deployServerId: template.data.deployServerId ?? "",
        deployCodeId: template.data.deployCodeId ?? "",
        deployPhpVersion: template.data.deployPhpVersion ?? "80",
        deployDefaultAccount: template.data.deployDefaultAccount ?? "",
        deployDefaultPassword: template.data.deployDefaultPassword ?? "",
        status: template.data.status,
        stt: template.data.stt ?? 0,
        pricings: template.data.pricings?.length ? template.data.pricings : [{ durationMonths: 1, pricePerMonth: 0, priceExtendPerMonth: 0 }],
      }} categories={cats.data} deployCodes={deployCodes.data?.items ?? []} />}
    </div>
  )
}

function Header({ title, description }: { title: string; description: string }) {
  return <div className="space-y-1"><nav className="flex items-center gap-1.5 text-sm text-muted-foreground"><a href="/adminPanel/dashboard" className="hover:text-foreground transition-colors">Admin</a><ChevronRight /><span>Website</span><ChevronRight /><a href="/adminPanel/websites/templates" className="hover:text-foreground transition-colors">Mẫu Website</a><ChevronRight /><span className="text-foreground">Sửa</span></nav><div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600"><IconMonitor size={20} /></div><div><h1 className="text-2xl font-bold tracking-tight">{title}</h1><p className="text-sm text-muted-foreground">{description}</p></div></div></div>
}
function ChevronRight() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/50"><path d="m9 18 6-6-6-6" /></svg> }
