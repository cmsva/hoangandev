"use client"

/**
 * usePasskey — client controller cho Passkey (WebAuthn).
 *
 * Hai luồng:
 *  - Quản lý (trong profile): list + register + rename + delete.
 *  - Đăng nhập (trang login): loginWithPasskey().
 *
 * Browser API (`startRegistration`, `startAuthentication`) import động để không
 * nặng bundle trang không dùng.
 */
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTRPC } from "@/trpc/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@/components/ui/toast"

/** Kiểm tra trình duyệt có hỗ trợ WebAuthn không. */
export function isPasskeySupported(): boolean {
  return typeof window !== "undefined" && !!window.PublicKeyCredential
}

export function usePasskeyManager() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const listQuery = useQuery(trpc.passkey.list.queryOptions())

  const [isRegistering, setIsRegistering] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)

  const registerOptionsMut = useMutation(trpc.passkey.registerOptions.mutationOptions())
  const registerVerifyMut = useMutation(trpc.passkey.registerVerify.mutationOptions())
  const renameMut = useMutation(trpc.passkey.rename.mutationOptions())
  const deleteMut = useMutation(trpc.passkey.delete.mutationOptions())

  async function refetchList() {
    await queryClient.invalidateQueries({ queryKey: trpc.passkey.list.queryKey() })
  }

  /** Đăng ký passkey mới — name do user đặt. */
  async function addPasskey(name: string) {
    if (!isPasskeySupported()) {
      toast.error("Trình duyệt không hỗ trợ Passkey")
      return
    }
    setIsRegistering(true)
    try {
      const { startRegistration } = await import("@simplewebauthn/browser")
      const options = await registerOptionsMut.mutateAsync()
      let attResp
      try {
        attResp = await startRegistration({ optionsJSON: options as any })
      } catch (err: any) {
        // User hủy prompt hoặc lỗi thiết bị
        if (err?.name === "NotAllowedError") {
          toast.error("Đã hủy thao tác Passkey")
        } else {
          toast.error("Không thể tạo Passkey trên thiết bị này")
        }
        return
      }
      await registerVerifyMut.mutateAsync({
        response: attResp as any,
        name: name.trim() || "Passkey",
      })
      toast.success("Đã thêm Passkey")
      await refetchList()
    } catch (err: any) {
      toast.error(err?.message || "Thêm Passkey thất bại")
    } finally {
      setIsRegistering(false)
    }
  }

  async function rename(id: string, name: string) {
    setRenamingId(id)
    try {
      await renameMut.mutateAsync({ id, name: name.trim() || "Passkey" })
      toast.success("Đã đổi tên Passkey")
      await refetchList()
    } catch (err: any) {
      toast.error(err?.message || "Đổi tên thất bại")
    } finally {
      setRenamingId(null)
    }
  }

  async function remove(id: string) {
    try {
      await deleteMut.mutateAsync({ id })
      toast.success("Đã xóa Passkey")
      await refetchList()
    } catch (err: any) {
      toast.error(err?.message || "Xóa thất bại")
    }
  }

  return {
    passkeys: listQuery.data ?? [],
    isLoading: listQuery.isLoading,
    isRegistering,
    renamingId,
    isDeleting: deleteMut.isPending,
    addPasskey,
    rename,
    remove,
  }
}

/** Hook riêng cho trang login — chỉ cần loginWithPasskey. */
export function usePasskeyLogin() {
  const trpc = useTRPC()
  const router = useRouter()
  const [isAuthenticating, setIsAuthenticating] = useState(false)

  const loginOptionsMut = useMutation(trpc.passkey.loginOptions.mutationOptions())
  const loginVerifyMut = useMutation(trpc.passkey.loginVerify.mutationOptions())

  async function loginWithPasskey() {
    if (!isPasskeySupported()) {
      toast.error("Trình duyệt không hỗ trợ Passkey")
      return
    }
    setIsAuthenticating(true)
    try {
      const { startAuthentication } = await import("@simplewebauthn/browser")
      const options = await loginOptionsMut.mutateAsync()
      let authResp
      try {
        authResp = await startAuthentication({ optionsJSON: options as any })
      } catch (err: any) {
        if (err?.name === "NotAllowedError") {
          toast.error("Đã hủy đăng nhập Passkey")
        } else {
          toast.error("Không tìm thấy Passkey phù hợp trên thiết bị")
        }
        return
      }
      await loginVerifyMut.mutateAsync({ response: authResp as any })
      toast.success("Đăng nhập thành công!")
      window.location.href = "/dashboard"
    } catch (err: any) {
      toast.error(err?.message || "Đăng nhập Passkey thất bại")
    } finally {
      setIsAuthenticating(false)
    }
  }

  return { isAuthenticating, loginWithPasskey }
}
