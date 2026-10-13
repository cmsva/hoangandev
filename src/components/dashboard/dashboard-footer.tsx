export function DashboardFooter() {
  return (
    <footer className="border-t border-border bg-card/50 mt-auto">
      <div className="px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <a href="/chinh-sach-bao-mat" className="hover:text-foreground transition-colors">Chính sách bảo mật</a>
          <span className="text-muted-foreground/40">|</span>
          <a href="/dieu-khoan-su-dung" className="hover:text-foreground transition-colors">Điều khoản sử dụng</a>
        </div>
        <p>Version 1.0.0 | Powered By <a href="https://cmstdev.vn" target="_blank" rel="noopener noreferrer" className="font-medium text-foreground hover:text-primary transition-colors">CMSTDEV.VN</a></p>
      </div>
    </footer>
  )
}
