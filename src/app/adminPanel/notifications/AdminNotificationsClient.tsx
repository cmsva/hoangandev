"use client"

import * as React from "react"
import { useTRPC } from "@/trpc/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@/components/ui/toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/confirm-dialog"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import {
  IconPlus,
  IconLoader,
  IconCheck,
  IconTrash,
  IconSearch,
  IconBell,
} from "@/components/icons"
import { cn } from "@/lib/utils"
import { sanitizeRichHtml } from "@/lib/sanitize"
import { GenerateAiButton } from "@/components/admin/generate-ai-button"

interface PickedUser {
  id: string
  username: string
  email: string
  fullname: string | null
  avatar: string | null
  emailVerified: boolean
  hasTelegram: boolean
}

const TYPE_OPTIONS = [
  { value: "general", label: "Chung" },
  { value: "promo", label: "Khuyến mãi" },
  { value: "system", label: "Hệ thống" },
  { value: "service", label: "Dịch vụ" },
  { value: "order", label: "Đơn hàng" },
  { value: "deposit", label: "Nạp tiền" },
  { value: "auth", label: "Bảo mật" },
  { value: "ticket", label: "Hỗ trợ" },
] as const

export function AdminNotificationsClient() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const [search, setSearch] = React.useState("")
  const [searchInput, setSearchInput] = React.useState("")
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [confirmDelete, setConfirmDelete] = React.useState<string | null>(null)
  const limit = 20

  const listQuery = useQuery(
    trpc.adminNotification.list.queryOptions({ page, limit, search: search || undefined })
  )

  // ─── Composer state ─────────────────────────────────────────────────────
  const [type, setType] = React.useState("general")
  const [title, setTitle] = React.useState("")
  const [content, setContent] = React.useState("")
  const [link, setLink] = React.useState("")
  const [target, setTarget] = React.useState<"all" | "users">("all")
  const [pickedUsers, setPickedUsers] = React.useState<PickedUser[]>([])

  const userIdentifiers = React.useMemo(
    () => pickedUsers.map((u) => u.id),
    [pickedUsers]
  )

  const audienceQuery = useQuery({
    ...trpc.adminNotification.countAudience.queryOptions({
      target,
      userIdentifiers,
    }),
    enabled: open,
  })

  const sendMut = useMutation(
    trpc.adminNotification.send.mutationOptions({
      onSuccess: (res: any) => {
        toast.success(res.message)
        queryClient.invalidateQueries({
          queryKey: trpc.adminNotification.list.queryOptions({
            page,
            limit,
            search: search || undefined,
          }).queryKey,
        })
        setOpen(false)
        resetForm()
      },
      onError: (err: any) => toast.error(err.message),
    })
  )

  const deleteMut = useMutation(
    trpc.adminNotification.delete.mutationOptions({
      onSuccess: (res: any) => {
        toast.success(`Đã xoá ${res.deleted} bản ghi`)
        queryClient.invalidateQueries({
          queryKey: trpc.adminNotification.list.queryOptions({
            page,
            limit,
            search: search || undefined,
          }).queryKey,
        })
      },
      onError: (err: any) => toast.error(err.message),
    })
  )

  function resetForm() {
    setType("general")
    setTitle("")
    setContent("")
    setLink("")
    setTarget("all")
    setPickedUsers([])
  }

  function handleSend() {
    if (!title.trim()) {
      toast.error("Vui lòng nhập tiêu đề")
      return
    }
    sendMut.mutate({
      type: type as any,
      title: title.trim(),
      content,
      link: link.trim() || null,
      target,
      userIdentifiers,
    })
  }

  const items = listQuery.data?.items || []
  const total = listQuery.data?.total || 0
  const totalPages = listQuery.data?.totalPages || 1

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2">
            <a href="/adminPanel/dashboard" className="hover:text-foreground transition-colors">
              Admin
            </a>
            <span>/</span>
            <span className="text-foreground font-medium">Thông báo</span>
          </nav>
          <h1 className="text-2xl font-bold tracking-tight">Thông báo</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gửi thông báo trong app cho người dùng
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2">
          <IconPlus size={16} />
          Soạn thông báo
        </Button>
      </div>

      <form
        className="relative max-w-md"
        onSubmit={(e) => {
          e.preventDefault()
          setSearch(searchInput.trim())
          setPage(1)
        }}
      >
        <IconSearch
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          placeholder="Tìm theo tiêu đề..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="h-9 pl-9"
        />
      </form>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tiêu đề / Nội dung</TableHead>
              <TableHead>Loại</TableHead>
              <TableHead>Người nhận</TableHead>
              <TableHead>Đã đọc</TableHead>
              <TableHead>Thời gian</TableHead>
              <TableHead className="text-end">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQuery.isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Chưa có thông báo nào.
                </TableCell>
              </TableRow>
            ) : (
              items.map((it: any) => {
                const readPct = it.recipients > 0 ? Math.round((it.readCount / it.recipients) * 100) : 0
                return (
                  <TableRow key={it.id}>
                    <TableCell className="max-w-[420px]">
                      <div className="font-medium">{it.title}</div>
                      {it.content && (
                        <div
                          className="text-xs text-muted-foreground mt-1 line-clamp-2 [&_strong]:text-foreground"
                          dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(it.content) }}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {typeLabel(it.type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">{it.recipients.toLocaleString("vi-VN")}</TableCell>
                    <TableCell>
                      <div className="text-xs">
                        <span className="font-semibold text-emerald-600">{readPct}%</span>
                        <span className="text-muted-foreground ml-1">
                          ({it.readCount}/{it.recipients})
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(it.createdAt)}
                    </TableCell>
                    <TableCell className="text-end">
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(it.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 px-2.5 py-1 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-500/10"
                      >
                        <IconTrash size={14} />
                      </button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">
            Trang {page} / {totalPages} · {total} đợt
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
            >
              Trước
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
            >
              Sau
            </Button>
          </div>
        </div>
      )}

      {/* Composer */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[820px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Soạn thông báo</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Loại</Label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm w-full"
                >
                  {TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-sm font-medium">Tiêu đề</Label>
                  <GenerateAiButton
                    kind="notification_title"
                    onApply={(text) => setTitle(text)}
                    related={[
                      { label: "Loại", value: type },
                    ]}
                    size="sm"
                    label="Generated by AI"
                  />
                </div>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="VD: Khuyến mãi tháng 12"
                  maxLength={300}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-sm font-medium">Nội dung (HTML)</Label>
                  <GenerateAiButton
                    kind="notification_html"
                    onApply={(html) => setContent(html)}
                    related={[
                      { label: "Loại", value: type },
                      { label: "Tiêu đề", value: title },
                    ]}
                    size="sm"
                    label="Generated by AI"
                  />
                </div>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="<p>Nội dung...</p>"
                  rows={8}
                  className="font-mono text-xs resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Hỗ trợ HTML cơ bản: &lt;strong&gt;, &lt;em&gt;, &lt;a&gt;, &lt;p&gt;, &lt;br&gt;
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Link đính kèm (tuỳ chọn)</Label>
                <Input
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="VD: /customer/deposit"
                />
                <p className="text-xs text-muted-foreground">
                  Khi user bấm vào noti sẽ chuyển đến link này.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Người nhận</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTarget("all")}
                    className={cn(
                      "flex-1 h-9 rounded-md border text-sm font-medium transition-colors",
                      target === "all"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border hover:bg-accent"
                    )}
                  >
                    Tất cả người dùng
                  </button>
                  <button
                    type="button"
                    onClick={() => setTarget("users")}
                    className={cn(
                      "flex-1 h-9 rounded-md border text-sm font-medium transition-colors",
                      target === "users"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border hover:bg-accent"
                    )}
                  >
                    Chọn cụ thể
                  </button>
                </div>
                {target === "users" && (
                  <UserPicker
                    picked={pickedUsers}
                    onAdd={(u) => {
                      if (pickedUsers.some((p) => p.id === u.id)) return
                      setPickedUsers([...pickedUsers, u])
                    }}
                    onRemove={(id) =>
                      setPickedUsers(pickedUsers.filter((u) => u.id !== id))
                    }
                    type={type}
                  />
                )}
              </div>
            </div>

            {/* Preview + audience count */}
            <div className="space-y-3">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Xem trước
              </Label>
              <div className="rounded-xl border bg-card overflow-hidden">
                <div className="border-b border-border px-4 py-3">
                  <h2 className="text-sm font-semibold">Thông báo</h2>
                </div>
                <div className="p-4 hover:bg-accent/50 cursor-pointer transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 shrink-0">
                      <IconBell size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm leading-tight">
                        {title || "(Tiêu đề)"}
                      </h3>
                      {content ? (
                        <div
                          className="mt-1 text-xs text-muted-foreground line-clamp-2 [&_strong]:text-foreground [&_strong]:font-semibold"
                          dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(content) }}
                        />
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground italic">
                          (Chưa có nội dung)
                        </p>
                      )}
                      <div className="mt-2 text-xs text-muted-foreground">Vừa xong</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                <div className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">
                  Số người sẽ nhận
                </div>
                <div className="text-2xl font-bold tabular-nums">
                  {audienceQuery.isLoading
                    ? "…"
                    : (audienceQuery.data?.count ?? 0).toLocaleString("vi-VN")}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 mt-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={sendMut.isPending}>
              Huỷ
            </Button>
            <Button onClick={handleSend} disabled={sendMut.isPending}>
              {sendMut.isPending ? (
                <IconLoader size={14} className="animate-spin mr-2" />
              ) : (
                <IconCheck size={14} className="mr-2" />
              )}
              Gửi ngay
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title="Xoá thông báo?"
        description="Sẽ xoá toàn bộ bản ghi của đợt thông báo này khỏi tất cả user. Không thể hoàn tác."
        variant="destructive"
        confirmText="Xoá"
        onConfirm={() => {
          if (confirmDelete) {
            deleteMut.mutate({ id: confirmDelete })
            setConfirmDelete(null)
          }
        }}
      />
    </div>
  )
}

function typeLabel(t: string) {
  const found = TYPE_OPTIONS.find((o) => o.value === t)
  return found?.label || t
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

// ─── UserPicker ─────────────────────────────────────────────────────────────

function UserPicker({
  picked,
  onAdd,
  onRemove,
  type,
}: {
  picked: PickedUser[]
  onAdd: (u: PickedUser) => void
  onRemove: (id: string) => void
  type: string
}) {
  const trpc = useTRPC()
  const [query, setQuery] = React.useState("")
  const [debounced, setDebounced] = React.useState("")
  const [showResults, setShowResults] = React.useState(false)
  const wrapRef = React.useRef<HTMLDivElement>(null)

  // Debounce search input by 250ms
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250)
    return () => clearTimeout(t)
  }, [query])

  const searchQuery = useQuery({
    ...trpc.adminUser.searchLite.queryOptions({ keyword: debounced || "_", limit: 10 }),
    enabled: debounced.length > 0,
    staleTime: 30_000,
  })

  // Click outside to hide results
  React.useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setShowResults(false)
    }
    if (showResults) {
      document.addEventListener("mousedown", onClickOutside)
      return () => document.removeEventListener("mousedown", onClickOutside)
    }
  }, [showResults])

  const results = (searchQuery.data || []) as PickedUser[]
  const pickedIds = new Set(picked.map((p) => p.id))

  return (
    <div className="space-y-2">
      <div className="relative" ref={wrapRef}>
        <IconSearch
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          placeholder="Tìm theo username, email, hoặc tên..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setShowResults(true)}
          className="h-9 pl-9"
        />

        {showResults && debounced && (
          <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border bg-popover shadow-lg">
            {searchQuery.isLoading ? (
              <div className="px-3 py-3 text-sm text-muted-foreground">Đang tìm...</div>
            ) : results.length === 0 ? (
              <div className="px-3 py-3 text-sm text-muted-foreground">
                Không tìm thấy người dùng
              </div>
            ) : (
              <ul className="py-1">
                {results.map((u) => {
                  const already = pickedIds.has(u.id)
                  return (
                    <li key={u.id}>
                      <button
                        type="button"
                        onClick={() => {
                          if (!already) onAdd(u)
                          setQuery("")
                          setShowResults(false)
                        }}
                        disabled={already}
                        className={cn(
                          "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
                          already
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-accent cursor-pointer"
                        )}
                      >
                        <Avatar user={u} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{u.username}</span>
                            {u.emailVerified && (
                              <span className="text-[9px] font-bold uppercase text-emerald-600">
                                ✓ Email
                              </span>
                            )}
                            {u.hasTelegram && (
                              <span className="text-[9px] font-bold uppercase text-blue-600">
                                ✓ Tele
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                        </div>
                        {already && (
                          <span className="text-xs text-muted-foreground">Đã chọn</span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Picked chips */}
      {picked.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {picked.map((u) => (
            <span
              key={u.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 pl-1.5 pr-2 py-1 text-xs"
            >
              <AvatarSmall user={u} />
              <span className="font-medium">{u.username}</span>
              <button
                type="button"
                onClick={() => onRemove(u.id)}
                className="ml-0.5 -mr-1 size-4 inline-flex items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition-colors"
                aria-label={`Bỏ chọn ${u.username}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Chưa chọn người nhận. Tìm và chọn user ở trên.
        </p>
      )}
    </div>
  )
}

function Avatar({ user }: { user: PickedUser }) {
  if (user.avatar) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={user.avatar} alt={user.username} className="size-8 rounded-full object-cover shrink-0" />
  }
  const initials = (user.fullname || user.username).slice(0, 2).toUpperCase()
  return (
    <div className="size-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
      {initials}
    </div>
  )
}

function AvatarSmall({ user }: { user: PickedUser }) {
  if (user.avatar) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={user.avatar} alt={user.username} className="size-5 rounded-full object-cover shrink-0" />
  }
  const initials = (user.fullname || user.username).slice(0, 1).toUpperCase()
  return (
    <div className="size-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[9px] font-bold shrink-0">
      {initials}
    </div>
  )
}
