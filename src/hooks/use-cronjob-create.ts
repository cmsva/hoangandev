"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { toast } from "@/components/ui/toast"
import { useTRPC } from "@/trpc/client"
import { useGuestGate } from "@/hooks/use-guest-gate"

export type CronjobServerOption = {
  id: string
  name: string
  price: number
  originalPrice: number
  discountPercent: number
  timeloop: number
  remaining: number
  full: boolean
}

export function useCronjobCreate() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const router = useRouter()
  const { requireAuth } = useGuestGate()
  const [url, setUrl] = useState("")
  const [intervalSeconds, setIntervalSeconds] = useState("")
  const [months, setMonths] = useState("1")
  const [serverId, setServerId] = useState("")
  const [serverOpen, setServerOpen] = useState(false)
  const [method, setMethod] = useState<"GET" | "POST">("GET")
  const [headers, setHeaders] = useState("")
  const [body, setBody] = useState("")
  const [showAdvanced, setShowAdvanced] = useState(false)

  const { data: servers = [], isLoading: isLoadingServers } = useQuery(
    trpc.cronjob.listServers.queryOptions()
  ) as { data: CronjobServerOption[]; isLoading: boolean }

  const selectedServer = servers.find((server) => server.id === serverId)
  const selectedIndex = servers.findIndex((server) => server.id === serverId) + 1
  const totalPay = useMemo(() => selectedServer ? selectedServer.price * parseInt(months || "1") : 0, [selectedServer, months])

  const createMut = useMutation({
    ...trpc.cronjob.create.mutationOptions(),
    onSuccess: async (res) => {
      toast.success(res.message || "Tạo cronjob thành công")
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: trpc.dashboard.stats.queryKey() }),
        queryClient.invalidateQueries({ queryKey: trpc.dashboard.recentTransactions.queryKey() }),
        queryClient.invalidateQueries({ queryKey: trpc.cronjob.myCronjobs.queryKey() }),
        queryClient.invalidateQueries({ queryKey: trpc.cronjob.listServers.queryKey() }),
      ])
      router.refresh()
      router.push("/customer/history/cronjob")
    },
    onError: (err) => toast.error(err.message || "Tạo cronjob thất bại"),
  })

  function submit() {
    // Guest → redirect login (backend cũng chặn, đây chỉ là UX).
    if (requireAuth(() => true) !== true) return
    if (!url) return toast.error("Vui lòng nhập URL Cronjob")
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return toast.error("URL phải bắt đầu bằng http:// hoặc https://")
    }
    if (!serverId) return toast.error("Vui lòng chọn máy chủ")
    const interval = parseInt(intervalSeconds)
    if (!interval || interval < 1) {
      return toast.error("Số giây phải lớn hơn 0")
    }
    // server.timeloop là vòng lặp tối thiểu admin set cho từng server.
    if (selectedServer && interval < selectedServer.timeloop) {
      return toast.error(`Vòng lặp tối thiểu ${selectedServer.timeloop} giây`)
    }

    createMut.mutate({
      serverId,
      url: url.trim(),
      method,
      intervalSeconds: interval,
      month: parseInt(months),
      headers: headers.trim() || null,
      body: method === "POST" ? body.trim() || null : null,
    })
  }

  async function pasteUrl() {
    try {
      const text = await navigator.clipboard.readText()
      setUrl(text)
      toast.success("Đã dán URL từ clipboard")
    } catch {
      toast.error("Không thể đọc clipboard")
    }
  }

  return {
    url,
    setUrl,
    intervalSeconds,
    setIntervalSeconds,
    months,
    setMonths,
    serverId,
    setServerId,
    serverOpen,
    setServerOpen,
    method,
    setMethod,
    headers,
    setHeaders,
    body,
    setBody,
    showAdvanced,
    setShowAdvanced,
    servers,
    isLoadingServers,
    selectedServer,
    selectedIndex,
    totalPay,
    isCreating: createMut.isPending,
    submit,
    pasteUrl,
  }
}
