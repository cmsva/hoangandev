"use client"

import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/toast"
import { IconDollarCircle } from "@/components/icons"

export function AffiliateConfigClient() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const configQuery = useQuery(trpc.adminAffiliate.getConfig.queryOptions())
  const [enabled, setEnabled] = useState(true)
  const [balanceEnabled, setBalanceEnabled] = useState(true)
  const [bankEnabled, setBankEnabled] = useState(true)
  const [rate, setRate] = useState("0")
  const [minWithdraw, setMinWithdraw] = useState("0")
  const [maxWithdraw, setMaxWithdraw] = useState("0")
  const [minDeposit, setMinDeposit] = useState("0")
  const [maxDeposit, setMaxDeposit] = useState("0")

  useEffect(() => {
    const cfg = configQuery.data
    if (!cfg) return
    setEnabled(cfg.enabled)
    setBalanceEnabled(cfg.balanceEnabled)
    setBankEnabled(cfg.bankEnabled)
    setRate(String(cfg.rate))
    setMinWithdraw(String(cfg.minWithdraw))
    setMaxWithdraw(String(cfg.maxWithdraw))
    setMinDeposit(String(cfg.minDeposit))
    setMaxDeposit(String(cfg.maxDeposit))
  }, [configQuery.data])

  const updateMutation = useMutation(
    trpc.adminAffiliate.updateConfig.mutationOptions({
      onSuccess: async (result) => {
        toast.success(result.message)
        await queryClient.invalidateQueries({ queryKey: trpc.adminAffiliate.getConfig.queryKey() })
      },
      onError: (error) => toast.error(error.message),
    })
  )
  function save() {
    updateMutation.mutate({
      enabled,
      balanceEnabled,
      bankEnabled,
      rate: Number(rate),
      minWithdraw: Number(minWithdraw),
      maxWithdraw: Number(maxWithdraw),
      minDeposit: Number(minDeposit),
      maxDeposit: Number(maxDeposit),
    })
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <a href="/adminPanel/dashboard" className="transition-colors hover:text-foreground">Admin</a>
          <ChevronRight />
          <span>Affiliate</span>
          <ChevronRight />
          <span className="text-foreground">Cấu hình</span>
        </nav>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <IconDollarCircle size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Cấu hình Affiliate</h1>
            <p className="text-sm text-muted-foreground">Quản lý hoa hồng, điều kiện tính hoa hồng và hạn mức rút tiền.</p>
          </div>
        </div>
      </header>

      <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5 rounded-md border bg-card p-5">
          <div>
            <h2 className="text-lg font-semibold">Thiết lập chính</h2>
            <p className="text-sm text-muted-foreground">Nhập 0 cho các giới hạn min/max nếu không muốn giới hạn.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tỉ lệ hoa hồng (%)"><Input type="number" min="0" max="100" value={rate} onChange={(event) => setRate(event.target.value)} /></Field>
            <Field label="Nạp tối thiểu được tính HH"><Input type="number" min="0" value={minDeposit} onChange={(event) => setMinDeposit(event.target.value)} /></Field>
            <Field label="Nạp tối đa được tính HH"><Input type="number" min="0" value={maxDeposit} onChange={(event) => setMaxDeposit(event.target.value)} /></Field>
            <Field label="Rút tối thiểu"><Input type="number" min="0" value={minWithdraw} onChange={(event) => setMinWithdraw(event.target.value)} /></Field>
            <Field label="Rút tối đa"><Input type="number" min="0" value={maxWithdraw} onChange={(event) => setMaxWithdraw(event.target.value)} /></Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <ToggleCard title="Affiliate" desc="Bật chương trình" checked={enabled} onChange={setEnabled} />
            <ToggleCard title="Rút về số dư" desc="Auto duyệt" checked={balanceEnabled} onChange={setBalanceEnabled} />
            <ToggleCard title="Rút ngân hàng" desc="Admin duyệt" checked={bankEnabled} onChange={setBankEnabled} />
          </div>
          <div className="flex justify-end"><Button onClick={save} disabled={updateMutation.isPending || configQuery.isLoading}>{updateMutation.isPending ? "Đang lưu..." : "Lưu cấu hình"}</Button></div>
        </div>
        <aside className="rounded-md border bg-card p-5">
          <h2 className="text-lg font-semibold">Ghi chú vận hành</h2>
          <div className="mt-4 space-y-3 text-sm text-muted-foreground">
            <p>Min/max nạp áp dụng khi cộng hoa hồng từ giao dịch gốc; 0 nghĩa là không giới hạn.</p>
            <p>Min/max rút áp dụng cho cả rút về số dư và rút ngân hàng; 0 nghĩa là không giới hạn.</p>
            <p>Khi từ chối yêu cầu rút ngân hàng, hệ thống hoàn lại vào số dư hoa hồng của user.</p>
          </div>
        </aside>
      </section>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>
}

function ToggleCard({ title, desc, checked, onChange }: { title: string; desc: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className={`rounded-md border p-4 text-left transition-colors ${checked ? "border-primary/40 bg-primary/10" : "bg-background hover:bg-accent"}`}>
      <span className="text-sm font-semibold">{title}</span>
      <span className="mt-1 block text-xs text-muted-foreground">{desc}</span>
      <span className={`mt-3 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${checked ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>{checked ? "Đang bật" : "Đang tắt"}</span>
    </button>
  )
}

function ChevronRight() {
  return <span className="text-muted-foreground/50">/</span>
}
