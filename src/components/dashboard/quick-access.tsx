import {
  IconBracketsCurly,
  IconLink,
  IconClock,
  IconBrush,
  IconMonitor,
  IconCreditCard,
  IconTicket,
  IconEnvelope,
} from "@/components/icons"

const quickLinks = [
  { label: "Mã nguồn", href: "/source-code", icon: IconBracketsCurly, color: "bg-primary/10 text-primary" },
  { label: "Tên miền", href: "/domain", icon: IconLink, color: "bg-[oklch(0.55_0.15_200)]/10 text-[oklch(0.55_0.15_200)]" },
  { label: "Cronjob", href: "/cronjob", icon: IconClock, color: "bg-[oklch(0.70_0.12_85)]/10 text-[oklch(0.70_0.12_85)]" },
  { label: "Tạo Logo", href: "/create-logo", icon: IconBrush, color: "bg-[oklch(0.60_0.20_300)]/10 text-[oklch(0.60_0.20_300)]" },
  { label: "Tạo Website", href: "/create-website", icon: IconMonitor, color: "bg-green-500/10 text-green-500" },
  { label: "Nạp tiền", href: "/customer/deposit", icon: IconCreditCard, color: "bg-amber-500/10 text-amber-500" },
  { label: "Vé hỗ trợ", href: "/customer/history/ticket", icon: IconTicket, color: "bg-rose-500/10 text-rose-500" },
  { label: "Liên hệ", href: "/contact", icon: IconEnvelope, color: "bg-sky-500/10 text-sky-500" },
]

export function QuickAccess() {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold mb-3">Truy cập nhanh</h3>
      <div className="grid grid-cols-4 gap-2">
        {quickLinks.map((link) => (
          <a
            key={link.label}
            href={link.href}
            className="flex flex-col items-center gap-1.5 rounded-lg p-2.5 transition-colors hover:bg-accent group"
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${link.color} transition-transform group-hover:scale-110`}>
              <link.icon size={20} />
            </div>
            <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground text-center leading-tight">
              {link.label}
            </span>
          </a>
        ))}
      </div>
    </div>
  )
}
