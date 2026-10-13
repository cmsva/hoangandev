"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { TypeWriter } from "@/components/landing/TypeWriter"
import { RevealText } from "@/components/landing/RevealText"
import type { GeneralSettings } from "@/services/settings.service"
import type { LandingStats } from "@/services/landing.service"
import type { SiteNotifications } from "@/services/site-notification.service"
// Banner + popup đã chuyển sang dashboard — landing không mount nữa.

/* ═══════════════════════════════════════════════════════
   Inline icons (SVG, không phụ thuộc lucide version)
   ═══════════════════════════════════════════════════════ */
type IcoProps = { className?: string }

function ArrowRightIco({ className }: IcoProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  )
}
function ChevronDownIco({ className }: IcoProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}
function StarIco({ className }: IcoProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  )
}
function CheckIco({ className }: IcoProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

/* ═══════════════════════════════════════════════════════
   Duotone SVG Icons
   ═══════════════════════════════════════════════════════ */
type DuoProps = { className?: string }

function CodeDuo({ className }: DuoProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="3" opacity=".5" />
      <path d="M10 8l-4 4 4 4M14 8l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}
function GlobeDuo({ className }: DuoProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <circle cx="12" cy="12" r="10" opacity=".5" />
      <path d="M12 2a14.5 14.5 0 000 20 14.5 14.5 0 000-20z" />
      <path d="M2 12h20" stroke="currentColor" strokeWidth="1.5" fill="none" opacity=".7" />
    </svg>
  )
}
function MegaphoneDuo({ className }: DuoProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M19 6.5v11a1 1 0 01-1.45.89L12 15.5H7a2 2 0 01-2-2v-3a2 2 0 012-2h5l5.55-2.89A1 1 0 0119 6.5z" opacity=".5" />
      <path d="M19 6.5v11a1 1 0 01-1.45.89L12 15.5v-7l5.55-2.89A1 1 0 0119 6.5z" />
      <path d="M7 15.5v3a1 1 0 001 1h2a1 1 0 001-1v-3" opacity=".7" />
      <circle cx="21" cy="12" r="1" />
    </svg>
  )
}
function LayersDuo({ className }: DuoProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2L2 7l10 5 10-5-10-5z" opacity=".5" />
      <path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity=".7" />
    </svg>
  )
}
function GiftDuo({ className }: DuoProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M4 8h16v12a2 2 0 01-2 2H6a2 2 0 01-2-2V8z" opacity=".5" />
      <rect x="3" y="6" width="18" height="4" rx="1" />
      <path d="M12 6v16" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  )
}
function ZapDuo({ className }: DuoProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" opacity=".5" />
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  )
}
function ShieldDuo({ className }: DuoProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 01-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 011-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 011.52 0C14.51 3.81 17 5 19 5a1 1 0 011 1z" opacity=".5" />
      <path d="M12 8v4M12 15h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  )
}
function BadgePercentDuo({ className }: DuoProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="3" opacity=".5" />
      <path d="M9 9h.01M15 15h.01M16 8l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  )
}
function RefreshDuo({ className }: DuoProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <circle cx="12" cy="12" r="9" opacity=".5" />
      <path d="M16.24 7.76A5.95 5.95 0 0012 6a6 6 0 106 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M18 6v4h-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}
function HeadphonesDuo({ className }: DuoProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M3 18v-6a9 9 0 0118 0v6" opacity=".5" />
      <rect x="3" y="14" width="4" height="6" rx="1" />
      <rect x="17" y="14" width="4" height="6" rx="1" />
    </svg>
  )
}
function BarChartDuo({ className }: DuoProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="2" opacity=".5" />
      <path d="M7 17v-4M12 17V9M17 17v-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  )
}
function TrendingUpDuo({ className }: DuoProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="2" opacity=".5" />
      <path d="M7 17l4-4 3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M15 11h4v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}
function UserCheckDuo({ className }: DuoProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <circle cx="9" cy="8" r="4" opacity=".5" />
      <path d="M17 19c0-3.31-3.58-6-8-6S1 15.69 1 19h16z" opacity=".5" />
      <circle cx="9" cy="8" r="4" />
      <path d="M16 11l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}
function BuildingDuo({ className }: DuoProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M3 21V7l9-4 9 4v14H3z" opacity=".5" />
      <rect x="3" y="7" width="18" height="14" />
      <rect x="7" y="10" width="3" height="3" rx=".5" fill="currentColor" />
      <rect x="14" y="10" width="3" height="3" rx=".5" fill="currentColor" />
      <rect x="7" y="15" width="3" height="3" rx=".5" fill="currentColor" />
      <rect x="14" y="15" width="3" height="3" rx=".5" fill="currentColor" />
    </svg>
  )
}
function RepeatDuo({ className }: DuoProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="3" opacity=".5" />
      <path d="M17 1l2 2-2 2M7 23l-2-2 2-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M19 3H8a4 4 0 00-4 4v2M5 21h11a4 4 0 004-4v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  )
}
function CreditCardDuo({ className }: DuoProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <rect x="2" y="5" width="20" height="14" rx="3" opacity=".5" />
      <path d="M2 10h20" stroke="currentColor" strokeWidth="2" />
      <rect x="5" y="14" width="4" height="2" rx=".5" fill="currentColor" />
    </svg>
  )
}

/* ═══════════════════════════════════════════════════════
   Static Data — content viết lại
   ═══════════════════════════════════════════════════════ */
const SERVICES = [
  {
    name: "Kho Mã Nguồn",
    desc: "Hàng trăm source code website, tool và ứng dụng được kiểm duyệt kỹ. Tải demo dùng thử, nhận file đầy đủ ngay khi thanh toán hoàn tất.",
    icon: CodeDuo,
    href: "/source-code",
    tags: ["Website", "App", "Script", "Plugin", "Full Source"],
  },
  {
    name: "Website Trọn Gói",
    desc: "Bộ template đa ngành nghề, dựng web hoàn chỉnh chỉ trong vài phút. Tùy biến nội dung, gắn tên miền và xuất bản tức thì.",
    icon: GlobeDuo,
    href: "/create-website",
    tags: ["Landing", "Bán hàng", "Tin tức", "SEO Ready"],
  },
  {
    name: "Tên Miền Chính Chủ",
    desc: "Đăng ký domain quốc tế và Việt Nam giá cạnh tranh. Quản lý DNS, gia hạn tự động và trỏ hosting ngay trong một nơi.",
    icon: LayersDuo,
    href: "/domain",
    tags: [".com", ".vn", ".net", "DNS", "Auto Renew"],
  },
  {
    name: "Thương Hiệu & Logo",
    desc: "Thiết kế logo và bộ nhận diện chuyên nghiệp, bàn giao đúng hẹn. Nhiều phương án để chọn, chỉnh sửa theo đúng ý bạn.",
    icon: MegaphoneDuo,
    href: "/create-logo",
    tags: ["Logo", "Banner", "Branding", "Name Card"],
  },
  {
    name: "Cronjob Tự Động",
    desc: "Lên lịch chạy tác vụ định kỳ cho website và tool. Theo dõi log thời gian thực, lý tưởng cho automation và bảo trì.",
    icon: RefreshDuo,
    href: "/cronjob",
    tags: ["Auto Task", "Lịch chạy", "Log", "Automation"],
  },
  {
    name: "Ví & Nạp Tiền",
    desc: "Nạp số dư qua QR Banking hoặc thẻ cào, cộng tiền tức thì. Một ví duy nhất chi trả cho toàn bộ dịch vụ trên hệ thống.",
    icon: GiftDuo,
    href: "/customer/deposit",
    tags: ["QR Banking", "Thẻ cào", "Tức thì", "An toàn"],
  },
]

const FEATURES = [
  { title: "Giao hàng tự động", desc: "Sản phẩm số được kích hoạt và bàn giao ngay sau khi thanh toán, không cần chờ duyệt.", icon: ZapDuo },
  { title: "Bảo mật giao dịch", desc: "Thông tin và thanh toán được mã hóa, bảo vệ quyền lợi của cả người mua lẫn người bán.", icon: ShieldDuo },
  { title: "Nạp tiền linh hoạt", desc: "Hỗ trợ QR Banking, thẻ cào và chuyển khoản — số dư cập nhật tức thì, hoàn toàn tự động.", icon: BadgePercentDuo },
  { title: "Cập nhật trọn đời", desc: "Mã nguồn nhận bản vá lỗi và cập nhật bảo mật miễn phí trọn đời qua tài khoản.", icon: RefreshDuo },
  { title: "Quản lý tập trung", desc: "Theo dõi đơn hàng, mã nguồn, tên miền và dịch vụ trên một dashboard duy nhất.", icon: BarChartDuo },
  { title: "Hỗ trợ tận tâm", desc: "Tạo ticket ngay trên hệ thống, đội ngũ phản hồi nhanh qua Telegram, Zalo và email.", icon: HeadphonesDuo },
]

const STEPS = [
  { step: "01", title: "Đăng ký tài khoản", desc: "Tạo tài khoản miễn phí trong 30 giây, không phí ẩn, không ràng buộc." },
  { step: "02", title: "Nạp số dư", desc: "Nạp qua QR Banking hoặc thẻ cào, số dư vào ví ngay lập tức." },
  { step: "03", title: "Chọn & thanh toán", desc: "Chọn sản phẩm cần dùng, tùy chỉnh và hoàn tất chỉ với một click." },
  { step: "04", title: "Nhận & quản lý", desc: "Nhận hàng tự động, theo dõi và mở rộng trên dashboard cá nhân." },
]
const STEP_ICONS = [UserCheckDuo, CreditCardDuo, GiftDuo, BarChartDuo]

const PERSONAS = [
  { title: "Marketer", desc: "Triển khai landing & website chiến dịch nhanh, chi phí tối ưu nhất.", icon: TrendingUpDuo },
  { title: "Freelancer", desc: "Mua sẵn mã nguồn và website để bàn giao dự án cho khách kịp deadline.", icon: UserCheckDuo },
  { title: "Doanh nghiệp", desc: "Quản lý nhiều website, tên miền và dịch vụ tập trung, minh bạch.", icon: BuildingDuo },
  { title: "Đại lý", desc: "Nhập giá sỉ, bán lại linh hoạt với chương trình hoa hồng hấp dẫn.", icon: RepeatDuo },
]

const REVIEWS = [
  { name: "Đặng Hữu Phúc", role: "Founder · Shop online", text: "Mua website bán hàng rồi gắn luôn tên miền cùng một chỗ, khỏi chạy nhiều nơi. Lên sóng trong buổi sáng, chiều đã có đơn đầu tiên." },
  { name: "Bùi Thanh Tùng", role: "Web Developer", text: "Source code có demo xem trước nên rất yên tâm. Code gọn gàng, kèm tài liệu cài đặt, tiết kiệm cho mình cả tuần làm việc." },
  { name: "Ngô Khánh Linh", role: "Chủ thương hiệu mỹ phẩm", text: "Đặt thiết kế logo nhận đúng hẹn, nhiều mẫu để chọn và chỉnh sửa thoải mái. Giá mềm hơn nhiều so với thuê riêng designer." },
  { name: "Trịnh Văn Sơn", role: "Quản trị hệ thống", text: "Cronjob giúp mình tự động hóa loạt tác vụ bảo trì. Đặt lịch dễ, xem log trực tiếp, chạy ổn định suốt mấy tháng nay." },
  { name: "Lý Thu Trang", role: "Marketing Freelancer", text: "Nạp tiền tức thì, mua hàng giao ngay, không phải đợi duyệt. Chương trình affiliate còn giúp mình có thêm thu nhập đều đặn." },
  { name: "Hồ Đăng Khoa", role: "Đại lý dịch vụ số", text: "Giá sỉ tốt, dashboard rõ ràng, hỗ trợ phản hồi nhanh. Mình bán lại cho khách và quản lý đơn rất tiện lợi." },
]

const FAQS = [
  { q: "Không rành kỹ thuật có dùng được không?", a: "Hoàn toàn được. Sản phẩm đóng gói sẵn và đội ngũ hỗ trợ giúp bạn cài đặt ban đầu — bạn chỉ cần thay nội dung là lên sóng." },
  { q: "Có được xem demo mã nguồn trước khi mua?", a: "Có. Hầu hết mã nguồn đều kèm link demo. Sau thanh toán, file đầy đủ được giao tự động kèm hướng dẫn cài đặt." },
  { q: "Tên miền có thuộc sở hữu của tôi?", a: "Đúng vậy. Domain đăng ký qua hệ thống thuộc 100% sở hữu của bạn, có thể quản lý, gia hạn hoặc chuyển đi tùy ý." },
  { q: "Hệ thống nhận thanh toán nào?", a: "QR Banking (Vietcombank, Techcombank, MBBank...), thẻ cào (Viettel, Mobifone, Vinaphone) và chuyển khoản. Số dư vào ví tức thì." },
  { q: "Thiết kế logo bao lâu thì nhận?", a: "Tùy gói, thường trong 24–48h. Bạn nhận nhiều phương án để chọn và được chỉnh sửa theo yêu cầu." },
  { q: "Cronjob dùng để làm gì?", a: "Đặt lịch chạy tác vụ định kỳ cho website và tool, theo dõi log trực tiếp — lý tưởng cho automation và bảo trì hệ thống." },
  { q: "Chính sách bảo hành & hoàn tiền?", a: "Hoàn tiền nếu sản phẩm không đúng mô tả trong thời gian quy định. Mỗi sản phẩm có chính sách bảo hành riêng ghi trên trang chi tiết." },
  { q: "Cần hỗ trợ thì liên hệ thế nào?", a: "Tạo ticket trên hệ thống hoặc nhắn qua Telegram, Zalo. Đội ngũ phản hồi nhanh trong giờ hành chính, hỗ trợ khẩn ngoài giờ." },
]

/* ═══════════════════════════════════════════════════════
   Animated counter hook
   ═══════════════════════════════════════════════════════ */
function useCountUp(target: number, duration = 2000, trigger = false) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!trigger || target === 0) {
      setCount(target)
      return
    }
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(1, elapsed / duration)
      // ease-out cubic — momentum nhẹ ở cuối animation
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(target * eased))
      if (progress < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        setCount(target)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration, trigger])
  return count
}

/* ═══════════════════════════════════════════════════════
   Props
   ═══════════════════════════════════════════════════════ */
interface LandingPageProps {
  site: GeneralSettings
  stats: LandingStats
  notifications?: SiteNotifications | null
}

/* ═══════════════════════════════════════════════════════
   Main Component — light mode mặc định
   ═══════════════════════════════════════════════════════ */
export function LandingPage({ site, stats, notifications }: LandingPageProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const [statsVisible, setStatsVisible] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const statsRef = useRef<HTMLDivElement>(null)

  const themeColor = site.themeColor || "#10b981"
  const siteName = site.siteTitle || "DevStore"
  const siteDesc =
    site.siteDescription ||
    "Nền tảng cung cấp mã nguồn, website, tên miền và dịch vụ số uy tín hàng đầu Việt Nam"
  const logo = site.logoLight || site.logoDark || ""

  useEffect(() => {
    let raf = 0
    let pending = false
    const onScroll = () => {
      if (pending) return
      pending = true
      raf = requestAnimationFrame(() => {
        setScrolled(window.scrollY > 40)
        pending = false
      })
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  useEffect(() => {
    const sections = document.querySelectorAll<HTMLElement>(".sr-section")
    if (!sections.length) return
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("sr-visible")
            obs.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }
    )
    sections.forEach((s) => obs.observe(s))
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    const el = statsRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setStatsVisible(true)
      },
      { threshold: 0.3 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const userCount = useCountUp(stats.customers || 0, 2000, statsVisible)
  const orderCount = useCountUp(stats.orders || 0, 2500, statsVisible)
  const productCount = useCountUp(stats.products || 0, 1800, statsVisible)
  const fmtNum = useCallback((n: number) => n.toLocaleString("vi-VN"), [])

  const statItems = [
    { label: "Đơn hàng đã giao", value: `${fmtNum(orderCount)}+` },
    { label: "Người dùng tin tưởng", value: `${fmtNum(userCount)}+` },
    { label: "Sản phẩm đang bán", value: `${fmtNum(productCount)}+` },
    { label: "Tỉ lệ giao tự động", value: "99%" },
  ]

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/15 selection:text-primary">
      {/* ═══════════ HEADER ═══════════ */}
      <header
        className={cn(
          "fixed left-0 right-0 top-0 z-50 transition-all duration-300",
          scrolled
            ? "bg-background/90 md:bg-background/85 md:backdrop-blur-xl shadow-sm"
            : "bg-transparent"
        )}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            {logo ? (
              <img src={logo} alt={siteName} className="h-9" />
            ) : (
              <span className="text-lg font-extrabold tracking-tight">
                {siteName}
              </span>
            )}
          </Link>

          <nav className="hidden items-center gap-7 lg:flex">
            {[
              { label: "Trang chủ", href: "/" },
              { label: "Mã nguồn", href: "/source-code" },
              { label: "Website", href: "/create-website" },
              { label: "Tên miền", href: "/domain" },
              { label: "Liên hệ", href: "/contact" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Button asChild size="sm" className="gap-1.5 rounded-md px-5">
              <Link href="/authentication/register">
                Bắt đầu
                <ArrowRightIco className="size-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* HOMEPAGE BANNER đã chuyển sang dashboard — landing không hiển thị. */}

      {/* ═══════════ HERO ═══════════ */}
      <section
        className="relative overflow-hidden px-6 pb-16 pt-32 sm:pt-36 lg:pt-40"
        style={{
          background: `linear-gradient(color-mix(in srgb, ${themeColor} 10%, #ffffff) 0%, #ffffff 55%, #ffffff 100%)`,
        }}
      >
        {/* Grid lines */}
        <div
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        {/* Mesh orbs — ẩn trên mobile, blur(160px) trên element 620×620 tốn GPU memory */}
        <div className="pointer-events-none absolute z-0 hidden sm:block" style={{ top: "-25%", left: "55%", width: 620, height: 620, backgroundColor: themeColor, filter: "blur(160px)", opacity: 0.16, borderRadius: "50%" }} />
        <div className="pointer-events-none absolute z-0 hidden sm:block" style={{ top: "30%", left: "-8%", width: 420, height: 420, backgroundColor: themeColor, filter: "blur(140px)", opacity: 0.1, borderRadius: "50%" }} />

        {/* Hero content */}
        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            Hệ thống hoạt động 24/7 — giao hàng mỗi 0.2 giây
          </div>

          <h1 className="text-4xl font-black leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl xl:text-7xl">
            Mọi dịch vụ số bạn cần
            <br />
            <span className="text-muted-foreground/90">gói gọn trong</span>{" "}
            <TypeWriter
              words={[
                "kho mã nguồn",
                "website trọn gói",
                "tên miền giá tốt",
                "thiết kế logo",
                "cronjob tự động",
              ]}
              typeSpeed={70}
              deleteSpeed={40}
              pauseDuration={2500}
              className="text-primary"
              cursorClassName="text-primary"
            />
          </h1>

          <RevealText
            text={siteDesc}
            speed={20}
            className="mx-auto mt-5 max-w-2xl text-center text-base leading-relaxed text-muted-foreground sm:text-lg lg:text-xl"
          />

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" className="gap-2 rounded-lg px-8 text-base" asChild>
              <Link href="/authentication/register">
                Tạo tài khoản miễn phí
                <ArrowRightIco className="size-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="gap-2 rounded-lg px-8 text-base" asChild>
              <Link href="#services">Khám phá dịch vụ</Link>
            </Button>
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            {[
              "Thanh toán tự động",
              "Giao hàng tức thì",
              "Bảo hành uy tín",
              "Hỗ trợ nhanh chóng",
            ].map((tp, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <CheckIco className="size-3.5 text-primary" />
                {tp}
              </span>
            ))}
          </div>
        </div>

        {/* Dashboard preview window */}
        <div className="relative z-10 mx-auto mt-14 max-w-4xl">
          {/* Glow behind the window */}
          <div
            className="pointer-events-none absolute -inset-x-10 -top-6 bottom-0 z-0 rounded-[2rem] opacity-30 blur-3xl"
            style={{ background: `radial-gradient(60% 60% at 50% 0%, ${themeColor}, transparent 70%)` }}
          />
          <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xl shadow-foreground/10">
            <div className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-4 py-3">
              <span className="size-3 rounded-full bg-red-400/70" />
              <span className="size-3 rounded-full bg-amber-400/70" />
              <span className="size-3 rounded-full bg-green-400/70" />
              <div className="ml-3 hidden flex-1 rounded-md border border-border/60 bg-background/60 px-3 py-1 text-[11px] text-muted-foreground sm:block">
                {siteName.toLowerCase().replace(/\s+/g, "")}.vn/dashboard
              </div>
            </div>
            <img
              src="/uploads/landing.png"
              alt={`Giao diện dashboard ${siteName}`}
              className="block w-full"
              loading="eager"
            />
          </div>
        </div>
      </section>

      {/* ═══════════ STATS STRIP ═══════════ */}
      <section ref={statsRef} className="sr-section border-y border-border/60 bg-muted/20 px-6 py-8">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-y-6 sm:grid-cols-4 sm:divide-x sm:divide-border/60">
          {statItems.map((s, i) => (
            <div key={i} className="px-4 text-center">
              <div className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                {s.value}
              </div>
              <div className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════ SERVICES ═══════════ */}
      <section id="services" className="sr-section px-6 py-20 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 max-w-2xl">
            <Badge variant="outline" className="mb-4 text-[10px] font-bold uppercase tracking-widest">
              Dịch vụ
            </Badge>
            <h2 className="text-3xl font-extrabold tracking-tight lg:text-4xl">
              Tất cả công cụ số trong một nền tảng
            </h2>
            <p className="mt-4 text-muted-foreground">
              Từ mã nguồn, website, tên miền đến thương hiệu — mọi thứ được tối ưu chi phí và tự động hóa từ đầu đến cuối.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((s, i) => {
              const Icon = s.icon
              return (
                <Link
                  key={i}
                  href={s.href}
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
                >
                  {/* left accent bar */}
                  <span className="absolute inset-y-0 left-0 w-1 origin-top scale-y-0 bg-primary transition-transform duration-300 group-hover:scale-y-100" />
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="size-6" />
                    </div>
                    <ArrowRightIco className="size-4 -translate-x-1 text-muted-foreground opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
                  </div>
                  <h3 className="mb-2 text-base font-bold transition-colors group-hover:text-primary">
                    {s.name}
                  </h3>
                  <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
                    {s.desc}
                  </p>
                  <div className="mt-auto flex flex-wrap gap-1.5">
                    {s.tags.map((tag, j) => (
                      <span
                        key={j}
                        className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═══════════ FEATURES — split layout ═══════════ */}
      <section id="features" className="sr-section relative overflow-hidden border-y border-border/60 bg-muted/20 px-6 py-20 lg:py-28">
        <div className="pointer-events-none absolute -right-32 -top-32 h-[400px] w-[400px] rounded-full opacity-[0.07] blur-[130px]" style={{ background: `radial-gradient(circle, ${themeColor}, transparent 70%)` }} />
        <div className="relative mx-auto grid max-w-5xl gap-12 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <Badge variant="outline" className="mb-4 text-[10px] font-bold uppercase tracking-widest">
              Vì sao chọn chúng tôi
            </Badge>
            <h2 className="text-3xl font-extrabold tracking-tight lg:text-4xl">
              Nền tảng cho người làm việc nghiêm túc
            </h2>
            <p className="mt-4 text-muted-foreground">
              Chúng tôi là nhà cung cấp trực tiếp — giá hợp lý hơn, vận hành ổn định hơn và luôn đồng hành cùng bạn.
            </p>
            <Button asChild className="mt-6 gap-2">
              <Link href="/authentication/register">
                Dùng thử ngay
                <ArrowRightIco className="size-4" />
              </Link>
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {FEATURES.map((f, i) => {
              const Icon = f.icon
              return (
                <div key={i} className="flex gap-4 rounded-2xl border border-border/60 bg-card p-5 transition-all duration-300 hover:border-primary/30 hover:shadow-md">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-6" />
                  </div>
                  <div>
                    <h3 className="mb-1 text-sm font-bold">{f.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═══════════ HOW IT WORKS — timeline ═══════════ */}
      <section id="how-it-works" className="sr-section px-6 py-20 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <Badge variant="outline" className="mb-4 text-[10px] font-bold uppercase tracking-widest">
              Quy trình
            </Badge>
            <h2 className="text-3xl font-extrabold tracking-tight lg:text-4xl">
              Bắt đầu chỉ với 4 bước
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Đơn giản và tự động hoàn toàn — từ đăng ký đến sử dụng dịch vụ chỉ mất vài phút.
            </p>
          </div>

          <div className="relative grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {/* connecting line */}
            <div className="pointer-events-none absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent lg:block" />
            {STEPS.map((s, i) => {
              const Icon = STEP_ICONS[i]
              return (
                <div key={i} className="relative text-center">
                  <div className="relative z-10 mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl border border-border/60 bg-card text-primary shadow-sm">
                    <Icon className="size-7" />
                    <span className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                      {i + 1}
                    </span>
                  </div>
                  <h3 className="mb-2 text-sm font-bold">{s.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═══════════ PERSONAS ═══════════ */}
      <section className="sr-section relative overflow-hidden border-y border-border/60 bg-muted/20 px-6 py-20 lg:py-28">
        <div className="pointer-events-none absolute left-[8%] top-[18%] size-3 rounded-full bg-primary/30" style={{ animation: "landingFloat 6s ease-in-out infinite 1s" }} />
        <div className="pointer-events-none absolute right-[10%] top-[12%] select-none text-3xl text-primary/15" style={{ animation: "landingFloat 7s ease-in-out infinite 0.5s" }}>✦</div>
        <div className="pointer-events-none absolute left-[6%] bottom-[20%] size-[90px] rounded-full border-2 border-dashed border-muted-foreground/15" style={{ animation: "whoSpin 24s linear infinite" }} />

        <div className="relative mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <Badge variant="outline" className="mb-4 text-[10px] font-bold uppercase tracking-widest">
              Dành cho ai
            </Badge>
            <h2 className="text-3xl font-extrabold tracking-tight lg:text-4xl">
              Hợp với mọi nhu cầu kinh doanh số
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PERSONAS.map((p, i) => {
              const Icon = p.icon
              return (
                <div key={i} className="group rounded-2xl border border-border/60 bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg">
                  <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110">
                    <Icon className="size-6" />
                  </div>
                  <h3 className="mb-2 text-sm font-bold">{p.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{p.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═══════════ REVIEWS — marquee ═══════════ */}
      <section className="sr-section px-0 py-20 lg:py-28">
        <div className="mb-12 px-6 text-center">
          <Badge variant="outline" className="mb-4 text-[10px] font-bold uppercase tracking-widest">
            Đánh giá khách hàng
          </Badge>
          <h2 className="text-3xl font-extrabold tracking-tight lg:text-4xl">
            Hàng nghìn khách hàng đã tin tưởng
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Những phản hồi thực tế về chất lượng, tốc độ giao hàng và độ ổn định của hệ thống.
          </p>
        </div>

        <div
          className="relative overflow-hidden py-2"
          style={{
            maskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)",
            WebkitMaskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)",
          }}
        >
          <div className="flex w-max gap-4" style={{ animation: "marqueeScroll 40s linear infinite" }}>
            {[...REVIEWS, ...REVIEWS].map((r, i) => (
              <div key={i} className="w-[340px] shrink-0 rounded-2xl border border-border/60 bg-card p-6">
                <div className="mb-3 flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <StarIco key={j} className="size-4 text-amber-400" />
                  ))}
                </div>
                <p className="mb-4 text-sm leading-relaxed text-foreground">
                  &ldquo;{r.text}&rdquo;
                </p>
                <div>
                  <div className="text-sm font-bold">{r.name}</div>
                  <div className="text-xs text-muted-foreground">{r.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ CTA BANNER ═══════════ */}
      <section className="sr-section px-6 pb-20 lg:pb-28">
        <div
          className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-border/60 px-8 py-14 text-center"
          style={{
            background: `linear-gradient(135deg, color-mix(in srgb, ${themeColor} 14%, #ffffff), #ffffff)`,
          }}
        >
          <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full opacity-20 blur-3xl" style={{ background: themeColor }} />
          <div className="pointer-events-none absolute -bottom-16 -left-16 size-48 rounded-full opacity-15 blur-3xl" style={{ background: themeColor }} />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight lg:text-4xl">
              Sẵn sàng bắt đầu cùng {siteName}?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Tạo tài khoản miễn phí, nạp tiền và trải nghiệm toàn bộ dịch vụ chỉ trong vài phút.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" className="gap-2 rounded-lg px-8 text-base" asChild>
                <Link href="/authentication/register">
                  Bắt đầu miễn phí
                  <ArrowRightIco className="size-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="rounded-lg px-8 text-base" asChild>
                <Link href="/contact">Liên hệ tư vấn</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ FAQ — 2 cột ═══════════ */}
      <section id="faq" className="sr-section border-t border-border/60 bg-muted/20 px-6 py-20 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <Badge variant="outline" className="mb-4 text-[10px] font-bold uppercase tracking-widest">
              Hỏi đáp
            </Badge>
            <h2 className="text-3xl font-extrabold tracking-tight lg:text-4xl">
              Câu hỏi thường gặp
            </h2>
            <p className="mt-4 text-muted-foreground">
              Chưa thấy câu trả lời?{" "}
              <Link href="/contact" className="font-semibold text-primary hover:underline">
                Liên hệ hỗ trợ
              </Link>
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {FAQS.map((faq, i) => (
              <div key={i} className="h-fit overflow-hidden rounded-xl border border-border/60 bg-card">
                <button
                  className="flex w-full cursor-pointer items-center justify-between gap-3 px-5 py-4 text-left text-sm font-semibold transition-colors hover:text-primary"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span>{faq.q}</span>
                  <ChevronDownIco
                    className={cn(
                      "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                      openFaq === i && "rotate-180"
                    )}
                  />
                </button>
                <div
                  className={cn(
                    "overflow-hidden transition-all duration-300",
                    openFaq === i ? "max-h-48 px-5 pb-4" : "max-h-0"
                  )}
                >
                  <p className="text-sm leading-relaxed text-muted-foreground">{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ FOOTER ═══════════ */}
      <footer className="border-t border-border/60 bg-background">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-4">
              {logo ? (
                <img src={logo} alt={siteName} className="h-8 w-auto" />
              ) : (
                <span className="text-lg font-extrabold">{siteName}</span>
              )}
              <p className="text-xs leading-relaxed text-muted-foreground">{siteDesc}</p>
              <div className="flex items-center gap-2 pt-1">
                {site.adminFanpage && (
                  <a href={site.adminFanpage} target="_blank" rel="noopener noreferrer" className="flex size-8 items-center justify-center rounded-lg border border-border/60 bg-muted/40 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Facebook">
                    <svg className="size-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                  </a>
                )}
                {site.adminTelegram && (
                  <a href={`https://t.me/${site.adminTelegram.replace("@", "")}`} target="_blank" rel="noopener noreferrer" className="flex size-8 items-center justify-center rounded-lg border border-border/60 bg-muted/40 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Telegram">
                    <svg className="size-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg>
                  </a>
                )}
                {site.adminZalo && (
                  <a href={`https://zalo.me/${site.adminZalo}`} target="_blank" rel="noopener noreferrer" className="flex size-8 items-center justify-center rounded-lg border border-border/60 bg-muted/40 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Zalo">
                    <span className="text-[10px] font-extrabold">Z</span>
                  </a>
                )}
                {site.adminEmail && (
                  <a href={`mailto:${site.adminEmail}`} className="flex size-8 items-center justify-center rounded-lg border border-border/60 bg-muted/40 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Email">
                    <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  </a>
                )}
              </div>
            </div>

            <div>
              <h4 className="mb-4 text-[11px] font-bold uppercase tracking-[0.15em] text-foreground">Dịch vụ</h4>
              <ul className="space-y-2.5">
                {SERVICES.map((s, i) => (
                  <li key={i}>
                    <Link href={s.href} className="text-[13px] text-muted-foreground transition-colors hover:text-foreground">
                      {s.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-[11px] font-bold uppercase tracking-[0.15em] text-foreground">Liên kết</h4>
              <ul className="space-y-2.5">
                <li><Link href="/blogs" className="text-[13px] text-muted-foreground transition-colors hover:text-foreground">Blog & Tin tức</Link></li>
                <li><Link href="/contact" className="text-[13px] text-muted-foreground transition-colors hover:text-foreground">Liên hệ</Link></li>
                <li><Link href="/dashboard" className="text-[13px] text-muted-foreground transition-colors hover:text-foreground">Dashboard</Link></li>
                <li><Link href="/customer/affiliate" className="text-[13px] text-muted-foreground transition-colors hover:text-foreground">Tiếp thị liên kết</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-[11px] font-bold uppercase tracking-[0.15em] text-foreground">Hỗ trợ</h4>
              <ul className="space-y-2.5">
                <li><Link href="/contact" className="text-[13px] text-muted-foreground transition-colors hover:text-foreground">Trung tâm hỗ trợ</Link></li>
                <li><Link href="/ticket/create" className="text-[13px] text-muted-foreground transition-colors hover:text-foreground">Tạo Ticket</Link></li>
                {site.adminHotline && (
                  <li className="text-[13px] text-muted-foreground">Hotline: {site.adminHotline}</li>
                )}
                {site.adminEmail && (
                  <li className="text-[13px] text-muted-foreground">Email: {site.adminEmail}</li>
                )}
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border/60 pt-6 text-[12px] text-muted-foreground sm:flex-row">
            <span>© {new Date().getFullYear()} {siteName}. All rights reserved.</span>
            <div className="flex items-center gap-4">
              <Link href="/blogs" className="transition-colors hover:text-foreground">Blog</Link>
              <Link href="/contact" className="transition-colors hover:text-foreground">Liên hệ</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* ═══════════ CSS Keyframes ═══════════ */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes landingFloat {
          0%, 100% { transform: translateY(0) }
          50% { transform: translateY(-12px) }
        }
        @keyframes marqueeScroll {
          0% { transform: translateX(0) }
          100% { transform: translateX(-50%) }
        }
        @keyframes whoSpin {
          0% { transform: rotate(0deg) }
          100% { transform: rotate(360deg) }
        }
        .sr-section {
          opacity: 0;
          transform: translateY(32px);
          transition: opacity 0.7s cubic-bezier(.16,1,.3,1), transform 0.7s cubic-bezier(.16,1,.3,1);
          will-change: opacity, transform;
        }
        .sr-section.sr-visible {
          opacity: 1;
          transform: translateY(0);
        }
      `,
        }}
      />

      {/* FLOATING POPUP đã chuyển sang dashboard. */}
    </div>
  )
}
