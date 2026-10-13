import { EditStaticPageClient } from "./EditStaticPageClient"

export const metadata = { title: "Sửa trang tĩnh | Admin" }

export default async function EditStaticPagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <a href="/adminPanel/dashboard" className="hover:text-foreground">Admin</a><span>/</span>
          <a href="/adminPanel/static-pages" className="hover:text-foreground">Trang tĩnh</a><span>/</span>
          <span className="text-foreground">Chỉnh sửa</span>
        </nav>
        <h1 className="text-2xl font-bold tracking-tight">Chỉnh sửa trang tĩnh</h1>
      </div>
      <EditStaticPageClient id={id} />
    </div>
  )
}
