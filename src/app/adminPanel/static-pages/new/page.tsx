import { StaticPageForm } from "@/components/admin/static-page-form"

export const metadata = { title: "Thêm trang tĩnh | Admin" }

export default function NewStaticPagePage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <a href="/adminPanel/dashboard" className="hover:text-foreground">Admin</a><span>/</span>
          <a href="/adminPanel/static-pages" className="hover:text-foreground">Trang tĩnh</a><span>/</span>
          <span className="text-foreground">Thêm mới</span>
        </nav>
        <h1 className="text-2xl font-bold tracking-tight">Thêm trang tĩnh</h1>
      </div>
      <StaticPageForm pageId={null} />
    </div>
  )
}
