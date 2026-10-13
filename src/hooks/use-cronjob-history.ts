"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useTRPC } from "@/trpc/client"
import { useQuery, useMutation, keepPreviousData, useQueryClient } from "@tanstack/react-query"
import { toast } from "@/components/ui/toast"

export type CronjobSortField = "url" | "payment" | "createdAt" | "expiresAt" | "lastRun"
export type CronjobSortDir = "asc" | "desc"

/**
 * useCronjobHistory — Layer 4 (Hook): controller cho trang Cronjob đang chạy.
 *
 * Quản lý: pagination, debounced search, status filter, sort,
 * fetch myCronjobs (auto-refresh 15s), fetch servers,
 * mutations: toggleStatus, edit, extend, delete,
 * modal state: editing, extending, deleting + pricing computed.
 */
export function useCronjobHistory() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const router = useRouter()

  // ─── Form state ──────────────────────────────────────────────────────────
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [sortField, setSortField] = useState<CronjobSortField>("createdAt")
  const [sortDir, setSortDir] = useState<CronjobSortDir>("desc")

  // ─── Modal state: Edit ───────────────────────────────────────────────────
  const [editingJob, setEditingJob] = useState<any>(null)
  const [editUrl, setEditUrl] = useState("")
  const [editMethod, setEditMethod] = useState<"GET" | "POST">("GET")
  const [editInterval, setEditInterval] = useState("")
  const [editHeaders, setEditHeaders] = useState("")
  const [editBody, setEditBody] = useState("")

  // ─── Modal state: Extend / Delete ────────────────────────────────────────
  const [extendingJob, setExtendingJob] = useState<any>(null)
  const [extendMonths, setExtendMonths] = useState("1")
  const [deletingJob, setDeletingJob] = useState<any>(null)

  // ─── Search debounce 300ms ───────────────────────────────────────────────
  useEffect(() => {
    const id = setTimeout(() => {
      if (searchInput !== search) {
        setSearch(searchInput.trim())
        setPage(1)
      }
    }, 300)
    return () => clearTimeout(id)
  }, [searchInput, search])

  // ─── Server queries ──────────────────────────────────────────────────────
  const { data, isLoading, isFetching } = useQuery({
    ...trpc.cronjob.myCronjobs.queryOptions({
      page,
      limit,
      search: search || undefined,
      status: (statusFilter || undefined) as any,
      sortField,
      sortDir,
    }),
    placeholderData: keepPreviousData,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  }) as { data: any; isLoading: boolean; isFetching: boolean }

  const { data: servers = [] } = useQuery(
    trpc.cronjob.listServers.queryOptions()
  ) as { data: any[] }

  const items = data?.items || []
  const totalPages = data?.pagination?.totalPages || 1
  const total = data?.pagination?.total || 0
  const startRow = total > 0 ? (page - 1) * limit + 1 : 0
  const endRow = Math.min(page * limit, total)

  // ─── Computed: server cho job đang edit/extend ───────────────────────────
  const editingServer = useMemo(
    () => (editingJob ? servers.find((s) => s.id === editingJob.serverId) || null : null),
    [editingJob, servers]
  )

  const extendingServer = useMemo(
    () => (extendingJob ? servers.find((s) => s.id === extendingJob.serverId) || null : null),
    [extendingJob, servers]
  )

  const extendCost = useMemo(
    () => (extendingServer ? extendingServer.price * parseInt(extendMonths || "1") : 0),
    [extendingServer, extendMonths]
  )

  // ─── Mutations ───────────────────────────────────────────────────────────
  const toggleStatusMut = useMutation({
    ...trpc.cronjob.toggleStatus.mutationOptions(),
    onSuccess: (res: any) => {
      toast.success(res.status === "active" ? "Đã bật cronjob" : "Đã tạm dừng cronjob")
      queryClient.invalidateQueries({ queryKey: trpc.cronjob.myCronjobs.queryKey() })
    },
    onError: (err: any) => toast.error(err?.message || "Thao tác thất bại"),
  })

  const editMut = useMutation({
    ...trpc.cronjob.edit.mutationOptions(),
    onSuccess: (res: any) => {
      toast.success(res?.message || "Đã cập nhật cronjob")
      setEditingJob(null)
      queryClient.invalidateQueries({ queryKey: trpc.cronjob.myCronjobs.queryKey() })
    },
    onError: (err: any) => toast.error(err?.message || "Cập nhật thất bại"),
  })

  const extendMut = useMutation({
    ...trpc.cronjob.extend.mutationOptions(),
    onSuccess: (res: any) => {
      toast.success(res?.message || "Đã gia hạn")
      setExtendingJob(null)
      queryClient.invalidateQueries({ queryKey: trpc.cronjob.myCronjobs.queryKey() })
      queryClient.invalidateQueries({ queryKey: trpc.dashboard.stats.queryKey() })
      queryClient.invalidateQueries({ queryKey: trpc.dashboard.recentTransactions.queryKey() })
      router.refresh()
    },
    onError: (err: any) => toast.error(err?.message || "Gia hạn thất bại"),
  })

  const deleteMut = useMutation({
    ...trpc.cronjob.delete.mutationOptions(),
    onSuccess: () => {
      toast.success("Đã xóa cronjob")
      setDeletingJob(null)
      queryClient.invalidateQueries({ queryKey: trpc.cronjob.myCronjobs.queryKey() })
      queryClient.invalidateQueries({ queryKey: trpc.cronjob.listServers.queryKey() })
    },
    onError: (err: any) => toast.error(err?.message || "Xóa thất bại"),
  })

  // ─── Handlers ────────────────────────────────────────────────────────────
  const toggleSort = useCallback((field: CronjobSortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"))
        return prev
      }
      setSortDir("desc")
      return field
    })
    setPage(1)
  }, [])

  const handleStatusChange = useCallback((v: string) => {
    setStatusFilter(v)
    setPage(1)
  }, [])

  const handleLimitChange = useCallback((n: number) => {
    setLimit(n)
    setPage(1)
  }, [])

  const onCopy = useCallback(async (text: string) => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      toast.success("Đã copy URL")
    } catch {
      toast.error("Copy thất bại")
    }
  }, [])

  const openEdit = useCallback((job: any) => {
    setEditingJob(job)
    setEditUrl(job.url || "")
    setEditMethod((job.method || "GET") as "GET" | "POST")
    setEditInterval(String(job.intervalSeconds || ""))
    setEditHeaders(job.headers || "")
    setEditBody(job.body || "")
  }, [])

  const openExtend = useCallback((job: any) => {
    setExtendingJob(job)
    setExtendMonths("1")
  }, [])

  const handleToggleStatus = useCallback(
    (jobId: string) => toggleStatusMut.mutate({ jobId }),
    [toggleStatusMut]
  )

  const handleSubmitEdit = useCallback(() => {
    if (!editingJob) return
    editMut.mutate({
      jobId: editingJob.id,
      url: editUrl.trim(),
      method: editMethod,
      intervalSeconds: parseInt(editInterval || "0"),
      headers: editHeaders.trim() || null,
      body: editMethod === "POST" ? editBody.trim() || null : null,
    })
  }, [editingJob, editUrl, editMethod, editInterval, editHeaders, editBody, editMut])

  const handleSubmitExtend = useCallback(() => {
    if (!extendingJob) return
    extendMut.mutate({
      jobId: extendingJob.id,
      additionalMonths: parseInt(extendMonths),
    })
  }, [extendingJob, extendMonths, extendMut])

  const handleConfirmDelete = useCallback(() => {
    if (deletingJob) deleteMut.mutate({ jobId: deletingJob.id })
  }, [deletingJob, deleteMut])

  return {
    // Data
    items,
    servers,
    isLoading,
    isFetching,
    total,
    totalPages,
    startRow,
    endRow,

    // Filter / sort
    page,
    setPage,
    limit,
    setLimit: handleLimitChange,
    searchInput,
    setSearchInput,
    statusFilter,
    setStatusFilter: handleStatusChange,
    sortField,
    sortDir,
    toggleSort,

    // Actions
    handleToggleStatus,
    isTogglingStatus: toggleStatusMut.isPending,
    onCopy,

    // Edit modal
    editingJob,
    setEditingJob,
    openEdit,
    editUrl,
    setEditUrl,
    editMethod,
    setEditMethod,
    editInterval,
    setEditInterval,
    editHeaders,
    setEditHeaders,
    editBody,
    setEditBody,
    editingServer,
    handleSubmitEdit,
    isSavingEdit: editMut.isPending,

    // Extend modal
    extendingJob,
    setExtendingJob,
    openExtend,
    extendMonths,
    setExtendMonths,
    extendingServer,
    extendCost,
    handleSubmitExtend,
    isExtending: extendMut.isPending,

    // Delete modal
    deletingJob,
    setDeletingJob,
    handleConfirmDelete,
    isDeleting: deleteMut.isPending,
  }
}
