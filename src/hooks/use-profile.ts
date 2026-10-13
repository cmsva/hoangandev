"use client"

/**
 * useProfile — Client-side controller cho /customer/profile
 *
 * Quản lý state form, dialog, mutations, OTP input.
 */
import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useTRPC } from "@/trpc/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@/components/ui/toast"

export function useProfile() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const router = useRouter()

  // ─── Server queries ──────────────────────────────────────────────────────
  const profileQuery = useQuery(trpc.profile.get.queryOptions()) as {
    data: any
    isLoading: boolean
    refetch: () => void
  }

  const setup2FAQuery = useQuery({
    ...trpc.profile.get2FASetup.queryOptions(),
    enabled: false, // chỉ fetch khi mở dialog
  }) as { data: any; refetch: () => Promise<any> }

  // ─── Dialog states ───────────────────────────────────────────────────────
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [showFullnameDialog, setShowFullnameDialog] = useState(false)
  const [showEmailDialog, setShowEmailDialog] = useState(false)
  const [showAvatarDialog, setShowAvatarDialog] = useState(false)
  const [show2FADialog, setShow2FADialog] = useState(false)
  const [showVerifyEmailDialog, setShowVerifyEmailDialog] = useState(false)
  const [showLinkTelegramDialog, setShowLinkTelegramDialog] = useState(false)

  // ─── Form states ─────────────────────────────────────────────────────────
  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [newFullname, setNewFullname] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [newAvatar, setNewAvatar] = useState("")
  const [totpCode, setTotpCode] = useState("")
  const [emailOtp, setEmailOtp] = useState("")
  const [emailOtpExpiresAt, setEmailOtpExpiresAt] = useState<number | null>(null)

  // OTP input refs (6 digits) — dùng cho 2FA totpCode
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])
  // Email OTP input refs riêng
  const emailOtpRefs = useRef<(HTMLInputElement | null)[]>([])

  const handleOtpChange = useCallback((index: number, value: string) => {
    if (!/^\d?$/.test(value)) return
    setTotpCode((prev) => {
      const arr = prev.split("")
      arr[index] = value
      return arr.join("").slice(0, 6)
    })
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus()
    }
  }, [])

  const handleOtpKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent) => {
      if (e.key === "Backspace" && !totpCode[index] && index > 0) {
        otpRefs.current[index - 1]?.focus()
      }
    },
    [totpCode]
  )

  const handleEmailOtpChange = useCallback((index: number, value: string) => {
    if (!/^\d?$/.test(value)) return
    setEmailOtp((prev) => {
      const arr = prev.split("")
      arr[index] = value
      return arr.join("").slice(0, 6)
    })
    if (value && index < 5) {
      emailOtpRefs.current[index + 1]?.focus()
    }
  }, [])

  const handleEmailOtpKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent) => {
      if (e.key === "Backspace" && !emailOtp[index] && index > 0) {
        emailOtpRefs.current[index - 1]?.focus()
      }
    },
    [emailOtp]
  )

  // ─── Reset helpers ───────────────────────────────────────────────────────
  const closeAll = useCallback(() => {
    setShowPasswordDialog(false)
    setShowFullnameDialog(false)
    setShowEmailDialog(false)
    setShowAvatarDialog(false)
    setShow2FADialog(false)
    setShowVerifyEmailDialog(false)
    setShowLinkTelegramDialog(false)
    setOldPassword("")
    setNewPassword("")
    setNewFullname("")
    setNewEmail("")
    setNewAvatar("")
    setTotpCode("")
    setEmailOtp("")
  }, [])

  const refetchProfile = useCallback(() => {
    profileQuery.refetch()
    // Session resolved server-side → refresh layout để cập nhật header
    router.refresh()
  }, [profileQuery, router])

  // ─── Mutations ───────────────────────────────────────────────────────────
  const changePasswordMut = useMutation(
    trpc.profile.changePassword.mutationOptions({
      onSuccess: (res: any) => {
        toast.success(res.message)
        closeAll()
      },
      onError: (err: any) => toast.error(err.message),
    })
  )

  const updateFullnameMut = useMutation(
    trpc.profile.updateFullname.mutationOptions({
      onSuccess: (res: any) => {
        toast.success(res.message)
        closeAll()
        refetchProfile()
      },
      onError: (err: any) => toast.error(err.message),
    })
  )

  const updateEmailMut = useMutation(
    trpc.profile.updateEmail.mutationOptions({
      onSuccess: (res: any) => {
        toast.success(res.message)
        closeAll()
        refetchProfile()
      },
      onError: (err: any) => toast.error(err.message),
    })
  )

  const updateAvatarMut = useMutation(
    trpc.profile.updateAvatar.mutationOptions({
      onSuccess: (res: any) => {
        toast.success(res.message)
        closeAll()
        refetchProfile()
      },
      onError: (err: any) => toast.error(err.message),
    })
  )

  const enable2FAMut = useMutation(
    trpc.profile.enable2FA.mutationOptions({
      onSuccess: (res: any) => {
        toast.success(res.message)
        closeAll()
        refetchProfile()
      },
      onError: (err: any) => toast.error(err.message),
    })
  )

  const disable2FAMut = useMutation(
    trpc.profile.disable2FA.mutationOptions({
      onSuccess: (res: any) => {
        toast.success(res.message)
        closeAll()
        refetchProfile()
      },
      onError: (err: any) => toast.error(err.message),
    })
  )

  const regenerate2FAMut = useMutation(
    trpc.profile.regenerate2FA.mutationOptions({
      onSuccess: (res: any) => {
        toast.success(res.message)
        // Refetch setup để lấy secret mới
        setup2FAQuery.refetch()
      },
      onError: (err: any) => toast.error(err.message),
    })
  )

  // ─── Email verify + Telegram link state ─────────────────────────────────
  const [teleLinkInfo, setTeleLinkInfo] = useState<{
    code: string
    deepLink: string
    botUsername: string
    expiresAt: number
    expiresIn: number
  } | null>(null)

  // ─── Email verify + Telegram link ──────────────────────────────────────
  const teleLinkMut = useMutation(
    trpc.profileLink.requestTelegramLink.mutationOptions({
      onSuccess: (res: any) => {
        setTeleLinkInfo(res)
      },
      onError: (err: any) => toast.error(err.message),
    })
  )

  const teleStatusQuery = useQuery({
    ...trpc.profileLink.getTelegramStatus.queryOptions(),
    enabled: showLinkTelegramDialog,
    refetchInterval: showLinkTelegramDialog ? 3000 : false,
  }) as { data: { linked: boolean; telegramUsername: string | null } | undefined }

  // Auto close dialog khi user đã link xong (poll thấy linked = true)
  useEffect(() => {
    if (showLinkTelegramDialog && teleStatusQuery.data?.linked) {
      toast.success("Đã liên kết Telegram thành công!")
      setShowLinkTelegramDialog(false)
      setTeleLinkInfo(null)
      refetchProfile()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teleStatusQuery.data?.linked, showLinkTelegramDialog])

  const unlinkTeleMut = useMutation(
    trpc.profileLink.unlinkTelegram.mutationOptions({
      onSuccess: (res: any) => {
        toast.success(res.message)
        refetchProfile()
      },
      onError: (err: any) => toast.error(err.message),
    })
  )

  const requestEmailOtpMut = useMutation(
    trpc.profileLink.requestEmailOtp.mutationOptions({
      onSuccess: (res: any) => {
        toast.success(res.message)
        setEmailOtpExpiresAt(Date.now() + (res.expiresIn ?? 300) * 1000)
      },
      onError: (err: any) => toast.error(err.message),
    })
  )

  const verifyEmailOtpMut = useMutation(
    trpc.profileLink.verifyEmailOtp.mutationOptions({
      onSuccess: (res: any) => {
        toast.success(res.message)
        setShowVerifyEmailDialog(false)
        setEmailOtp("")
        setEmailOtpExpiresAt(null)
        refetchProfile()
      },
      onError: (err: any) => toast.error(err.message),
    })
  )

  // ─── QR Code generation ──────────────────────────────────────────────────
  const [qrDataUrl, setQrDataUrl] = useState<string>("")

  useEffect(() => {
    if (!show2FADialog || !setup2FAQuery.data?.otpauthUrl) {
      return
    }
    let cancelled = false
    import("qrcode").then((QRCode) => {
      QRCode.toDataURL(setup2FAQuery.data.otpauthUrl, {
        width: 220,
        margin: 2,
      }).then((url) => {
        if (!cancelled) setQrDataUrl(url)
      })
    })
    return () => {
      cancelled = true
    }
  }, [show2FADialog, setup2FAQuery.data?.otpauthUrl])

  // QR cho deep link Telegram
  const [teleQrDataUrl, setTeleQrDataUrl] = useState<string>("")
  useEffect(() => {
    if (!showLinkTelegramDialog || !teleLinkInfo?.deepLink) {
      setTeleQrDataUrl("")
      return
    }
    let cancelled = false
    import("qrcode").then((QRCode) => {
      QRCode.toDataURL(teleLinkInfo.deepLink, { width: 220, margin: 2 }).then((url) => {
        if (!cancelled) setTeleQrDataUrl(url)
      })
    })
    return () => {
      cancelled = true
    }
  }, [showLinkTelegramDialog, teleLinkInfo?.deepLink])

  // ─── Open dialog handlers ────────────────────────────────────────────────
  const openFullnameDialog = useCallback(() => {
    setNewFullname(profileQuery.data?.fullname || "")
    setShowFullnameDialog(true)
  }, [profileQuery.data?.fullname])

  const openEmailDialog = useCallback(() => {
    setNewEmail(profileQuery.data?.email || "")
    setShowEmailDialog(true)
  }, [profileQuery.data?.email])

  const openAvatarDialog = useCallback(() => {
    setNewAvatar(profileQuery.data?.avatar || "")
    setShowAvatarDialog(true)
  }, [profileQuery.data?.avatar])

  const open2FADialog = useCallback(async () => {
    setTotpCode("")
    setShow2FADialog(true)
    // Fetch setup info chỉ khi cần
    await setup2FAQuery.refetch()
  }, [setup2FAQuery])

  const openVerifyEmailDialog = useCallback(() => {
    setEmailOtp("")
    setEmailOtpExpiresAt(null)
    setShowVerifyEmailDialog(true)
    requestEmailOtpMut.mutate()
  }, [requestEmailOtpMut])

  const openLinkTelegramDialog = useCallback(() => {
    setTeleLinkInfo(null)
    setShowLinkTelegramDialog(true)
    teleLinkMut.mutate()
  }, [teleLinkMut])

  // ─── Submit handlers ─────────────────────────────────────────────────────
  const submitChangePassword = () => {
    if (!oldPassword || newPassword.length < 6) return
    changePasswordMut.mutate({ oldPassword, newPassword })
  }

  const submitUpdateFullname = () => {
    if (newFullname.trim().length < 2) return
    updateFullnameMut.mutate({ fullname: newFullname.trim() })
  }

  const submitUpdateEmail = () => {
    const email = newEmail.trim().toLowerCase()
    if (!email || email === profileQuery.data?.email) return
    updateEmailMut.mutate({ email })
  }

  const submitUpdateAvatar = () => {
    updateAvatarMut.mutate({ avatar: newAvatar.trim() })
  }

  const submitToggle2FA = () => {
    if (totpCode.length !== 6) return
    if (profileQuery.data?.status2fa === 1) {
      disable2FAMut.mutate({ code: totpCode })
    } else {
      enable2FAMut.mutate({ code: totpCode })
    }
  }

  const submitVerifyEmail = () => {
    if (emailOtp.length !== 6) return
    verifyEmailOtpMut.mutate({ code: emailOtp })
  }

  const resendEmailOtp = () => {
    requestEmailOtpMut.mutate()
  }

  const submitUnlinkTelegram = () => {
    unlinkTeleMut.mutate()
  }

  return {
    // Data
    profile: profileQuery.data,
    isLoading: profileQuery.isLoading,
    setup2FA: setup2FAQuery.data,
    qrDataUrl,
    teleQrDataUrl,
    teleLinkInfo,
    teleLinkStatus: teleStatusQuery.data,
    emailOtpExpiresAt,

    // Dialog states
    showPasswordDialog,
    setShowPasswordDialog,
    showFullnameDialog,
    setShowFullnameDialog,
    showEmailDialog,
    setShowEmailDialog,
    showAvatarDialog,
    setShowAvatarDialog,
    show2FADialog,
    setShow2FADialog,
    showVerifyEmailDialog,
    setShowVerifyEmailDialog,
    showLinkTelegramDialog,
    setShowLinkTelegramDialog,

    // Form fields
    oldPassword,
    setOldPassword,
    newPassword,
    setNewPassword,
    newFullname,
    setNewFullname,
    newEmail,
    setNewEmail,
    newAvatar,
    setNewAvatar,
    totpCode,
    setTotpCode,
    emailOtp,
    setEmailOtp,

    // OTP refs
    otpRefs,
    handleOtpChange,
    handleOtpKeyDown,
    emailOtpRefs,
    handleEmailOtpChange,
    handleEmailOtpKeyDown,

    // Open handlers
    openFullnameDialog,
    openEmailDialog,
    openAvatarDialog,
    open2FADialog,
    openVerifyEmailDialog,
    openLinkTelegramDialog,

    // Submit handlers
    submitChangePassword,
    submitUpdateFullname,
    submitUpdateEmail,
    submitUpdateAvatar,
    submitToggle2FA,
    submitRegenerate2FA: () => regenerate2FAMut.mutate(),
    submitVerifyEmail,
    resendEmailOtp,
    submitUnlinkTelegram,

    // Mutation states
    isChangingPassword: changePasswordMut.isPending,
    isUpdatingFullname: updateFullnameMut.isPending,
    isUpdatingEmail: updateEmailMut.isPending,
    isUpdatingAvatar: updateAvatarMut.isPending,
    isToggling2FA: enable2FAMut.isPending || disable2FAMut.isPending,
    isRegenerating: regenerate2FAMut.isPending,
    isRequestingOtp: requestEmailOtpMut.isPending,
    isVerifyingEmail: verifyEmailOtpMut.isPending,
    isRequestingTeleLink: teleLinkMut.isPending,
    isUnlinkingTele: unlinkTeleMut.isPending,
  }
}
