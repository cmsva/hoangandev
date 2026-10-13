"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { useTRPC } from "@/trpc/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@/components/ui/toast"
import type {
  CampaignType,
  CampaignAudience,
  CampaignStatus,
} from "@/models/campaign.model"

export type AudienceFilter = CampaignAudience
export interface ButtonInput {
  text: string
  url: string
}

/**
 * useCampaigns — Layer 4 hook. Quản lý:
 *  - List + filter + pagination
 *  - Editor state (cho create/edit)
 *  - Audience preview
 *  - Mutations (create/update/queue/cancel/delete/test)
 */
export function useCampaigns(campaignType: CampaignType) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  // ─── List filters ────────────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | "all">("all")
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [page, setPage] = useState(1)
  const limit = 20

  const listQuery = useQuery(
    trpc.adminCampaign.list.queryOptions({
      type: campaignType,
      status: statusFilter,
      search: search || undefined,
      page,
      limit,
    })
  )

  // ─── Editor state ────────────────────────────────────────────────────────
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [subject, setSubject] = useState("")
  const [content, setContent] = useState("")
  const [audience, setAudience] = useState<AudienceFilter>(
    campaignType === "mail" ? "verified_email" : "linked_telegram"
  )
  const [scheduledAt, setScheduledAt] = useState<string>("") // ISO local
  const [buttons, setButtons] = useState<ButtonInput[]>([])

  // Audience estimate
  const audienceQuery = useQuery({
    ...trpc.adminCampaign.estimateAudience.queryOptions({ type: campaignType, audience }),
    enabled: editorOpen,
  })

  // Detail (when editing)
  const detailQuery = useQuery({
    ...trpc.adminCampaign.detail.queryOptions({ id: editingId || "" }),
    enabled: !!editingId,
  })

  useEffect(() => {
    if (detailQuery.data && editingId) {
      const d = detailQuery.data as any
      setName(d.name)
      setSubject(d.subject)
      setContent(d.content)
      setAudience(d.audience)
      setButtons(d.telegramButtons || [])
      setScheduledAt(d.scheduledAt ? toLocalIsoForInput(new Date(d.scheduledAt)) : "")
    }
  }, [detailQuery.data, editingId])

  function resetEditor() {
    setEditingId(null)
    setName("")
    setSubject("")
    setContent("")
    setAudience(campaignType === "mail" ? "verified_email" : "linked_telegram")
    setScheduledAt("")
    setButtons([])
  }

  function openCreate() {
    resetEditor()
    setEditorOpen(true)
  }

  function openEdit(id: string) {
    resetEditor()
    setEditingId(id)
    setEditorOpen(true)
  }

  function closeEditor() {
    setEditorOpen(false)
    resetEditor()
  }

  // ─── Mutations ───────────────────────────────────────────────────────────
  const invalidateList = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: trpc.adminCampaign.list.queryOptions({
        type: campaignType,
        status: statusFilter,
        search: search || undefined,
        page,
        limit,
      }).queryKey,
    })
  }, [queryClient, trpc, campaignType, statusFilter, search, page])

  const createMut = useMutation(
    trpc.adminCampaign.create.mutationOptions({
      onSuccess: (res: any) => {
        toast.success("Đã tạo chiến dịch (Bản nháp)")
        setEditingId(res.id)
        invalidateList()
      },
      onError: (err: any) => toast.error(err.message),
    })
  )

  const updateMut = useMutation(
    trpc.adminCampaign.update.mutationOptions({
      onSuccess: () => {
        toast.success("Đã cập nhật")
        invalidateList()
        if (editingId) {
          queryClient.invalidateQueries({
            queryKey: trpc.adminCampaign.detail.queryOptions({ id: editingId }).queryKey,
          })
        }
      },
      onError: (err: any) => toast.error(err.message),
    })
  )

  const queueMut = useMutation(
    trpc.adminCampaign.queue.mutationOptions({
      onSuccess: (res: any) => {
        toast.success(res.message)
        invalidateList()
        closeEditor()
      },
      onError: (err: any) => toast.error(err.message),
    })
  )

  const cancelMut = useMutation(
    trpc.adminCampaign.cancel.mutationOptions({
      onSuccess: () => {
        toast.success("Đã huỷ chiến dịch")
        invalidateList()
      },
      onError: (err: any) => toast.error(err.message),
    })
  )

  const deleteMut = useMutation(
    trpc.adminCampaign.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Đã xoá chiến dịch")
        invalidateList()
      },
      onError: (err: any) => toast.error(err.message),
    })
  )

  const testSendMut = useMutation(
    trpc.adminCampaign.testSend.mutationOptions({
      onSuccess: (res: any) => toast.success(res.message),
      onError: (err: any) => toast.error(err.message),
    })
  )

  // ─── Save helpers ────────────────────────────────────────────────────────
  function buildPayload() {
    return {
      type: campaignType,
      name: name.trim(),
      subject: subject.trim(),
      content,
      audience,
      telegramButtons: campaignType === "telegram" ? buttons : [],
    }
  }

  async function saveDraft(): Promise<string | null> {
    const payload = buildPayload()
    if (!payload.name) {
      toast.error("Vui lòng nhập tên chiến dịch")
      return null
    }
    if (!payload.content.trim()) {
      toast.error("Nội dung không được để trống")
      return null
    }
    if (campaignType === "mail" && !payload.subject) {
      toast.error("Tiêu đề email không được để trống")
      return null
    }
    if (editingId) {
      await updateMut.mutateAsync({
        id: editingId,
        name: payload.name,
        subject: payload.subject,
        content: payload.content,
        audience: payload.audience,
        telegramButtons: payload.telegramButtons,
      })
      return editingId
    }
    const res = await createMut.mutateAsync(payload)
    return res.id
  }

  async function saveAndQueue() {
    const id = await saveDraft()
    if (!id) return
    queueMut.mutate({
      id,
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
    })
  }

  // ─── Buttons editor helpers (telegram) ───────────────────────────────────
  function addButton() {
    if (buttons.length >= 6) return
    setButtons([...buttons, { text: "", url: "" }])
  }
  function updateButton(idx: number, field: "text" | "url", value: string) {
    setButtons(
      buttons.map((b, i) => (i === idx ? { ...b, [field]: value } : b))
    )
  }
  function removeButton(idx: number) {
    setButtons(buttons.filter((_, i) => i !== idx))
  }

  // ─── Test send ───────────────────────────────────────────────────────────
  function handleTestSend() {
    if (!content.trim()) {
      toast.error("Nội dung không được để trống")
      return
    }
    testSendMut.mutate({
      type: campaignType,
      subject: subject || "Test",
      content,
      telegramButtons: campaignType === "telegram" ? buttons : [],
    })
  }

  // ─── Search submit ───────────────────────────────────────────────────────
  function handleSearchSubmit() {
    setSearch(searchInput.trim())
    setPage(1)
  }

  // ─── Compute readonly flag (campaign chỉ edit được khi draft) ────────────
  const detailStatus: CampaignStatus | undefined = (detailQuery.data as any)?.status
  const readOnly = !!editingId && detailStatus !== "draft"

  return {
    // List
    items: useMemo(() => listQuery.data?.items || [], [listQuery.data]),
    total: listQuery.data?.total || 0,
    totalPages: listQuery.data?.totalPages || 1,
    page,
    setPage,
    isLoadingList: listQuery.isLoading,
    statusFilter,
    setStatusFilter: (s: CampaignStatus | "all") => {
      setStatusFilter(s)
      setPage(1)
    },
    searchInput,
    setSearchInput,
    onSearchSubmit: handleSearchSubmit,

    // Editor
    editorOpen,
    openCreate,
    openEdit,
    closeEditor,
    editingId,
    isLoadingDetail: detailQuery.isLoading,
    readOnly,
    name,
    setName,
    subject,
    setSubject,
    content,
    setContent,
    audience,
    setAudience,
    scheduledAt,
    setScheduledAt,
    buttons,
    addButton,
    updateButton,
    removeButton,

    // Audience preview
    audienceCount: (audienceQuery.data as any)?.count ?? null,
    isLoadingAudience: audienceQuery.isLoading,

    // Actions
    saveDraft: () =>
      saveDraft().then((id) => {
        if (id) toast.success(editingId ? "Đã cập nhật" : "Đã lưu nháp")
      }),
    saveAndQueue,
    cancelCampaign: (id: string) => cancelMut.mutate({ id }),
    deleteCampaign: (id: string) => deleteMut.mutate({ id }),
    testSend: handleTestSend,

    // Statuses
    isSaving: createMut.isPending || updateMut.isPending,
    isQueuing: queueMut.isPending,
    isTesting: testSendMut.isPending,
  }
}

function toLocalIsoForInput(d: Date): string {
  // YYYY-MM-DDTHH:mm
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
