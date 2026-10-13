"use client"

/**
 * Section quản lý API key + IP whitelist + audit log.
 *
 * Hiển thị ở đầu trang /document-api. User chưa login → hiển thị CTA login.
 */
import * as React from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/client"
import { toast } from "@/components/ui/toast"

interface Props {
  isAuthenticated: boolean
}

export function ApiKeyManagerPanel({ isAuthenticated }: Props) {
  const trpc = useTRPC()

  if (!isAuthenticated) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6">
        <h3 className="text-base font-semibold mb-2 text-amber-200">
          Đăng nhập để tạo API Key
        </h3>
        <p className="text-sm text-amber-100/80 mb-4">
          Bạn cần đăng nhập để tạo và quản lý API key, IP whitelist, audit logs.
        </p>
        <a
          href="/authentication/login?redirectTo=/document-api"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-zinc-950 text-sm font-semibold"
        >
          Đăng nhập
        </a>
      </div>
    )
  }

  return <AuthenticatedPanel />
}

function AuthenticatedPanel() {
  const trpc = useTRPC()
  const keysQuery = useQuery(trpc.apiKey.list.queryOptions())
  const [showCreate, setShowCreate] = React.useState(false)
  const [showFullKey, setShowFullKey] = React.useState<{ keyId: string; key: string } | null>(null)
  const [editingKeyId, setEditingKeyId] = React.useState<string | null>(null)

  const myKey = (keysQuery.data ?? []).find((k) => k.status !== "revoked") ?? null

  return (
    <div className="space-y-4">
      {keysQuery.isLoading ? (
        <div className="rounded-xl border border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">
          Đang tải...
        </div>
      ) : myKey ? (
        <SingleKeyCard
          item={myKey}
          onEdit={() => setEditingKeyId(myKey.id)}
          onRotated={(rawKey) => setShowFullKey({ keyId: myKey.id, key: rawKey })}
          onAfterAction={() => keysQuery.refetch()}
        />
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            Bạn chưa có API key. Mỗi tài khoản cấp 1 key duy nhất.
          </p>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:opacity-90 text-primary-foreground text-sm font-semibold"
          >
            <PlusIcon /> Tạo API Key
          </button>
        </div>
      )}

      {/* Dialogs */}
      {showCreate && (
        <CreateKeyDialog
          onClose={() => setShowCreate(false)}
          onCreated={(key) => {
            setShowCreate(false)
            setShowFullKey(key)
            void keysQuery.refetch()
          }}
        />
      )}
      {showFullKey && (
        <ShowFullKeyDialog data={showFullKey} onClose={() => setShowFullKey(null)} />
      )}
      {editingKeyId && (
        <EditKeyDialog
          apiKeyId={editingKeyId}
          keys={keysQuery.data ?? []}
          onClose={() => setEditingKeyId(null)}
          onSaved={() => {
            setEditingKeyId(null)
            void keysQuery.refetch()
          }}
        />
      )}
    </div>
  )
}

// ─── Single key card ────────────────────────────────────────────────────────

interface KeyItem {
  id: string
  name: string
  prefix: string
  scopes: string[]
  ipWhitelist: string[]
  rateLimitPerMin: number
  status: "active" | "disabled" | "revoked"
  lastUsedAt: Date | null
  lastUsedIp: string | null
  createdAt: Date
}

function SingleKeyCard({
  item,
  onEdit,
  onRotated,
  onAfterAction,
}: {
  item: KeyItem
  onEdit: () => void
  onRotated: (rawKey: string) => void
  onAfterAction: () => void
}) {
  const trpc = useTRPC()
  const rotateMutation = useMutation(
    trpc.apiKey.rotate.mutationOptions({
      onError: (err) => toast.error(err.message),
    })
  )
  const revokeMutation = useMutation(
    trpc.apiKey.revoke.mutationOptions({
      onSuccess: () => {
        toast.success("Đã thu hồi")
        onAfterAction()
      },
      onError: (err) => toast.error(err.message),
    })
  )

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold">{item.name}</h3>
            <StatusBadge status={item.status} />
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span>Prefix:</span>
            <code className="font-mono px-1.5 py-0.5 rounded bg-muted text-foreground">
              {item.prefix}…
            </code>
          </div>
          <p className="mt-2 text-[12.5px] text-muted-foreground">
            Tạo lúc {formatDate(item.createdAt)}
            {item.lastUsedAt
              ? ` · Dùng cuối ${formatDate(item.lastUsedAt)}${
                  item.lastUsedIp ? ` từ ${item.lastUsedIp}` : ""
                }`
              : " · Chưa dùng"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted font-medium"
          >
            Sửa
          </button>
          {item.status === "active" && (
            <>
              <button
                type="button"
                onClick={async () => {
                  if (!confirm("Rotate sẽ đổi secret. Token cũ bị invalidate. Tiếp tục?")) return
                  const res = await rotateMutation.mutateAsync({ id: item.id })
                  onRotated(res.apiKey)
                  onAfterAction()
                }}
                className="px-3 py-1.5 text-xs rounded-lg border border-amber-500/30 text-amber-500 hover:bg-amber-500/10 font-medium"
              >
                Rotate
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!confirm("Thu hồi key vĩnh viễn?")) return
                  void revokeMutation.mutateAsync({ id: item.id })
                }}
                className="px-3 py-1.5 text-xs rounded-lg border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 font-medium"
              >
                Thu hồi
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KeyMeta
          label="Scopes"
          value={
            item.scopes.includes("*") ? (
              <span className="text-emerald-500 font-medium">Full access (*)</span>
            ) : (
              <div className="flex flex-wrap gap-1">
                {item.scopes.map((s) => (
                  <code
                    key={s}
                    className="px-1.5 py-0.5 text-[10px] font-mono bg-primary/10 text-primary rounded"
                  >
                    {s}
                  </code>
                ))}
              </div>
            )
          }
        />
        <KeyMeta
          label="IP Whitelist"
          value={
            item.ipWhitelist.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {item.ipWhitelist.slice(0, 3).map((ip) => (
                  <code
                    key={ip}
                    className="px-1.5 py-0.5 text-[11px] font-mono bg-emerald-500/10 text-emerald-500 rounded"
                  >
                    {ip}
                  </code>
                ))}
                {item.ipWhitelist.length > 3 && (
                  <span className="text-[11px] text-muted-foreground">
                    +{item.ipWhitelist.length - 3}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-amber-500 text-xs font-medium">All IPs (không giới hạn)</span>
            )
          }
        />
        <KeyMeta
          label="Rate limit"
          value={
            <span className="text-foreground text-sm font-semibold">
              {item.rateLimitPerMin}
              <span className="text-muted-foreground font-normal text-xs"> req/phút</span>
            </span>
          }
        />
      </div>
    </div>
  )
}

function KeyMeta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">
        {label}
      </div>
      {value}
    </div>
  )
}

function StatusBadge({ status }: { status: KeyItem["status"] }) {
  const map = {
    active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    disabled: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    revoked: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  } as const
  return (
    <span
      className={
        "inline-block px-1.5 py-0.5 text-[10px] font-medium rounded border " +
        map[status]
      }
    >
      {status}
    </span>
  )
}

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// ─── Create dialog ──────────────────────────────────────────────────────────

const ALL_SCOPES = [
  "websites:read",
  "websites:write",
  "domains:read",
  "domains:write",
  "cronjobs:read",
  "cronjobs:write",
  "logos:read",
  "logos:write",
  "products:read",
  "products:write",
  "deposits:read",
  "deposits:write",
  "account:read",
] as const

function CreateKeyDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (data: { keyId: string; key: string }) => void
}) {
  const trpc = useTRPC()
  const [name, setName] = React.useState("")
  const [scopes, setScopes] = React.useState<string[]>(["*"])
  const [ipWhitelist, setIpWhitelist] = React.useState("")
  const [rateLimit, setRateLimit] = React.useState(60)
  const [currentIp, setCurrentIp] = React.useState<string | null>(null)

  React.useEffect(() => {
    fetch("/api/internal/my-ip")
      .then((r) => r.json())
      .then((d) => setCurrentIp(d.ip ?? null))
      .catch(() => {})
  }, [])

  const createMutation = useMutation(
    trpc.apiKey.create.mutationOptions({
      onSuccess: (res) => {
        toast.success("Đã tạo API key")
        onCreated({ keyId: res.id, key: res.apiKey })
      },
      onError: (err) => toast.error(err.message),
    })
  )

  function toggleScope(scope: string) {
    setScopes((prev) => {
      if (scope === "*") return ["*"]
      const without = prev.filter((s) => s !== "*" && s !== scope)
      return prev.includes(scope) ? without : [...without, scope]
    })
  }

  return (
    <Dialog onClose={onClose} title="Tạo API Key mới" maxWidth={620}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          const ipList = ipWhitelist
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
          createMutation.mutate({
            name,
            scopes: scopes as any,
            ipWhitelist: ipList,
            rateLimitPerMin: rateLimit,
          })
        }}
      >
        <Field label="Tên gợi nhớ" required>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary"
            placeholder="Production agency"
          />
        </Field>

        <Field label="Scopes (`*` = full access)">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            <ScopeChip
              scope="*"
              active={scopes.includes("*")}
              onToggle={() => toggleScope("*")}
            />
            {ALL_SCOPES.map((s) => (
              <ScopeChip
                key={s}
                scope={s}
                active={scopes.includes(s)}
                onToggle={() => toggleScope(s)}
              />
            ))}
          </div>
        </Field>

        <Field label="IP Whitelist (mỗi IP/CIDR 1 dòng)">
          <textarea
            value={ipWhitelist}
            onChange={(e) => setIpWhitelist(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary"
            placeholder={"1.2.3.4\n10.0.0.0/24"}
          />
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Để trống = cho phép mọi IP. Hỗ trợ IP literal hoặc CIDR (vd `192.168.1.0/24`).
          </p>
          {currentIp && (
            <div className="mt-2 flex items-center justify-between gap-3 text-xs px-3 py-2 rounded-lg bg-muted/40">
              <span className="text-muted-foreground">
                IP hiện tại: <span className="font-mono text-foreground">{currentIp}</span>
              </span>
              <button
                type="button"
                onClick={() =>
                  setIpWhitelist((prev) =>
                    prev.includes(currentIp) ? prev : (prev ? prev + "\n" : "") + currentIp
                  )
                }
                className="px-2 py-1 rounded bg-primary/15 text-primary hover:bg-primary/25"
              >
                Thêm vào
              </button>
            </div>
          )}
          <div className="mt-2 text-[11px] text-amber-400 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
            ⚠ Nếu bạn thêm whitelist, hãy chắc chắn IP gọi API có trong danh sách để khỏi bị
            khóa.
          </div>
        </Field>

        <Field label="Rate Limit (request/phút)">
          <input
            type="number"
            min={1}
            max={1000}
            value={rateLimit}
            onChange={(e) => setRateLimit(Number(e.target.value))}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary"
          />
        </Field>

        <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm hover:bg-muted"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending || !name}
            className="px-4 py-2 rounded-lg bg-primary hover:opacity-90 text-primary-foreground text-sm font-semibold disabled:opacity-50"
          >
            {createMutation.isPending ? "Đang tạo..." : "Tạo Key"}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

function ScopeChip({
  scope,
  active,
  onToggle,
}: {
  scope: string
  active: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={
        "px-2 py-1.5 rounded-md text-[11px] font-mono border transition-all " +
        (active
          ? "bg-primary/15 border-primary/40 text-primary"
          : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground")
      }
    >
      {scope}
    </button>
  )
}

// ─── Show full key dialog (post-create / post-rotate) ──────────────────────

function ShowFullKeyDialog({
  data,
  onClose,
  title = "API Key đã tạo",
}: {
  data: { keyId: string; key: string }
  onClose: () => void
  title?: string
}) {
  const [copied, setCopied] = React.useState(false)
  return (
    <Dialog onClose={onClose} title={title} maxWidth={580}>
      <div className="space-y-4">
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-200">
          ⚠ Đây là lần duy nhất bạn nhìn thấy key đầy đủ. Hãy lưu lại ngay — chúng tôi
          không thể hiển thị lại.
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground">API Key</label>
          <div className="mt-1.5 flex items-stretch gap-2">
            <code className="flex-1 px-3 py-2.5 rounded-lg bg-foreground/95 text-emerald-400 font-mono text-xs break-all">
              {data.key}
            </code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(data.key)
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              }}
              className="px-3 rounded-lg bg-primary hover:opacity-90 text-primary-foreground text-xs font-semibold"
            >
              {copied ? "✓ Đã copy" : "Copy"}
            </button>
          </div>
        </div>
        <div className="flex justify-end pt-2 border-t border-border/60">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 text-sm font-semibold"
          >
            Đã lưu, đóng
          </button>
        </div>
      </div>
    </Dialog>
  )
}

// ─── Edit dialog ───────────────────────────────────────────────────────────

function EditKeyDialog({
  apiKeyId,
  keys,
  onClose,
  onSaved,
}: {
  apiKeyId: string
  keys: KeyItem[]
  onClose: () => void
  onSaved: () => void
}) {
  const trpc = useTRPC()
  const key = keys.find((k) => k.id === apiKeyId)
  const [name, setName] = React.useState(key?.name ?? "")
  const [scopes, setScopes] = React.useState<string[]>(key?.scopes ?? ["*"])
  const [ipWhitelist, setIpWhitelist] = React.useState((key?.ipWhitelist ?? []).join("\n"))
  const [rateLimit, setRateLimit] = React.useState(key?.rateLimitPerMin ?? 60)
  const [status, setStatus] = React.useState<"active" | "disabled">(
    key?.status === "disabled" ? "disabled" : "active"
  )

  const updateMutation = useMutation(
    trpc.apiKey.update.mutationOptions({
      onSuccess: () => {
        toast.success("Đã lưu")
        onSaved()
      },
      onError: (err) => toast.error(err.message),
    })
  )

  if (!key) return null

  function toggleScope(scope: string) {
    setScopes((prev) => {
      if (scope === "*") return ["*"]
      const without = prev.filter((s) => s !== "*" && s !== scope)
      return prev.includes(scope) ? without : [...without, scope]
    })
  }

  return (
    <Dialog onClose={onClose} title={`Sửa: ${key.name}`} maxWidth={620}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          const ipList = ipWhitelist.split("\n").map((s) => s.trim()).filter(Boolean)
          updateMutation.mutate({
            id: apiKeyId,
            name,
            scopes: scopes as any,
            ipWhitelist: ipList,
            rateLimitPerMin: rateLimit,
            status,
          })
        }}
      >
        <Field label="Tên" required>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary"
          />
        </Field>
        <Field label="Trạng thái">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "active" | "disabled")}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="active">Active</option>
            <option value="disabled">Disabled (tạm khóa)</option>
          </select>
        </Field>
        <Field label="Scopes">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            <ScopeChip scope="*" active={scopes.includes("*")} onToggle={() => toggleScope("*")} />
            {ALL_SCOPES.map((s) => (
              <ScopeChip
                key={s}
                scope={s}
                active={scopes.includes(s)}
                onToggle={() => toggleScope(s)}
              />
            ))}
          </div>
        </Field>
        <Field label="IP Whitelist (mỗi dòng 1 IP/CIDR)">
          <textarea
            value={ipWhitelist}
            onChange={(e) => setIpWhitelist(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary"
          />
        </Field>
        <Field label="Rate Limit (req/phút)">
          <input
            type="number"
            min={1}
            max={1000}
            value={rateLimit}
            onChange={(e) => setRateLimit(Number(e.target.value))}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm hover:bg-muted"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="px-4 py-2 rounded-lg bg-primary hover:opacity-90 text-primary-foreground text-sm font-semibold disabled:opacity-50"
          >
            {updateMutation.isPending ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

// ─── Atoms ─────────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
        {label} {required && <span className="text-rose-400">*</span>}
      </label>
      {children}
    </div>
  )
}

function Dialog({
  onClose,
  title,
  maxWidth = 480,
  children,
}: {
  onClose: () => void
  title: string
  maxWidth?: number
  children: React.ReactNode
}) {
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 bg-black/60 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-xl border border-border shadow-2xl w-full"
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}
