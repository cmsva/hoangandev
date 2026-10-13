export const metadata = {
  title: "Bảo trì hệ thống",
  description: "Hệ thống đang được bảo trì, vui lòng quay lại sau.",
}

export default function MaintenancePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-500/10">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-amber-500"
          >
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Hệ thống đang bảo trì</h1>
          <p className="text-sm text-muted-foreground">
            Chúng tôi đang nâng cấp hệ thống để mang lại trải nghiệm tốt hơn.
            Vui lòng quay lại sau ít phút.
          </p>
        </div>
        <div className="pt-4">
          <a
            href="/"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Thử lại
          </a>
        </div>
      </div>
    </div>
  )
}
