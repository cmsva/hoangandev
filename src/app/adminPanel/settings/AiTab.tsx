"use client"

import * as React from "react"
import { useTRPC } from "@/trpc/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@/components/ui/toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { SelectCustom, type SelectCustomOption } from "@/components/ui/select-custom"
import { IconCheck, IconLoader, IconExternalLink, IconCircleCheck, IconAlertWarning } from "@/components/icons"

type Provider = "deepseek" | "minimax" | "grok" | "groq" | "gemini" | "claude"

function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

export function AiTab() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const catalogQuery = useQuery(trpc.adminAi.catalog.queryOptions())
  const configQuery = useQuery(trpc.adminAi.getConfig.queryOptions())

  const [enabled, setEnabled] = React.useState(false)
  const [provider, setProvider] = React.useState<Provider>("gemini")
  const [model, setModel] = React.useState("")
  const [apiKey, setApiKey] = React.useState("")
  const [systemPrompt, setSystemPrompt] = React.useState("")
  const [maxTokens, setMaxTokens] = React.useState(1024)
  const [temperature, setTemperature] = React.useState(0.4)
  const [perUserPerHour, setPerUserPerHour] = React.useState(30)
  const [perIpPerHour, setPerIpPerHour] = React.useState(20)
  const [widgetTitle, setWidgetTitle] = React.useState("Trợ lý AI")
  const [widgetGreeting, setWidgetGreeting] = React.useState("")
  const [widgetPosition, setWidgetPosition] = React.useState<"right" | "left">("right")
  const [allowDbContext, setAllowDbContext] = React.useState(true)
  const [hasKey, setHasKey] = React.useState(false)
  const [loaded, setLoaded] = React.useState(false)

  React.useEffect(() => {
    if (!configQuery.data || loaded) return
    const d = configQuery.data
    setEnabled(d.enabled)
    setProvider(d.provider)
    setModel(d.model)
    setSystemPrompt(d.systemPrompt)
    setMaxTokens(d.maxTokens)
    setTemperature(d.temperature)
    setPerUserPerHour(d.perUserPerHour)
    setPerIpPerHour(d.perIpPerHour)
    setWidgetTitle(d.widgetTitle)
    setWidgetGreeting(d.widgetGreeting)
    setWidgetPosition(d.widgetPosition)
    setAllowDbContext(d.allowDbContext)
    setHasKey(d.hasKey)
    setLoaded(true)
  }, [configQuery.data, loaded])

  const providerSpec = React.useMemo(() => {
    if (!catalogQuery.data) return null
    return catalogQuery.data.find((p) => p.id === provider) ?? null
  }, [catalogQuery.data, provider])

  // Khi đổi provider, auto-set model = defaultModel
  React.useEffect(() => {
    if (!providerSpec) return
    const inCatalog = providerSpec.models.some((m) => m.id === model)
    if (!inCatalog) setModel(providerSpec.defaultModel)
  }, [providerSpec, model])

  const saveMut = useMutation({
    ...trpc.adminAi.saveConfig.mutationOptions(),
    onSuccess: () => {
      toast.success("Đã lưu cấu hình AI")
      setApiKey("")
      queryClient.invalidateQueries({ queryKey: trpc.adminAi.getConfig.queryOptions().queryKey })
    },
    onError: (err: any) => toast.error(err.message || "Lưu thất bại"),
  })

  const testMut = useMutation({
    ...trpc.adminAi.testConnection.mutationOptions(),
    onSuccess: (data) => {
      if (data?.ok) toast.success("Kết nối OK: " + (data.text || "").slice(0, 80))
      else toast.error("Test fail: " + (data?.error || "unknown"))
    },
    onError: (err: any) => toast.error(err.message || "Test fail"),
  })

  const refreshCtxMut = useMutation({
    ...trpc.adminAi.refreshContext.mutationOptions(),
    onSuccess: () => toast.success("Đã làm mới context dịch vụ"),
  })

  const handleSave = () => {
    saveMut.mutate({
      enabled,
      provider,
      model,
      apiKey: apiKey || null, // null = giữ key cũ
      systemPrompt,
      maxTokens,
      temperature,
      perUserPerHour,
      perIpPerHour,
      widgetTitle,
      widgetGreeting,
      widgetPosition,
      allowDbContext,
    })
  }

  const handleTest = () => {
    testMut.mutate({
      provider,
      model,
      apiKey: apiKey || undefined, // không truyền = dùng key đã lưu
    })
  }

  const handleClearKey = () => {
    if (!confirm("Xóa API key đã lưu? Widget AI sẽ ngừng hoạt động cho đến khi nhập key mới.")) return
    saveMut.mutate({
      enabled: false, // tự off khi mất key
      provider,
      model,
      apiKey: "", // empty = clear
      systemPrompt,
      maxTokens,
      temperature,
      perUserPerHour,
      perIpPerHour,
      widgetTitle,
      widgetGreeting,
      widgetPosition,
      allowDbContext,
    })
    setHasKey(false)
  }

  if (configQuery.isLoading || catalogQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  const selectedModel = providerSpec?.models.find((m) => m.id === model)

  return (
    <div className="space-y-6">
      {/* ─── Toggle banner ─── */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">Trợ lý AI</h3>
              {enabled && hasKey && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                  <IconCircleCheck size={12} /> Đang chạy
                </span>
              )}
              {enabled && !hasKey && (
                <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs font-medium text-yellow-700 dark:text-yellow-400">
                  <IconAlertWarning size={12} /> Thiếu API key
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Khi bật, widget chat AI sẽ hiển thị ở góc {widgetPosition === "right" ? "phải" : "trái"} dưới mọi trang client. AI chỉ tư vấn dịch vụ web, không làm việc khác.
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
      </div>

      {/* ─── Provider & Model ─── */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 text-base font-semibold text-foreground">Nhà cung cấp & Model</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label>Nhà cung cấp</Label>
            <SelectCustom
              value={provider}
              onValueChange={(v) => setProvider(v as Provider)}
              options={(catalogQuery.data ?? []).map<SelectCustomOption<Provider>>((p) => ({
                value: p.id as Provider,
                label: p.label,
              }))}
            />
            {providerSpec && (
              <a
                href={providerSpec.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <IconExternalLink size={12} /> Xem docs {providerSpec.label}
              </a>
            )}
          </div>

          <div className="space-y-2">
            <Label>Model</Label>
            <SelectCustom
              value={model}
              onValueChange={setModel}
              options={(providerSpec?.models ?? []).map<SelectCustomOption<string>>((m) => ({
                value: m.id,
                label: m.label,
                description: `${fmtUsd(m.inputPer1M)} in / ${fmtUsd(m.outputPer1M)} out · ${fmtTokens(m.contextWindow)} ctx`,
              }))}
            />
            {selectedModel && (
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div className="rounded bg-muted px-2 py-1">
                  <div className="text-muted-foreground">Context</div>
                  <div className="font-medium text-foreground">{fmtTokens(selectedModel.contextWindow)}</div>
                </div>
                <div className="rounded bg-muted px-2 py-1">
                  <div className="text-muted-foreground">Input/1M</div>
                  <div className="font-medium text-foreground">{fmtUsd(selectedModel.inputPer1M)}</div>
                </div>
                <div className="rounded bg-muted px-2 py-1">
                  <div className="text-muted-foreground">Output/1M</div>
                  <div className="font-medium text-foreground">{fmtUsd(selectedModel.outputPer1M)}</div>
                </div>
              </div>
            )}
            {selectedModel?.notes && (
              <p className="text-xs text-muted-foreground">{selectedModel.notes}</p>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <Label>API Key {hasKey && <span className="text-xs text-muted-foreground">(đã lưu — để trống để giữ nguyên)</span>}</Label>
          <div className="flex gap-2">
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={hasKey ? "••••••••" : `Key của ${providerSpec?.label}`}
              autoComplete="off"
            />
            <Button type="button" variant="outline" onClick={handleTest} disabled={testMut.isPending}>
              {testMut.isPending ? <IconLoader size={14} className="animate-spin" /> : null} Test
            </Button>
            {hasKey && (
              <Button type="button" variant="destructive" onClick={handleClearKey}>
                Xóa
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Key được mã hóa AES-256-GCM trước khi lưu DB. Test sẽ gửi 1 request ping rất ngắn.
          </p>
        </div>
      </div>

      {/* ─── Behavior ─── */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 text-base font-semibold text-foreground">Hành vi</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label>Max tokens output</Label>
            <Input
              type="number"
              min={64}
              max={8192}
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value) || 1024)}
            />
            <p className="text-xs text-muted-foreground">Output dài tối đa. Càng cao càng tốn tiền.</p>
          </div>
          <div className="space-y-2">
            <Label>Temperature ({temperature.toFixed(2)})</Label>
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">0 = trả lời cứng nhắc, 1+ = sáng tạo (dễ bịa). Khuyến nghị 0.3–0.5.</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label>Giới hạn / user / giờ</Label>
            <Input
              type="number"
              min={1}
              max={1000}
              value={perUserPerHour}
              onChange={(e) => setPerUserPerHour(parseInt(e.target.value) || 30)}
            />
          </div>
          <div className="space-y-2">
            <Label>Giới hạn / IP / giờ</Label>
            <Input
              type="number"
              min={1}
              max={1000}
              value={perIpPerHour}
              onChange={(e) => setPerIpPerHour(parseInt(e.target.value) || 20)}
            />
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <Label>Cho AI đọc snapshot dịch vụ</Label>
              <p className="text-xs text-muted-foreground">
                Tự inject markdown read-only (services + giá + TLD + source code) vào prompt. Tắt nếu muốn AI thuần persona.
              </p>
            </div>
            <Switch checked={allowDbContext} onCheckedChange={setAllowDbContext} />
          </div>
          <div className="pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refreshCtxMut.mutate()}
              disabled={refreshCtxMut.isPending}
            >
              {refreshCtxMut.isPending ? <IconLoader size={12} className="animate-spin" /> : null}
              Làm mới snapshot ngay
            </Button>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <Label>Hướng dẫn bổ sung (system prompt mở rộng)</Label>
          <Textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={5}
            placeholder="Ví dụ: 'Luôn ưu tiên giới thiệu gói VIP. Dùng giọng thân thiện kiểu bạn bè...'"
            maxLength={4000}
          />
          <p className="text-xs text-muted-foreground">
            Nội dung này được nhúng VÀO system prompt cố định (đã có guard chống injection). {systemPrompt.length}/4000.
          </p>
        </div>
      </div>

      {/* ─── Widget UI ─── */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 text-base font-semibold text-foreground">Hiển thị widget</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label>Tiêu đề widget</Label>
            <Input value={widgetTitle} onChange={(e) => setWidgetTitle(e.target.value)} maxLength={80} />
          </div>
          <div className="space-y-2">
            <Label>Vị trí</Label>
            <SelectCustom
              value={widgetPosition}
              onValueChange={(v) => setWidgetPosition(v as "right" | "left")}
              options={[
                { value: "right", label: "Góc phải" },
                { value: "left", label: "Góc trái" },
              ]}
            />
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <Label>Lời chào mở đầu</Label>
          <Textarea
            value={widgetGreeting}
            onChange={(e) => setWidgetGreeting(e.target.value)}
            rows={2}
            maxLength={500}
          />
        </div>
      </div>

      {/* ─── Save bar ─── */}
      <div className="sticky bottom-0 z-10 -mx-1 flex justify-end border-t border-border bg-background/95 px-1 py-3 backdrop-blur">
        <Button onClick={handleSave} disabled={saveMut.isPending} className="gap-2">
          {saveMut.isPending ? <IconLoader size={16} className="animate-spin" /> : <IconCheck size={16} />}
          Lưu cấu hình AI
        </Button>
      </div>
    </div>
  )
}
