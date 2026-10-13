"use client"

/**
 * StorageTab — cấu hình lưu trữ ảnh toàn site.
 *
 * Provider: Nội bộ (local) · Amazon S3 · Cloudflare R2.
 * Khi chọn S3/R2 → hiện form credential + nút Test kết nối.
 * Credential nhập trống = giữ key cũ (giống AiTab).
 */
import * as React from "react"
import { useTRPC } from "@/trpc/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@/components/ui/toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { SelectCustom, type SelectCustomOption } from "@/components/ui/select-custom"
import { IconCheck, IconLoader, IconExternalLink, IconDatabase } from "@/components/icons"

type Provider = "local" | "s3" | "r2"

const PROVIDER_OPTIONS: SelectCustomOption<Provider>[] = [
  { value: "local", label: "Nội bộ (máy chủ)", description: "Lưu trên ổ đĩa server — không cần cấu hình" },
  { value: "s3", label: "Amazon S3", description: "AWS S3 bucket — cần Access Key" },
  { value: "r2", label: "Cloudflare R2", description: "R2 (S3-compatible) — cần Account endpoint" },
]

const DOCS: Record<Exclude<Provider, "local">, string> = {
  s3: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/creating-bucket.html",
  r2: "https://developers.cloudflare.com/r2/api/s3/api/",
}

// ─── Hướng dẫn cài đặt theo nhà cung cấp (hiển thị ngay trong tab) ──────────
function Chevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 transition-transform duration-200 group-open:rotate-90">
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

function Callout({ tone, children }: { tone: "info" | "warn" | "danger"; children: React.ReactNode }) {
  const cls =
    tone === "danger"
      ? "border-rose-500/30 bg-rose-500/5 text-rose-700 dark:text-rose-300"
      : tone === "warn"
        ? "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300"
        : "border-primary/30 bg-primary/5 text-foreground"
  return <div className={`rounded-lg border px-3 py-2 text-xs leading-relaxed ${cls}`}>{children}</div>
}

function StorageGuide({ provider }: { provider: Provider }) {
  return (
    <details className="group rounded-xl border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center gap-2 p-5 text-base font-semibold text-foreground">
        <Chevron />
        Hướng dẫn cài đặt{" "}
        {provider === "local" ? "lưu trữ nội bộ" : provider === "s3" ? "Amazon S3" : "Cloudflare R2"}
      </summary>
      <div className="space-y-4 border-t border-border px-5 pb-5 pt-4 text-sm text-muted-foreground">
        {provider === "local" && (
          <>
            <Callout tone="info">
              Lưu thẳng trên ổ đĩa VPS — không cần cấu hình gì thêm. Chỉ cần đặt kích thước tối đa cho ảnh ở trên.
            </Callout>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>Chọn <strong className="text-foreground">Nội bộ (máy chủ)</strong> ở ô Nơi lưu ảnh.</li>
              <li>Đặt Kích thước tối đa (MB) cho ảnh (vd 20).</li>
              <li>Bấm <strong className="text-foreground">Lưu cấu hình lưu trữ</strong>. Xong.</li>
            </ol>
            <Callout tone="warn">
              File ZIP source tối đa 200MB. Nhiều file ZIP sẽ nhanh đầy ổ VPS — chạy nhiều site nên dùng Cloudflare R2 để tách tải khỏi server.
            </Callout>
          </>
        )}

        {provider === "r2" && (
          <>
            <Callout tone="info">
              <strong>Miễn phí 10GB lưu trữ/tháng + băng thông tải về VÔ HẠN miễn phí.</strong> Vượt 10GB chỉ ~$0.015/GB/tháng. Khách tải ZIP/ảnh bao nhiêu lần cũng không tốn phí băng thông.
            </Callout>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>Đăng nhập <code className="font-mono">dash.cloudflare.com</code> → menu <strong className="text-foreground">R2 Object Storage</strong> (lần đầu cần thêm thẻ để kích hoạt — không bị trừ nếu trong hạn mức free).</li>
              <li>Bấm <strong className="text-foreground">Create bucket</strong> → đặt tên (vd <code className="font-mono">mystore</code>).</li>
              <li>Lấy <strong className="text-foreground">Account ID</strong> → Endpoint dạng: <code className="font-mono break-all">https://&lt;ACCOUNT_ID&gt;.r2.cloudflarestorage.com</code></li>
              <li><strong className="text-foreground">Manage R2 API Tokens</strong> → Create API Token → chọn <strong className="text-foreground">Object Read &amp; Write</strong> → copy <strong className="text-foreground">Access Key ID</strong> + <strong className="text-foreground">Secret Access Key</strong> (chỉ hiện 1 lần).</li>
              <li>Bật public: Bucket → <strong className="text-foreground">Settings</strong> → <strong className="text-foreground">Public Development URL</strong> → Enable (được <code className="font-mono">https://pub-xxxx.r2.dev</code>); hoặc gắn <strong className="text-foreground">Custom Domain</strong>.</li>
              <li>Điền vào form phía trên: Bucket, Endpoint, Access Key, Secret, Public Base URL → <strong className="text-foreground">Lưu</strong> → <strong className="text-foreground">Test kết nối</strong>.</li>
            </ol>
            <Callout tone="danger">
              URL <code className="font-mono">r2.dev</code> bị Cloudflare giới hạn tốc độ, chỉ nên dùng thử nghiệm. Chạy thật hãy gắn <strong>Custom Domain</strong> để tải ZIP nhanh, ổn định.
            </Callout>
          </>
        )}

        {provider === "s3" && (
          <>
            <Callout tone="info">
              5GB miễn phí (tài khoản mới có $100 credit trong 6 tháng). <strong>Lưu ý: S3 TÍNH PHÍ băng thông tải về</strong> (~$0.09/GB) — tải nhiều sẽ tốn tiền.
            </Callout>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>Vào <code className="font-mono">console.aws.amazon.com/s3</code> → <strong className="text-foreground">Create bucket</strong> → đặt tên + chọn Region (vd <code className="font-mono">ap-southeast-1</code>).</li>
              <li>Bỏ tick <strong className="text-foreground">Block all public access</strong> (xác nhận cảnh báo).</li>
              <li>Bucket → Permissions → <strong className="text-foreground">Bucket policy</strong> → dán policy public-read cho <code className="font-mono">arn:aws:s3:::TEN_BUCKET/*</code> với action <code className="font-mono">s3:GetObject</code>.</li>
              <li>Vào <strong className="text-foreground">IAM</strong> → Users → Create user → gắn quyền <strong className="text-foreground">AmazonS3FullAccess</strong> → Create access key → copy Access Key ID + Secret.</li>
              <li>Điền vào form phía trên: Bucket, Region, Access Key, Secret. Public Base URL để trống (tự suy ra) → <strong className="text-foreground">Lưu</strong> → <strong className="text-foreground">Test kết nối</strong>.</li>
            </ol>
            <Callout tone="warn">
              Để trống Public Base URL, hệ thống tự tạo URL <code className="font-mono break-all">https://&lt;bucket&gt;.s3.&lt;region&gt;.amazonaws.com/&lt;key&gt;</code>.
            </Callout>
          </>
        )}

        <Callout tone="danger">
          Quan trọng: worker deploy tải file ZIP qua HTTP từ URL công khai. Sau khi cấu hình, mở thử URL file bằng trình duyệt ẩn danh — nếu tải về trực tiếp (không đăng nhập/lỗi quyền) là chuẩn. Không dùng Google Drive / MediaFire.
        </Callout>
      </div>
    </details>
  )
}

export function StorageTab() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const configQuery = useQuery(trpc.admin.getStorageSettings.queryOptions())

  const [provider, setProvider] = React.useState<Provider>("local")
  const [maxMb, setMaxMb] = React.useState(5)
  const [bucket, setBucket] = React.useState("")
  const [region, setRegion] = React.useState("")
  const [endpoint, setEndpoint] = React.useState("")
  const [publicBaseUrl, setPublicBaseUrl] = React.useState("")
  const [accessKey, setAccessKey] = React.useState("")
  const [secretKey, setSecretKey] = React.useState("")
  const [hasAccessKey, setHasAccessKey] = React.useState(false)
  const [hasSecretKey, setHasSecretKey] = React.useState(false)
  const [loaded, setLoaded] = React.useState(false)

  React.useEffect(() => {
    if (!configQuery.data || loaded) return
    const d = configQuery.data
    setProvider(d.provider)
    setMaxMb(d.maxMb)
    setBucket(d.bucket)
    setRegion(d.region)
    setEndpoint(d.endpoint)
    setPublicBaseUrl(d.publicBaseUrl)
    setHasAccessKey(d.hasAccessKey)
    setHasSecretKey(d.hasSecretKey)
    setLoaded(true)
  }, [configQuery.data, loaded])

  const saveMut = useMutation({
    ...trpc.admin.saveStorageSettings.mutationOptions(),
    onSuccess: () => {
      toast.success("Đã lưu cấu hình lưu trữ")
      setAccessKey("")
      setSecretKey("")
      queryClient.invalidateQueries({ queryKey: trpc.admin.getStorageSettings.queryOptions().queryKey })
      setLoaded(false) // reload để cập nhật hasKey flags
    },
    onError: (err: any) => toast.error(err.message || "Lưu thất bại"),
  })

  const testMut = useMutation({
    ...trpc.admin.testStorageConnection.mutationOptions(),
    onSuccess: (data: any) => {
      if (data?.ok) toast.success("Kết nối lưu trữ OK")
      else toast.error("Test fail: " + (data?.error || "unknown"))
    },
    onError: (err: any) => toast.error(err.message || "Test fail"),
  })

  const isCloud = provider === "s3" || provider === "r2"

  function handleSave() {
    saveMut.mutate({
      provider,
      maxMb,
      bucket,
      region,
      endpoint,
      publicBaseUrl,
      // null = giữ key cũ (không gửi). Chỉ gửi khi user nhập mới.
      accessKey: accessKey ? accessKey : null,
      secretKey: secretKey ? secretKey : null,
    })
  }

  if (configQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ─── Provider + size ─── */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <IconDatabase size={18} className="text-primary" />
          <h3 className="text-base font-semibold text-foreground">Nhà cung cấp lưu trữ</h3>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label>Nơi lưu ảnh</Label>
            <SelectCustom
              value={provider}
              onValueChange={(v) => setProvider(v as Provider)}
              options={PROVIDER_OPTIONS}
            />
            <p className="text-xs text-muted-foreground">
              Áp dụng cho mọi nơi upload ảnh trên toàn site.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Kích thước tối đa (MB)</Label>
            <Input
              type="number"
              min={1}
              max={50}
              value={maxMb}
              onChange={(e) => setMaxMb(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
            />
            <p className="text-xs text-muted-foreground">
              Giới hạn mỗi ảnh khi upload. Tối đa 50MB.
            </p>
          </div>
        </div>
      </div>

      {/* ─── Cloud credential (chỉ S3/R2) ─── */}
      {isCloud && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">
              Cấu hình {provider === "s3" ? "Amazon S3" : "Cloudflare R2"}
            </h3>
            <a
              href={DOCS[provider]}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <IconExternalLink size={12} /> Xem tài liệu
            </a>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label>Bucket</Label>
              <Input value={bucket} onChange={(e) => setBucket(e.target.value)} placeholder="my-bucket" />
            </div>
            {provider === "s3" ? (
              <div className="space-y-2">
                <Label>Region</Label>
                <Input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="ap-southeast-1" />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Endpoint</Label>
                <Input
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  placeholder="https://<account_id>.r2.cloudflarestorage.com"
                />
              </div>
            )}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label>
                Access Key ID{" "}
                {hasAccessKey && <span className="text-xs text-muted-foreground">(đã lưu — để trống để giữ nguyên)</span>}
              </Label>
              <Input
                type="password"
                value={accessKey}
                onChange={(e) => setAccessKey(e.target.value)}
                placeholder={hasAccessKey ? "••••••••" : "Access Key ID"}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label>
                Secret Access Key{" "}
                {hasSecretKey && <span className="text-xs text-muted-foreground">(đã lưu — để trống để giữ nguyên)</span>}
              </Label>
              <Input
                type="password"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder={hasSecretKey ? "••••••••" : "Secret Access Key"}
                autoComplete="off"
              />
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <Label>Public Base URL</Label>
            <Input
              value={publicBaseUrl}
              onChange={(e) => setPublicBaseUrl(e.target.value)}
              placeholder={provider === "s3" ? "https://cdn.example.com (tùy chọn)" : "https://pub-xxxx.r2.dev (bắt buộc)"}
            />
            <p className="text-xs text-muted-foreground">
              Đường dẫn công khai để hiển thị ảnh: <code className="font-mono">URL = Base + / + key</code>.
              {provider === "s3"
                ? " Để trống sẽ tự suy ra từ bucket + region."
                : " R2 không có public URL mặc định — cần bật r2.dev hoặc custom domain rồi dán vào đây."}
            </p>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => testMut.mutate()}
              disabled={testMut.isPending}
            >
              {testMut.isPending ? <IconLoader size={14} className="animate-spin" /> : null}
              Test kết nối
            </Button>
            <p className="text-xs text-muted-foreground">
              Lưu cấu hình trước, sau đó Test sẽ ghi thử 1 file nhỏ để kiểm tra credential.
            </p>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Credential được mã hóa AES-256-GCM trước khi lưu DB.
          </p>
        </div>
      )}

      {/* ─── Hướng dẫn cài đặt (theo provider) ─── */}
      <StorageGuide provider={provider} />

      {/* ─── Save bar ─── */}
      <div className="sticky bottom-0 z-10 -mx-1 flex justify-end border-t border-border bg-background/95 px-1 py-3 backdrop-blur">
        <Button onClick={handleSave} disabled={saveMut.isPending} className="gap-2">
          {saveMut.isPending ? <IconLoader size={16} className="animate-spin" /> : <IconCheck size={16} />}
          Lưu cấu hình lưu trữ
        </Button>
      </div>
    </div>
  )
}
