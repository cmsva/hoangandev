import Link from "next/link"

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="mx-auto max-w-md text-center space-y-6">
        <div className="text-8xl font-black text-primary/20">404</div>
        <h2 className="text-2xl font-bold text-foreground">Không tìm thấy trang</h2>
        <p className="text-muted-foreground text-sm">
          Trang bạn tìm không tồn tại hoặc đã bị xóa.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Về trang chủ
        </Link>
      </div>
    </div>
  )
}
