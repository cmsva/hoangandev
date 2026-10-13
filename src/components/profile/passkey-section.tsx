"use client"

/**
 * PasskeySection — quản lý Passkey (WebAuthn) trong trang profile.
 *
 * - Empty state: CTA "Thiết lập ngay".
 * - List: mỗi passkey hiện tên + thời điểm dùng gần nhất + đổi tên/xóa.
 * - Dialog thêm: nhập nickname trước khi gọi WebAuthn.
 */
import { useState } from "react"
import {
  Fingerprint,
  Plus,
  Trash2,
  Pencil,
  Loader2,
  ShieldCheck,
  Info,
  Check,
  X,
} from "lucide-react"
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
import { usePasskeyManager, isPasskeySupported } from "@/hooks/use-passkey"

function formatRelative(d: Date | string | null | undefined): string {
  if (!d) return "Chưa dùng"
  const date = new Date(d)
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Vừa xong"
  if (mins < 60) return `${mins} phút trước`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} ngày trước`
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short" }).format(date)
}

export function PasskeySection() {
  const pk = usePasskeyManager()
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newName, setNewName] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const supported = isPasskeySupported()

  function openAdd() {
    setNewName("")
    setShowAddDialog(true)
  }

  async function submitAdd() {
    setShowAddDialog(false)
    await pk.addPasskey(newName)
  }

  function startEdit(id: string, current: string) {
    setEditingId(id)
    setEditName(current)
  }

  async function submitEdit() {
    if (!editingId) return
    const id = editingId
    setEditingId(null)
    await pk.rename(id, editName)
  }

  const hasPasskeys = pk.passkeys.length > 0

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Fingerprint className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold">Liên kết Passkey</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Đăng nhập nhanh, an toàn, không cần mật khẩu.
            </p>
          </div>
        </div>
        {hasPasskeys && supported && (
          <Button size="sm" onClick={openAdd} disabled={pk.isRegistering} className="gap-1.5">
            {pk.isRegistering ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Thêm Passkey
          </Button>
        )}
      </div>

      <div className="p-6">
        {!supported ? (
          <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Trình duyệt hiện tại không hỗ trợ Passkey. Hãy thử trên thiết bị/trình duyệt mới hơn.
            </p>
          </div>
        ) : pk.isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !hasPasskeys ? (
          /* Empty state */
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-muted/20 px-6 py-10 text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Fingerprint className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold">Chưa có Passkey nào</p>
              <p className="text-xs text-muted-foreground max-w-sm">
                Liên kết thiết bị của bạn để đăng nhập nhanh chóng và bảo mật hơn.
              </p>
            </div>
            <Button onClick={openAdd} disabled={pk.isRegistering} className="mt-1 gap-1.5">
              {pk.isRegistering ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              Thiết lập ngay
            </Button>
          </div>
        ) : (
          /* List */
          <div className="space-y-2.5">
            {pk.passkeys.map((p: any) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-lg border bg-background px-4 py-3"
              >
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground shrink-0">
                  <Fingerprint className="h-4 w-4" />
                </div>

                <div className="flex-1 min-w-0">
                  {editingId === p.id ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        maxLength={64}
                        className="h-8 text-sm"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") submitEdit()
                          if (e.key === "Escape") setEditingId(null)
                        }}
                      />
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={submitEdit}>
                        <Check className="h-4 w-4 text-emerald-500" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => setEditingId(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Dùng gần nhất: {formatRelative(p.lastUsedAt)}
                        {p.backedUp && (
                          <span className="ml-2 inline-flex items-center gap-1 text-emerald-600">
                            <ShieldCheck className="h-3 w-3" />
                            Đồng bộ đám mây
                          </span>
                        )}
                      </p>
                    </>
                  )}
                </div>

                {editingId !== p.id && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => startEdit(p.id, p.name)}
                      title="Đổi tên"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm(`Xóa Passkey "${p.name}"? Thiết bị này sẽ không đăng nhập bằng Passkey được nữa.`)) {
                          pk.remove(p.id)
                        }
                      }}
                      disabled={pk.isDeleting}
                      title="Xóa"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Info box */}
        <div className="mt-4 rounded-lg bg-muted/40 border px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <Info className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground">Thông tin thêm</span>
          </div>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              Passkey là giải pháp thay thế mật khẩu hiện đại, an toàn và chống lại tấn công lừa đảo (phishing).
            </li>
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              Bạn có thể sử dụng Passkey trên nhiều thiết bị khác nhau bằng cách liên kết từng thiết bị.
            </li>
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              Trong trường hợp mất thiết bị, bạn vẫn có thể đăng nhập bằng mật khẩu hoặc các phương thức bảo mật khác đã thiết lập.
            </li>
          </ul>
        </div>
      </div>

      {/* Add dialog — đặt tên trước khi gọi WebAuthn */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thêm Passkey</DialogTitle>
            <DialogDescription>
              Đặt tên gợi nhớ cho thiết bị này (vd "MacBook Touch ID", "iPhone của tôi").
              Sau khi bấm Tiếp tục, trình duyệt sẽ yêu cầu xác thực vân tay/khuôn mặt/PIN.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Tên thiết bị</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="MacBook Touch ID"
              maxLength={64}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim()) submitAdd()
              }}
            />
          </div>
          <DialogFooter className="sm:gap-0">
            <Button variant="outline" className="h-10" onClick={() => setShowAddDialog(false)}>
              Hủy
            </Button>
            <Button className="h-10" onClick={submitAdd} disabled={!newName.trim()}>
              Tiếp tục
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
