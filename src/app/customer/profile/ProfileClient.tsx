"use client"

/**
 * /customer/profile — Page View (pure presentational)
 *
 * Layout 2 cột:
 *  - LEFT: Hero card với avatar + tên + username + email + balance
 *  - RIGHT: Sections "Thông tin cá nhân" và "Bảo mật"
 *
 * State + mutations đều ở hook useProfile.
 */
import { AppSidebar } from "@/components/app-sidebar"
import { useSidebar } from "@/components/sidebar-context"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  User as UserIcon,
  Mail,
  Wallet,
  Calendar,
  Globe,
  Globe2,
  Monitor,
  Pencil,
  KeyRound,
  ShieldCheck,
  ShieldOff,
  Camera,
  Loader2,
  Copy,
  Check,
  BadgeCheck,
  CircleAlert,
  Send,
  Link2,
  Link2Off,
  RefreshCcw,
  RefreshCw,
  Trash2,
} from "lucide-react"
import { useProfile } from "@/hooks/use-profile"
import { useState, useEffect } from "react"
import { toast } from "@/components/ui/toast"
import { useTRPC } from "@/trpc/client"
import { useQuery, useMutation } from "@tanstack/react-query"
import { cn } from "@/lib/utils"
import { PasskeySection } from "@/components/profile/passkey-section"

function formatMoney(n: number | undefined | null) {
  return new Intl.NumberFormat("vi-VN").format(Number(n) || 0) + "đ"
}

function formatDate(d: Date | string | undefined | null) {
  if (!d) return "—"
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(d))
}

export function ProfileClient() {
  const { collapsed } = useSidebar()
  const p = useProfile()
  const profile = p.profile

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className={`flex flex-1 flex-col transition-all duration-300 ease-in-out ${collapsed ? "lg:ml-[72px]" : "lg:ml-[260px]"}`}>
        <DashboardHeader />
        <main className="flex-1 space-y-6 p-4 sm:p-6">
          {/* Breadcrumb */}
          <div>
            <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2">
              <a href="/dashboard" className="hover:text-foreground transition-colors">Trang chủ</a>
              <span>/</span>
              <span className="text-foreground font-medium">Hồ sơ cá nhân</span>
            </nav>
            <h1 className="text-2xl font-bold tracking-tight">Hồ sơ cá nhân</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Quản lý thông tin tài khoản và bảo mật.
            </p>
          </div>

          {p.isLoading || !profile ? (
            <ProfileSkeleton />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* LEFT — Hero Card + Security */}
              <div className="lg:col-span-1 space-y-6">
                <HeroCard profile={profile} onChangeAvatar={p.openAvatarDialog} />
                <SecurityLevelCard profile={profile} hook={p} />
              </div>

              {/* RIGHT — Sections */}
              <div className="lg:col-span-2 space-y-6">
                <PersonalInfoSection profile={profile} hook={p} />
                <AccountInfoSection profile={profile} />
                <SecuritySection profile={profile} hook={p} />
                <PasskeySection />
                <ApiKeySection />
                <LinkingSection profile={profile} hook={p} />
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Dialogs */}
      {profile && (
        <>
          <ChangePasswordDialog hook={p} />
          <UpdateFullnameDialog hook={p} />
          <UpdateEmailDialog hook={p} />
          <UpdateAvatarDialog hook={p} />
          <Toggle2FADialog hook={p} profile={profile} />
          <VerifyEmailDialog hook={p} profile={profile} />
          <LinkTelegramDialog hook={p} />
        </>
      )}
    </div>
  )
}

// ─── Hero Card ────────────────────────────────────────────────────────────

function HeroCard({
  profile,
  onChangeAvatar,
}: {
  profile: any
  onChangeAvatar: () => void
}) {
  const seed = profile.username || "user"
  const avatarSrc =
    profile.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`
  const emailVerified = profile.emailVerified === 1
  const teleLinked = !!profile.telegramId

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Cover */}
      <div className="h-24 bg-gradient-to-br from-primary/30 via-primary/10 to-primary/40" />

      <div className="px-6 pb-6 -mt-12 flex flex-col items-center text-center">
        <div className="relative">
          <Avatar className="size-24 ring-4 ring-card bg-muted">
            <AvatarImage src={avatarSrc} alt={profile.fullname || profile.username} />
            <AvatarFallback className="text-2xl">
              {(profile.fullname || profile.username)?.[0]?.toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          <button
            type="button"
            onClick={onChangeAvatar}
            className="absolute bottom-0 right-0 inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 transition-all"
            aria-label="Đổi ảnh đại diện"
          >
            <Camera className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-1.5">
          <h2 className="text-lg font-bold tracking-tight">
            {profile.fullname || "Chưa đặt họ tên"}
          </h2>
          <p className="text-sm text-primary">@{profile.username}</p>
          <p className="text-xs text-muted-foreground inline-flex items-center justify-center gap-1.5 max-w-full">
            <span className="truncate">{profile.email}</span>
            {emailVerified && (
              <BadgeCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" aria-label="Email đã xác minh" />
            )}
          </p>
          {teleLinked && (
            <p className="text-xs text-muted-foreground inline-flex items-center justify-center gap-1.5">
              <Send className="h-3 w-3" />
              <span>{profile.telegramUsername ? `@${profile.telegramUsername}` : "Telegram"}</span>
              <BadgeCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" aria-label="Telegram đã liên kết" />
            </p>
          )}
        </div>

        {profile.admin === 1 && (
          <Badge className="mt-3 bg-amber-500/15 text-amber-600 border-amber-500/30 hover:bg-amber-500/20">
            Quản trị viên
          </Badge>
        )}

        {/* Balance */}
        <div className="mt-5 w-full grid grid-cols-2 gap-2">
          <div className="rounded-lg border bg-muted/30 p-3 text-left">
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
              Số dư
            </p>
            <p className="text-base font-bold text-primary mt-0.5">
              {formatMoney(profile.money)}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3 text-left">
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
              Tổng nạp
            </p>
            <p className="text-base font-bold mt-0.5">
              {formatMoney(profile.totalMoney)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Security Level Card ───────────────────────────────────────────────

function SecurityLevelCard({ profile, hook }: { profile: any; hook: any }) {
  const trpc = useTRPC()
  const passkeyQuery = useQuery(trpc.passkey.list.queryOptions())
  const hasPasskey = (passkeyQuery.data ?? []).length > 0

  const checks: { label: string; done: boolean; onClick?: () => void }[] = [
    {
      label: "Xác minh email",
      done: profile.emailVerified === 1,
      onClick: profile.emailVerified === 1 ? undefined : hook.openVerifyEmailDialog,
    },
    {
      label: "Bật xác thực 2 yếu tố",
      done: profile.status2fa === 1,
      onClick: profile.status2fa === 1 ? undefined : hook.open2FADialog,
    },
    {
      label: "Liên kết Passkey",
      done: hasPasskey,
    },
    {
      label: "Liên kết Telegram",
      done: !!profile.telegramId,
      onClick: profile.telegramId ? undefined : hook.openLinkTelegramDialog,
    },
  ]

  const doneCount = checks.filter((c) => c.done).length
  const total = checks.length
  const percent = Math.round((doneCount / total) * 100)

  const tone =
    percent === 100
      ? { text: "text-emerald-600", bar: "bg-emerald-500", label: "Tuyệt vời" }
      : percent >= 50
        ? { text: "text-amber-600", bar: "bg-amber-500", label: "Khá tốt" }
        : { text: "text-rose-600", bar: "bg-rose-500", label: "Cần cải thiện" }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="border-b px-6 py-4 flex items-center gap-3">
        <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-bold">Mức độ bảo mật</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Hoàn thiện để bảo vệ tài khoản tốt hơn.
          </p>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* Progress */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className={cn("text-sm font-bold", tone.text)}>{tone.label}</span>
            <span className="text-xs font-mono text-muted-foreground">
              {doneCount}/{total}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-500", tone.bar)}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {/* Checklist */}
        <ul className="space-y-1">
          {checks.map((c) => (
            <li key={c.label}>
              <button
                type="button"
                onClick={c.onClick}
                disabled={!c.onClick}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-left transition-colors",
                  c.onClick ? "hover:bg-muted cursor-pointer" : "cursor-default"
                )}
              >
                {c.done ? (
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 shrink-0">
                    <Check className="h-3 w-3" />
                  </span>
                ) : (
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border-2 border-muted-foreground/30 shrink-0" />
                )}
                <span
                  className={cn(
                    "flex-1",
                    c.done ? "text-muted-foreground line-through" : "text-foreground"
                  )}
                >
                  {c.label}
                </span>
                {!c.done && c.onClick && (
                  <span className="text-[11px] font-medium text-primary">Thiết lập</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────

function SectionCard({
  title,
  desc,
  children,
}: {
  title: string
  desc: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="border-b px-6 py-4">
        <h3 className="text-base font-bold">{title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <div className="divide-y">{children}</div>
    </div>
  )
}

function FieldRow({
  icon: Icon,
  label,
  value,
  action,
  badge,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: React.ReactNode
  action?: React.ReactNode
  badge?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-4 px-6 py-4">
      <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
            {label}
          </p>
          {badge}
        </div>
        <p className="text-sm font-medium mt-0.5 truncate">{value}</p>
      </div>
      {action}
    </div>
  )
}

function PersonalInfoSection({ profile, hook }: { profile: any; hook: any }) {
  return (
    <SectionCard
      title="Thông tin cá nhân"
      desc="Chỉnh sửa họ tên và email của bạn."
    >
      <FieldRow
        icon={UserIcon}
        label="Họ và tên"
        value={profile.fullname || <span className="italic text-muted-foreground">Chưa đặt</span>}
        action={
          <Button variant="ghost" size="sm" onClick={hook.openFullnameDialog} className="gap-1.5">
            <Pencil className="h-3.5 w-3.5" />
            Sửa
          </Button>
        }
      />
      <FieldRow
        icon={Mail}
        label="Email"
        value={profile.email}
        action={
          <Button variant="ghost" size="sm" onClick={hook.openEmailDialog} className="gap-1.5">
            <Pencil className="h-3.5 w-3.5" />
            Sửa
          </Button>
        }
      />
      <FieldRow
        icon={UserIcon}
        label="Tên đăng nhập"
        value={<span className="font-mono">@{profile.username}</span>}
        badge={
          <Badge variant="secondary" className="text-[9px] h-4 uppercase tracking-wider">
            Khóa
          </Badge>
        }
      />
    </SectionCard>
  )
}

function AccountInfoSection({ profile }: { profile: any }) {
  return (
    <SectionCard
      title="Hoạt động tài khoản"
      desc="Phiên đăng nhập gần nhất và thời gian tài khoản."
    >
      <FieldRow
        icon={Globe}
        label="Địa chỉ IP"
        value={profile.ip || <span className="italic text-muted-foreground">Chưa có</span>}
      />
      <FieldRow
        icon={Monitor}
        label="Thiết bị"
        value={
          <span className="line-clamp-1">
            {profile.device || <span className="italic text-muted-foreground">Chưa có</span>}
          </span>
        }
      />
      <FieldRow
        icon={Calendar}
        label="Ngày tạo"
        value={formatDate(profile.createdAt)}
      />
      <FieldRow
        icon={Calendar}
        label="Cập nhật gần nhất"
        value={formatDate(profile.updatedAt)}
      />
    </SectionCard>
  )
}

function SecuritySection({ profile, hook }: { profile: any; hook: any }) {
  const is2FAOn = profile.status2fa === 1
  return (
    <SectionCard
      title="Bảo mật"
      desc="Bảo vệ tài khoản với mật khẩu và xác thực 2 yếu tố."
    >
      <FieldRow
        icon={KeyRound}
        label="Mật khẩu"
        value="••••••••"
        action={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => hook.setShowPasswordDialog(true)}
            className="gap-1.5"
          >
            <Pencil className="h-3.5 w-3.5" />
            Đổi
          </Button>
        }
      />
      <FieldRow
        icon={is2FAOn ? ShieldCheck : ShieldOff}
        label="Xác thực 2 yếu tố (2FA)"
        value={
          is2FAOn
            ? "Đang bật — bảo vệ tài khoản"
            : "Đang tắt — khuyến nghị bật để an toàn hơn"
        }
        badge={
          is2FAOn ? (
            <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20 text-[9px] h-4 uppercase tracking-wider">
              Đã bật
            </Badge>
          ) : (
            <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 hover:bg-amber-500/20 text-[9px] h-4 uppercase tracking-wider">
              Chưa bật
            </Badge>
          )
        }
        action={
          <Button
            variant={is2FAOn ? "destructive" : "default"}
            size="sm"
            onClick={hook.open2FADialog}
          >
            {is2FAOn ? "Tắt 2FA" : "Bật 2FA"}
          </Button>
        }
      />
    </SectionCard>
  )
}

// ─── Dialogs ───────────────────────────────────────────────────────────────

function ChangePasswordDialog({ hook }: { hook: any }) {
  return (
    <Dialog open={hook.showPasswordDialog} onOpenChange={hook.setShowPasswordDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Đổi mật khẩu</DialogTitle>
          <DialogDescription>Nhập mật khẩu cũ và mật khẩu mới để cập nhật.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Mật khẩu cũ</Label>
            <Input
              type="password"
              value={hook.oldPassword}
              onChange={(e: any) => hook.setOldPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-2">
            <Label>Mật khẩu mới</Label>
            <Input
              type="password"
              value={hook.newPassword}
              onChange={(e: any) => hook.setNewPassword(e.target.value)}
              placeholder="Tối thiểu 6 ký tự"
              autoComplete="new-password"
            />
          </div>
        </div>
        <DialogFooter className="pt-2 sm:gap-0">
          <Button variant="outline" className="h-10" onClick={() => hook.setShowPasswordDialog(false)}>
            Hủy
          </Button>
          <Button
            className="h-10"
            onClick={hook.submitChangePassword}
            disabled={
              hook.isChangingPassword || !hook.oldPassword || hook.newPassword.length < 6
            }
          >
            {hook.isChangingPassword && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Xác nhận
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function UpdateFullnameDialog({ hook }: { hook: any }) {
  return (
    <Dialog open={hook.showFullnameDialog} onOpenChange={hook.setShowFullnameDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cập nhật họ tên</DialogTitle>
          <DialogDescription>Tên hiển thị trên hệ thống và hóa đơn.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Họ và tên</Label>
            <Input
              value={hook.newFullname}
              onChange={(e: any) => hook.setNewFullname(e.target.value)}
              placeholder="Nguyễn Văn A"
              maxLength={100}
            />
          </div>
        </div>
        <DialogFooter className="pt-2 sm:gap-0">
          <Button variant="outline" className="h-10" onClick={() => hook.setShowFullnameDialog(false)}>
            Hủy
          </Button>
          <Button
            className="h-10"
            onClick={hook.submitUpdateFullname}
            disabled={hook.isUpdatingFullname || hook.newFullname.trim().length < 2}
          >
            {hook.isUpdatingFullname && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function UpdateEmailDialog({ hook }: { hook: any }) {
  return (
    <Dialog open={hook.showEmailDialog} onOpenChange={hook.setShowEmailDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Đổi email</DialogTitle>
          <DialogDescription>Email được dùng để khôi phục tài khoản.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Email mới</Label>
            <Input
              type="email"
              value={hook.newEmail}
              onChange={(e: any) => hook.setNewEmail(e.target.value)}
              placeholder="newmail@example.com"
              maxLength={255}
              autoComplete="email"
            />
          </div>
        </div>
        <DialogFooter className="pt-2 sm:gap-0">
          <Button variant="outline" className="h-10" onClick={() => hook.setShowEmailDialog(false)}>
            Hủy
          </Button>
          <Button
            className="h-10"
            onClick={hook.submitUpdateEmail}
            disabled={hook.isUpdatingEmail || !hook.newEmail.trim()}
          >
            {hook.isUpdatingEmail && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function UpdateAvatarDialog({ hook }: { hook: any }) {
  return (
    <Dialog open={hook.showAvatarDialog} onOpenChange={hook.setShowAvatarDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cập nhật ảnh đại diện</DialogTitle>
          <DialogDescription>
            Nhập URL ảnh đại diện. Để trống để dùng ảnh mặc định.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {hook.newAvatar && (
            <div className="flex justify-center">
              <Avatar className="size-24 ring-2 ring-border">
                <AvatarImage src={hook.newAvatar} alt="Preview" />
                <AvatarFallback>?</AvatarFallback>
              </Avatar>
            </div>
          )}
          <div className="space-y-2">
            <Label>URL ảnh</Label>
            <Input
              value={hook.newAvatar}
              onChange={(e: any) => hook.setNewAvatar(e.target.value)}
              placeholder="https://example.com/avatar.jpg"
              maxLength={500}
            />
          </div>
        </div>
        <DialogFooter className="pt-2 sm:gap-0">
          <Button variant="outline" className="h-10" onClick={() => hook.setShowAvatarDialog(false)}>
            Hủy
          </Button>
          <Button
            className="h-10"
            onClick={hook.submitUpdateAvatar}
            disabled={hook.isUpdatingAvatar}
          >
            {hook.isUpdatingAvatar && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Toggle2FADialog({ hook, profile }: { hook: any; profile: any }) {
  const [copied, setCopied] = useState(false)
  const is2FAOn = profile.status2fa === 1

  const copySecret = () => {
    if (!hook.setup2FA?.base32Secret) return
    navigator.clipboard.writeText(hook.setup2FA.base32Secret)
    setCopied(true)
    toast.success("Đã sao chép mã bí mật")
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={hook.show2FADialog} onOpenChange={hook.setShow2FADialog}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{is2FAOn ? "Tắt 2FA" : "Bật xác thực 2 yếu tố"}</DialogTitle>
          <DialogDescription>
            {is2FAOn
              ? "Nhập mã 6 chữ số từ ứng dụng Authenticator để tắt."
              : "Quét mã QR bằng Google Authenticator, Authy hoặc Microsoft Authenticator, sau đó nhập mã 6 chữ số."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Chưa có secret key — hiện nút tạo mới */}
          {!is2FAOn && hook.setup2FA && !hook.setup2FA.base32Secret && (
            <div className="flex flex-col items-center gap-3 py-6">
              <p className="text-sm text-muted-foreground text-center">
                Tài khoản chưa có khóa 2FA. Tạo khóa mới để bắt đầu thiết lập.
              </p>
              <Button onClick={hook.submitRegenerate2FA} disabled={hook.isRegenerating}>
                {hook.isRegenerating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Tạo khóa 2FA
              </Button>
            </div>
          )}

          {/* Có secret — hiện QR + OTP */}
          {!is2FAOn && hook.setup2FA && hook.setup2FA.base32Secret && (
            <>
              {/* QR Code */}
              <div className="flex justify-center">
                {hook.qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={hook.qrDataUrl}
                    alt="QR Code"
                    className="rounded-lg border-4 border-white bg-white"
                    width={220}
                    height={220}
                  />
                ) : (
                  <Skeleton className="h-[220px] w-[220px] rounded-lg" />
                )}
              </div>

              {/* Secret key fallback */}
              <div className="space-y-1.5">
                <Label className="text-xs">Mã bí mật (nếu không quét được QR)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={hook.setup2FA.base32Secret}
                    className="font-mono text-xs"
                  />
                  <Button variant="outline" size="icon" onClick={copySecret} title="Copy">
                    {copied ? (
                      <Check className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Loading state */}
          {!is2FAOn && !hook.setup2FA && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* OTP input — hiện khi có secret hoặc đang tắt 2FA */}
          {(is2FAOn || (hook.setup2FA && hook.setup2FA.base32Secret)) && (
            <div className="space-y-2">
              <Label>Mã xác minh (6 chữ số)</Label>
              <div className="flex justify-center gap-2">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      hook.otpRefs.current[i] = el
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={hook.totpCode[i] || ""}
                    onChange={(e) => hook.handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => hook.handleOtpKeyDown(i, e)}
                    className="size-11 text-lg font-bold text-center font-mono rounded-md border-2 border-input bg-background outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2 sm:gap-0">
          <Button variant="outline" className="h-10" onClick={() => hook.setShow2FADialog(false)}>
            Hủy
          </Button>
          <Button
            className="h-10"
            variant={is2FAOn ? "destructive" : "default"}
            onClick={hook.submitToggle2FA}
            disabled={hook.isToggling2FA || hook.totpCode.length !== 6}
          >
            {hook.isToggling2FA && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {is2FAOn ? "Tắt 2FA" : "Xác minh & Bật"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ProfileSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Skeleton className="h-[400px] rounded-xl" />
      <div className="lg:col-span-2 space-y-6">
        <Skeleton className="h-[200px] rounded-xl" />
        <Skeleton className="h-[260px] rounded-xl" />
        <Skeleton className="h-[200px] rounded-xl" />
      </div>
    </div>
  )
}

// ─── Linking Section (email verify + telegram link) ─────────────────────────

function ApiKeySection() {
  const trpc = useTRPC()
  const keysQuery = useQuery(trpc.apiKey.list.queryOptions())
  const myKey = (keysQuery.data ?? []).find((k) => k.status !== "revoked") ?? null

  const [reveal, setReveal] = useState<{ keyId: string; key: string } | null>(null)
  const [ipDraft, setIpDraft] = useState("")
  const [ipDirty, setIpDirty] = useState(false)

  // Reset draft khi key thay đổi
  useEffect(() => {
    if (myKey) {
      setIpDraft((myKey.ipWhitelist ?? []).join("\n"))
      setIpDirty(false)
    }
  }, [myKey?.id, myKey?.ipWhitelist?.join(",")])

  const createMut = useMutation(
    trpc.apiKey.create.mutationOptions({
      onSuccess: (res) => {
        toast.success("Đã tạo API key")
        setReveal({ keyId: res.id, key: res.apiKey })
        void keysQuery.refetch()
      },
      onError: (e) => toast.error(e.message),
    })
  )
  const rotateMut = useMutation(
    trpc.apiKey.rotate.mutationOptions({
      onSuccess: (res) => {
        if (myKey) setReveal({ keyId: myKey.id, key: res.apiKey })
        void keysQuery.refetch()
      },
      onError: (e) => toast.error(e.message),
    })
  )
  const revokeMut = useMutation(
    trpc.apiKey.revoke.mutationOptions({
      onSuccess: () => {
        toast.success("Đã thu hồi key")
        void keysQuery.refetch()
      },
      onError: (e) => toast.error(e.message),
    })
  )
  const updateMut = useMutation(
    trpc.apiKey.update.mutationOptions({
      onSuccess: () => {
        toast.success("Đã cập nhật IP whitelist")
        setIpDirty(false)
        void keysQuery.refetch()
      },
      onError: (e) => toast.error(e.message),
    })
  )

  function handleCreate() {
    createMut.mutate({
      name: "Agency API",
      scopes: ["*"],
      ipWhitelist: [],
      rateLimitPerMin: 60,
    })
  }

  function handleSaveIp() {
    if (!myKey) return
    const list = ipDraft
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
    updateMut.mutate({ id: myKey.id, ipWhitelist: list })
  }

  return (
    <SectionCard
      title="API Key (Agency)"
      desc="Khóa tích hợp REST API để bán lại catalog. Mỗi tài khoản có 1 key duy nhất với toàn quyền thao tác."
    >
      {keysQuery.isLoading ? (
        <div className="px-6 py-6 text-sm text-muted-foreground">Đang tải...</div>
      ) : !myKey ? (
        <div className="px-6 py-6 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium">Chưa có API key</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tạo key để gọi REST API. Key sinh ra có toàn quyền. Xem tài liệu tại{" "}
              <a href="/document-api" className="text-primary hover:underline font-medium">
                /document-api
              </a>
              .
            </p>
          </div>
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={createMut.isPending}
            className="shrink-0"
          >
            <KeyRound className="h-4 w-4 mr-1.5" />
            {createMut.isPending ? "Đang tạo..." : "Tạo API key"}
          </Button>
        </div>
      ) : (
        <>
          <FieldRow
            icon={KeyRound}
            label="API Key"
            value={
              <span className="font-mono text-sm">
                {myKey.prefix}… · ẩn
              </span>
            }
            badge={
              <span
                className={cn(
                  "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border",
                  myKey.status === "active"
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                    : "bg-amber-500/10 text-amber-600 border-amber-500/30"
                )}
              >
                {myKey.status}
              </span>
            }
            action={
              myKey.status === "active" ? (
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (!confirm("Rotate sẽ tạo secret mới và vô hiệu hóa key cũ. Tiếp tục?")) return
                      rotateMut.mutate({ id: myKey.id })
                    }}
                    disabled={rotateMut.isPending}
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                    Rotate
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (!confirm("Thu hồi key vĩnh viễn?")) return
                      revokeMut.mutate({ id: myKey.id })
                    }}
                    disabled={revokeMut.isPending}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Thu hồi
                  </Button>
                </div>
              ) : null
            }
          />

          {/* IP whitelist row */}
          <div className="flex items-start gap-4 px-6 py-4">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground shrink-0">
              <Globe2 className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
                IP Whitelist
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 mb-2">
                Mỗi IP/CIDR 1 dòng. Để trống = cho phép mọi IP. Ví dụ: <code className="text-foreground font-mono">192.168.1.0/24</code>
              </p>
              <textarea
                value={ipDraft}
                onChange={(e) => {
                  setIpDraft(e.target.value)
                  setIpDirty(true)
                }}
                rows={3}
                placeholder={"1.2.3.4\n10.0.0.0/24"}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3"
                disabled={myKey.status !== "active" || updateMut.isPending}
              />
              {ipDirty && (
                <div className="flex items-center gap-2 mt-2">
                  <Button
                    size="sm"
                    onClick={handleSaveIp}
                    disabled={updateMut.isPending}
                  >
                    {updateMut.isPending ? "Đang lưu..." : "Lưu"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setIpDraft((myKey.ipWhitelist ?? []).join("\n"))
                      setIpDirty(false)
                    }}
                    disabled={updateMut.isPending}
                  >
                    Hủy
                  </Button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {reveal && <RevealApiKeyDialog data={reveal} onClose={() => setReveal(null)} />}
    </SectionCard>
  )
}

function RevealApiKeyDialog({
  data,
  onClose,
}: {
  data: { keyId: string; key: string }
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>API key của bạn</DialogTitle>
          <DialogDescription>
            Đây là lần duy nhất bạn nhìn thấy key đầy đủ. Hãy lưu lại ngay — hệ
            thống không thể hiển thị lại.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>API Key</Label>
          <div className="flex items-stretch gap-2">
            <code className="flex-1 px-3 py-2.5 rounded-md bg-muted font-mono text-xs break-all">
              {data.key}
            </code>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(data.key)
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              }}
            >
              <Copy className="h-3.5 w-3.5 mr-1" />
              {copied ? "Đã copy" : "Copy"}
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Đã lưu, đóng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LinkingSection({ profile, hook }: { profile: any; hook: any }) {
  const emailVerified = profile.emailVerified === 1
  const teleLinked = !!profile.telegramId
  const mailEnabled = profile.mailEnabled !== false
  const telegramLinkEnabled = profile.telegramLinkEnabled !== false

  // Admin chưa bật kênh nào → ẩn cả section
  if (!mailEnabled && !telegramLinkEnabled) return null

  return (
    <SectionCard
      title="Kênh thông báo"
      desc="Xác minh email và liên kết Telegram để nhận thông báo realtime."
    >
      {mailEnabled && (
        <FieldRow
          icon={emailVerified ? BadgeCheck : CircleAlert}
          label="Trạng thái email"
          value={
            emailVerified
              ? "Đã xác minh"
              : "Chưa xác minh — xác minh để nhận thông báo qua email"
          }
          badge={
            emailVerified ? (
              <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20 text-[9px] h-4 uppercase tracking-wider">
                Đã xác minh
              </Badge>
            ) : (
              <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 hover:bg-amber-500/20 text-[9px] h-4 uppercase tracking-wider">
                Chưa xác minh
              </Badge>
            )
          }
          action={
            emailVerified ? null : (
              <Button size="sm" onClick={hook.openVerifyEmailDialog}>
                Xác minh ngay
              </Button>
            )
          }
        />
      )}

      {telegramLinkEnabled && (
        <FieldRow
          icon={teleLinked ? Link2 : Send}
          label="Telegram"
          value={
            teleLinked ? (
              <span>
                Đã liên kết
                {profile.telegramUsername ? (
                  <span className="ml-1 font-mono text-primary">
                    @{profile.telegramUsername}
                  </span>
                ) : null}
              </span>
            ) : (
              "Chưa liên kết — liên kết để nhận thông báo realtime trên Telegram"
            )
          }
          badge={
            teleLinked ? (
              <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20 text-[9px] h-4 uppercase tracking-wider">
                Đã liên kết
              </Badge>
            ) : (
              <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 hover:bg-amber-500/20 text-[9px] h-4 uppercase tracking-wider">
                Chưa liên kết
              </Badge>
            )
          }
          action={
            teleLinked ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={hook.submitUnlinkTelegram}
                disabled={hook.isUnlinkingTele}
                className="gap-1.5"
              >
                {hook.isUnlinkingTele ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Link2Off className="h-3.5 w-3.5" />
                )}
                Hủy liên kết
              </Button>
            ) : (
              <Button size="sm" onClick={hook.openLinkTelegramDialog}>
                Liên kết
              </Button>
            )
          }
        />
      )}
    </SectionCard>
  )
}

// ─── Verify Email Dialog ───────────────────────────────────────────────────

function VerifyEmailDialog({
  hook,
  profile,
}: {
  hook: any
  profile: any
}) {
  // Live countdown
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!hook.showVerifyEmailDialog || !hook.emailOtpExpiresAt) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [hook.showVerifyEmailDialog, hook.emailOtpExpiresAt])

  const remainingSec = hook.emailOtpExpiresAt
    ? Math.max(0, Math.floor((hook.emailOtpExpiresAt - now) / 1000))
    : 0
  const expired = hook.emailOtpExpiresAt && remainingSec === 0

  return (
    <Dialog
      open={hook.showVerifyEmailDialog}
      onOpenChange={hook.setShowVerifyEmailDialog}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Xác minh email</DialogTitle>
          <DialogDescription>
            Mã 6 chữ số đã được gửi tới{" "}
            <span className="font-mono font-medium text-foreground">
              {profile.email}
            </span>
            . Mã có hiệu lực trong 5 phút.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Mã xác minh</Label>
            <div className="flex justify-center gap-2">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <input
                  key={i}
                  ref={(el) => {
                    hook.emailOtpRefs.current[i] = el
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={hook.emailOtp[i] || ""}
                  onChange={(e: any) => hook.handleEmailOtpChange(i, e.target.value)}
                  onKeyDown={(e: any) => hook.handleEmailOtpKeyDown(i, e)}
                  className="size-11 text-lg font-bold text-center font-mono rounded-md border-2 border-input bg-background outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {hook.emailOtpExpiresAt ? (
                expired ? (
                  <span className="text-rose-500">Mã đã hết hạn</span>
                ) : (
                  <>
                    Hiệu lực còn:{" "}
                    <span className="font-mono font-bold text-foreground">
                      {Math.floor(remainingSec / 60)}:
                      {String(remainingSec % 60).padStart(2, "0")}
                    </span>
                  </>
                )
              ) : (
                "Đang gửi mã..."
              )}
            </span>
            <button
              type="button"
              onClick={hook.resendEmailOtp}
              disabled={hook.isRequestingOtp || (!expired && remainingSec > 240)}
              className="text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
            >
              <RefreshCcw className="h-3 w-3" />
              Gửi lại mã
            </button>
          </div>
        </div>

        <DialogFooter className="pt-2 sm:gap-0">
          <Button
            variant="outline"
            className="h-10"
            onClick={() => hook.setShowVerifyEmailDialog(false)}
          >
            Hủy
          </Button>
          <Button
            className="h-10"
            onClick={hook.submitVerifyEmail}
            disabled={hook.isVerifyingEmail || hook.emailOtp.length !== 6 || expired}
          >
            {hook.isVerifyingEmail && (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            )}
            Xác minh
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Link Telegram Dialog ──────────────────────────────────────────────────

function LinkTelegramDialog({ hook }: { hook: any }) {
  const [copied, setCopied] = useState(false)

  const copyDeepLink = () => {
    if (!hook.teleLinkInfo?.deepLink) return
    navigator.clipboard.writeText(hook.teleLinkInfo.deepLink)
    setCopied(true)
    toast.success("Đã sao chép liên kết")
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog
      open={hook.showLinkTelegramDialog}
      onOpenChange={hook.setShowLinkTelegramDialog}
    >
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Liên kết Telegram</DialogTitle>
          <DialogDescription>
            Quét QR hoặc bấm vào liên kết bên dưới để mở chat với bot. Bot sẽ
            tự động xác nhận liên kết khi bạn nhắn <code>/start</code>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {hook.isRequestingTeleLink && !hook.teleLinkInfo && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {hook.teleLinkInfo && (
            <>
              <div className="flex justify-center">
                {hook.teleQrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={hook.teleQrDataUrl}
                    alt="Telegram QR"
                    className="rounded-lg border-4 border-white bg-white"
                    width={220}
                    height={220}
                  />
                ) : (
                  <Skeleton className="h-[220px] w-[220px] rounded-lg" />
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Liên kết bot</Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={hook.teleLinkInfo.deepLink}
                    className="font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyDeepLink}
                    title="Copy"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Bot:{" "}
                  <span className="font-mono text-primary">
                    @{hook.teleLinkInfo.botUsername}
                  </span>{" "}
                  · Mã có hiệu lực 10 phút
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-600">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Đang chờ bạn xác nhận trong Telegram...</span>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="pt-2 sm:gap-0">
          <Button
            variant="outline"
            className="h-10"
            onClick={() => hook.setShowLinkTelegramDialog(false)}
          >
            Đóng
          </Button>
          <Button
            className="h-10"
            variant="outline"
            onClick={hook.openLinkTelegramDialog}
            disabled={hook.isRequestingTeleLink}
          >
            {hook.isRequestingTeleLink ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCcw className="h-4 w-4 mr-2" />
            )}
            Tạo mã mới
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


