"use client"

import { useState } from "react"
import { toast } from "@/components/ui/toast"
import { Globe, Copy, Check, X, ShieldCheck, Server, Loader2, ExternalLink } from "lucide-react"

export interface DeployNsInfo {
  domainName: string
  status: string
  nameServers: string[]
  deployCompletedAt?: string | Date | null
}

/**
 * Dialog hướng dẫn trỏ NS cho đơn website auto-deploy.
 *
 * Hiển thị NS Cloudflare riêng của domain để user trỏ + tiến trình 2 bước:
 *   (1) Cloudflare zone — đã có NS
 *   (2) aaPanel deploy  — upload/giải nén/cấu hình
 *
 * Không phụ thuộc NS active: web sẽ lên ngay khi user trỏ NS xong, kể cả khi
 * aaPanel đã deploy trước đó (chỉ chờ DNS propagate phía user).
 */
export function DeployNsDialog({
  info,
  onClose,
}: {
  info: DeployNsInfo
  onClose: () => void
}) {
  const ns = info.nameServers || []
  const deployDone =
    info.status === "active" || !!info.deployCompletedAt
  const cfDone = ns.length > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-2xl border bg-card p-6 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground leading-tight">
                  Trỏ Nameserver để hoàn tất
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Tên miền{" "}
                  <span className="font-mono font-semibold text-foreground">
                    {info.domainName}
                  </span>
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Đóng"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Progress 2 bước */}
          <div className="grid grid-cols-2 gap-2">
            <ProgressStep
              icon={<ShieldCheck className="h-4 w-4" />}
              label="Cloudflare"
              desc={cfDone ? "Đã cấp NS" : "Đang tạo..."}
              done={cfDone}
            />
            <ProgressStep
              icon={<Server className="h-4 w-4" />}
              label="aaPanel deploy"
              desc={deployDone ? "Hoàn tất" : "Đang chạy..."}
              done={deployDone}
              pending={!deployDone}
            />
          </div>

          {/* Nameservers */}
          {ns.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Cập nhật 2 nameserver này tại nhà cung cấp tên miền
              </p>
              {ns.map((nsItem, i) => (
                <NsRow key={nsItem} index={i + 1} value={nsItem} />
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang lấy nameserver từ Cloudflare, vui lòng đợi vài giây...
            </div>
          )}

          {/* Hướng dẫn */}
          <div className="rounded-lg border border-sky-500/20 bg-sky-500/10 p-3 text-[12px] leading-relaxed text-sky-700 dark:text-sky-300">
            <p className="font-semibold">Các bước tiếp theo</p>
            <ol className="mt-1 list-decimal space-y-0.5 pl-4">
              <li>Đăng nhập trang quản lý tên miền (nơi bạn mua domain).</li>
              <li>Thay nameserver hiện tại bằng 2 NS phía trên.</li>
              <li>Lưu lại và đợi DNS cập nhật (5–30 phút, có thể tới 24h).</li>
              <li>Website sẽ tự lên khi NS trỏ xong — không cần thao tác thêm.</li>
            </ol>
          </div>

          <p className="text-[11px] leading-snug text-muted-foreground">
            Bạn có thể đóng hộp thoại này. NS luôn được lưu trong mục{" "}
            <span className="font-medium text-foreground">Website đã tạo</span> để
            xem lại bất cứ lúc nào.
          </p>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              Đã hiểu
            </button>
            <a
              href={`https://${info.domainName}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <ExternalLink className="h-4 w-4" /> Mở website
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

function ProgressStep({
  icon,
  label,
  desc,
  done,
  pending,
}: {
  icon: React.ReactNode
  label: string
  desc: string
  done: boolean
  pending?: boolean
}) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-lg border p-2.5 ${
        done
          ? "border-emerald-500/30 bg-emerald-500/10"
          : "border-border bg-muted/30"
      }`}
    >
      <div
        className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
          done
            ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {done ? <Check className="h-4 w-4" /> : pending ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-foreground leading-tight">{label}</p>
        <p className="text-[11px] text-muted-foreground">{desc}</p>
      </div>
    </div>
  )
}

function NsRow({ index, value }: { index: number; value: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    toast.success("Đã copy nameserver")
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-background p-2.5">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[11px] font-bold text-primary">
        {index}
      </span>
      <code className="flex-1 truncate font-mono text-sm font-medium text-foreground">
        {value}
      </code>
      <button
        onClick={handleCopy}
        className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-all hover:bg-accent"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Đã copy" : "Copy"}
      </button>
    </div>
  )
}
