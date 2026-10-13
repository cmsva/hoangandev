"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { IconAlertWarning, IconCreditCard } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SelectCustom } from "@/components/ui/select-custom"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "@/components/ui/toast"
import { useTRPC } from "@/trpc/client"

interface BankConfig {
  bankStatus: boolean
  bankMin: number
  bankMax: number
  prefix: string
  typeRandom: number
  rangeRandom: number
  timeInvoices: number
}

interface AdminBank {
  id: string
  shortName: string
  fullName: string
  accountNumber: string
  accountName: string
  status: number
  apiProvider: string
  apiToken: string
  bankUsername: string
  bankPassword: string
  lastCheckAt: string | Date | null
  lastError: string
  balance: number | null
}

interface BankFormState {
  shortName: string
  accountNumber: string
  accountName: string
  status: number
  apiProvider: string
  apiToken: string
  bankUsername: string
  bankPassword: string
}
const emptyForm: BankFormState = {
  shortName: "",
  accountNumber: "",
  accountName: "",
  status: 1,
  apiProvider: "none",
  apiToken: "",
  bankUsername: "",
  bankPassword: "",
}

const bankOptions = [
  { shortName: "VietinBank", fullName: "Ngân hàng TMCP Công thương Việt Nam", bin: "970415", coderent: true, thueapibank: true },
  { shortName: "Vietcombank", fullName: "Ngân hàng TMCP Ngoại Thương Việt Nam", bin: "970436", coderent: true, thueapibank: true },
  { shortName: "BIDV", fullName: "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam", bin: "970418", coderent: true, thueapibank: true },
  { shortName: "OCB", fullName: "Ngân hàng TMCP Phương Đông", bin: "970448", coderent: true, thueapibank: true, direct: "ocb" },
  { shortName: "MBBank", fullName: "Ngân hàng TMCP Quân đội", bin: "970422", thueapibank: true, direct: "mbbank" },
  { shortName: "Techcombank", fullName: "Ngân hàng TMCP Kỹ thương Việt Nam", bin: "970407", coderent: true, thueapibank: true },
  { shortName: "ACB", fullName: "Ngân hàng TMCP Á Châu", bin: "970416", thueapibank: true, direct: "acb" },
  { shortName: "VPBank", fullName: "Ngân hàng TMCP Việt Nam Thịnh Vượng", bin: "970432", coderent: true, thueapibank: true },
  { shortName: "TPBank", fullName: "Ngân hàng TMCP Tiên Phong", bin: "970423", coderent: true, thueapibank: true },
  { shortName: "MSB", fullName: "Ngân hàng TMCP Hàng Hải", bin: "970426", coderent: true, thueapibank: true },
  { shortName: "SeABank", fullName: "Ngân hàng TMCP Đông Nam Á", bin: "970440", coderent: true, thueapibank: true },
  { shortName: "Agribank", fullName: "Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam", bin: "970405" },
  { shortName: "Sacombank", fullName: "Ngân hàng TMCP Sài Gòn Thương Tín", bin: "970403" },
  { shortName: "HDBank", fullName: "Ngân hàng TMCP Phát triển TP.HCM", bin: "970437" },
  { shortName: "VIB", fullName: "Ngân hàng TMCP Quốc tế Việt Nam", bin: "970441" },
  { shortName: "SHB", fullName: "Ngân hàng TMCP Sài Gòn - Hà Nội", bin: "970443" },
] as const

function getProviderOptions(shortName: string): Array<{ value: string; label: string }> {
  const bank = bankOptions.find((item) => item.shortName === shortName)
  const options: Array<{ value: string; label: string }> = [{ value: "none", label: "Thủ công" }]
  if (!bank) return options
  if ("coderent" in bank && bank.coderent) options.push({ value: "coderent", label: "Coderent" })
  if ("thueapibank" in bank && bank.thueapibank) options.push({ value: "thueapibank", label: "ThueApiBank" })
  if ("direct" in bank && bank.direct) options.push({ value: bank.direct, label: `${bank.shortName} Direct` })
  return options
}

function getBankLogo(shortName: string): string | null {
  const bank = bankOptions.find((item) => item.shortName === shortName)
  return bank ? `/ibankings/${bank.bin}.png` : null
}

const typeRandomOptions = [
  { value: "0", label: "Chỉ số" },
  { value: "1", label: "Chỉ chữ" },
  { value: "2", label: "Chữ + số" },
]

function formatMoney(value: number | null | undefined): string {
  const amount = Number(value)
  return `${new Intl.NumberFormat("vi-VN").format(Number.isFinite(amount) ? amount : 0)}đ`
}

function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function isDirectProvider(provider: string): boolean {
  return provider === "acb" || provider === "mbbank" || provider === "ocb"
}

function ChevronRight() {
  return <span className="text-muted-foreground/50">/</span>
}

function SearchIcon() {
  return (
    <svg className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}
export function BankConfigClient() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [guideOpen, setGuideOpen] = useState(false)
  const [editingBank, setEditingBank] = useState<AdminBank | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [deletingBank, setDeletingBank] = useState<AdminBank | null>(null)
  const [configForm, setConfigForm] = useState<BankConfig | null>(null)

  const { data: config, isLoading: isConfigLoading } = useQuery(
    trpc.adminDeposit.getAdminBankConfig.queryOptions()
  ) as { data: BankConfig | undefined; isLoading: boolean }

  const { data: banks = [], isLoading: isBanksLoading, isFetching } = useQuery(
    trpc.adminDeposit.getAdminBanks.queryOptions()
  ) as { data: AdminBank[]; isLoading: boolean; isFetching: boolean }

  useEffect(() => {
    if (!config) return
    setConfigForm(config)
  }, [config])

  const filteredBanks = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return banks
    return banks.filter((bank) => [
      bank.shortName,
      bank.fullName,
      bank.accountNumber,
      bank.accountName,
      bank.apiProvider,
    ].some((value) => String(value || "").toLowerCase().includes(keyword)))
  }, [banks, search])

  const updateConfigMutation = useMutation({
    ...trpc.adminDeposit.updateAdminBankConfig.mutationOptions(),
    onSuccess: () => {
      toast.success("Đã lưu cấu hình")
      queryClient.invalidateQueries({ queryKey: trpc.adminDeposit.getAdminBankConfig.queryKey() })
    },
    onError: (error) => toast.error(error.message || "Lưu cấu hình thất bại"),
  })

  const updateBankMutation = useMutation({
    ...trpc.adminDeposit.updateAdminBank.mutationOptions(),
    onSuccess: () => {
      toast.success("Đã cập nhật ngân hàng")
      setEditingBank(null)
      queryClient.invalidateQueries({ queryKey: trpc.adminDeposit.getAdminBanks.queryKey() })
    },
    onError: (error) => toast.error(error.message || "Cập nhật thất bại"),
  })

  const addBankMutation = useMutation({
    ...trpc.adminDeposit.addAdminBank.mutationOptions(),
    onSuccess: () => {
      toast.success("Đã thêm ngân hàng")
      setIsCreating(false)
      queryClient.invalidateQueries({ queryKey: trpc.adminDeposit.getAdminBanks.queryKey() })
    },
    onError: (error) => toast.error(error.message || "Thêm ngân hàng thất bại"),
  })

  const deleteBankMutation = useMutation({
    ...trpc.adminDeposit.deleteAdminBank.mutationOptions(),
    onSuccess: () => {
      toast.success("Đã xóa ngân hàng")
      setDeletingBank(null)
      queryClient.invalidateQueries({ queryKey: trpc.adminDeposit.getAdminBanks.queryKey() })
    },
    onError: (error) => toast.error(error.message || "Xóa ngân hàng thất bại"),
  })
  function updateConfigField<K extends keyof BankConfig>(key: K, value: BankConfig[K]): void {
    setConfigForm((current) => current ? { ...current, [key]: value } : current)
  }

  function handleSaveConfig(): void {
    if (!configForm) return
    updateConfigMutation.mutate({
      bankStatus: configForm.bankStatus,
      bankMin: Number(configForm.bankMin) || 0,
      bankMax: Number(configForm.bankMax) || 0,
      prefix: configForm.prefix.trim(),
      typeRandom: Number(configForm.typeRandom) || 0,
      rangeRandom: Number(configForm.rangeRandom) || 8,
      timeInvoices: Number(configForm.timeInvoices) || 86400,
    })
  }

  function handleToggleBank(bank: AdminBank, nextStatus: number): void {
    updateBankMutation.mutate({
      id: bank.id,
      shortName: bank.shortName,
      accountNumber: bank.accountNumber,
      accountName: bank.accountName,
      status: nextStatus,
      apiProvider: bank.apiProvider || "none",
      apiToken: bank.apiToken || "",
      bankUsername: bank.bankUsername || "",
      bankPassword: bank.bankPassword || "",
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Link href="/adminPanel/dashboard" className="transition-colors hover:text-foreground">Admin</Link>
            <ChevronRight />
            <Link href="/adminPanel/deposit/bank" className="transition-colors hover:text-foreground">Ngân hàng</Link>
            <ChevronRight />
            <span className="text-foreground">Cấu hình</span>
          </nav>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-600">
              <IconCreditCard size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Cấu hình ngân hàng</h1>
              <p className="text-sm text-muted-foreground">Thiết lập nạp bank và quản lý danh sách tài khoản nhận tiền.</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link href="/adminPanel/deposit/bank">Quay lại</Link></Button>
          <Button variant="outline" onClick={() => setGuideOpen(true)}>Hướng dẫn</Button>
          <Button onClick={() => setIsCreating(true)}>Thêm ngân hàng</Button>
        </div>
      </div>
      <div className="space-y-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Cấu hình chung</h2>
              <p className="text-sm text-muted-foreground">Áp dụng cho luồng tạo hóa đơn nạp ngân hàng.</p>
            </div>
            <button
              type="button"
              onClick={() => configForm && updateConfigField("bankStatus", !configForm.bankStatus)}
              className={`relative h-6 w-11 rounded-full transition-colors ${configForm?.bankStatus ? "bg-emerald-500" : "bg-muted"}`}
              aria-label="Bật tắt nạp ngân hàng"
              disabled={!configForm}
            >
              <span className={`absolute top-0.5 size-5 rounded-full bg-white transition-transform ${configForm?.bankStatus ? "left-5" : "left-0.5"}`} />
            </button>
          </div>

          {isConfigLoading || !configForm ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-10 w-full" />)}
            </div>
          ) : (
            <div className="space-y-4">
              <Field label="Prefix mã giao dịch">
                <Input value={configForm.prefix} onChange={(event) => updateConfigField("prefix", event.target.value)} placeholder="VD: VK" />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nạp tối thiểu">
                  <Input type="number" value={configForm.bankMin} onChange={(event) => updateConfigField("bankMin", Number(event.target.value))} />
                </Field>
                <Field label="Nạp tối đa">
                  <Input type="number" value={configForm.bankMax} onChange={(event) => updateConfigField("bankMax", Number(event.target.value))} />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Loại mã random">
                  <SelectCustom value={String(configForm.typeRandom)} onValueChange={(value) => updateConfigField("typeRandom", Number(value))} options={typeRandomOptions} />
                </Field>
                <Field label="Độ dài mã GD">
                  <Input type="number" value={configForm.rangeRandom} onChange={(event) => updateConfigField("rangeRandom", Number(event.target.value))} />
                </Field>
              </div>
              <Field label="Thời gian hết hạn hóa đơn (giây)">
                <Input type="number" value={configForm.timeInvoices} onChange={(event) => updateConfigField("timeInvoices", Number(event.target.value))} />
                <p className="mt-1 text-xs text-muted-foreground">86400 giây = 24 giờ.</p>
              </Field>
              <Button className="w-full" onClick={handleSaveConfig} disabled={updateConfigMutation.isPending}>
                {updateConfigMutation.isPending ? "Đang lưu..." : "Lưu cấu hình"}
              </Button>
            </div>
          )}
        </div>
        <div className="rounded-lg border bg-card p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <SearchIcon />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tìm ngân hàng, số tài khoản..."
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 ps-9 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
                {isFetching && !isBanksLoading && <span className="absolute right-3 top-1/2 size-3 -translate-y-1/2 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />}
              </div>
              <Button variant="outline" onClick={() => setSearch("")}>Xóa lọc</Button>
            </div>
          </div>

          <div className="hidden overflow-hidden rounded-lg border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[240px]">Ngân hàng</TableHead>
                  <TableHead>Số tài khoản</TableHead>
                  <TableHead>Chủ tài khoản</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Trạng thái API</TableHead>
                  <TableHead className="text-center">Bật</TableHead>
                  <TableHead className="text-end">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isBanksLoading ? (
                  Array.from({ length: 5 }).map((_, rowIndex) => (
                    <TableRow key={rowIndex}>{Array.from({ length: 7 }).map((__, cellIndex) => <TableCell key={cellIndex}><Skeleton className="h-4 w-20" /></TableCell>)}</TableRow>
                  ))
                ) : filteredBanks.length > 0 ? (
                  filteredBanks.map((bank) => (
                    <TableRow key={bank.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getBankLogo(bank.shortName) && (
                            <img src={getBankLogo(bank.shortName) ?? ""} alt={bank.shortName} className="size-8 rounded object-contain" />
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold">{bank.shortName}</p>
                            <p className="max-w-[220px] truncate text-xs text-muted-foreground">{bank.fullName}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{bank.accountNumber}</TableCell>
                      <TableCell className="text-sm font-medium">{bank.accountName}</TableCell>
                      <TableCell><ProviderBadge provider={bank.apiProvider} /></TableCell>
                      <TableCell>
                        <p className={bank.lastError ? "max-w-[220px] truncate text-xs text-rose-600" : "text-xs text-emerald-600"}>
                          {bank.lastError || `OK · ${formatDateTime(bank.lastCheckAt)}`}
                        </p>
                        {bank.balance !== null && <p className="text-[11px] text-muted-foreground">Số dư API: {formatMoney(bank.balance)}</p>}
                      </TableCell>
                      <TableCell className="text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleBank(bank, bank.status === 1 ? 0 : 1)}
                          className={`relative h-6 w-11 rounded-full transition-colors ${bank.status === 1 ? "bg-emerald-500" : "bg-muted"}`}
                          aria-label="Bật tắt ngân hàng"
                          disabled={updateBankMutation.isPending}
                        >
                          <span className={`absolute top-0.5 size-5 rounded-full bg-white transition-transform ${bank.status === 1 ? "left-5" : "left-0.5"}`} />
                        </button>
                      </TableCell>
                      <TableCell className="text-end">
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant="outline" onClick={() => setEditingBank(bank)}>Sửa</Button>
                          <Button size="sm" variant="destructive" onClick={() => setDeletingBank(bank)}>Xóa</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Chưa có ngân hàng nào.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="space-y-3 md:hidden">
            {filteredBanks.map((bank) => (
              <div key={bank.id} className="space-y-3 rounded-lg border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    {getBankLogo(bank.shortName) && (
                      <img src={getBankLogo(bank.shortName) ?? ""} alt={bank.shortName} className="size-8 rounded object-contain" />
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold">{bank.shortName}</p>
                      <p className="truncate text-xs text-muted-foreground">{bank.accountNumber} · {bank.accountName}</p>
                    </div>
                  </div>
                  <ProviderBadge provider={bank.apiProvider} />
                </div>
                {bank.lastError && <p className="text-xs text-rose-600">{bank.lastError}</p>}
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setEditingBank(bank)}>Sửa</Button>
                  <Button size="sm" variant="destructive" className="flex-1" onClick={() => setDeletingBank(bank)}>Xóa</Button>
                </div>
              </div>
            ))}
          </div>
        </div>

      {(isCreating || editingBank) && (
        <BankFormDialog
          bank={editingBank}
          onClose={() => { setIsCreating(false); setEditingBank(null) }}
          onSubmit={(form) => {
            const payload = {
              shortName: form.shortName.trim(),
              accountNumber: form.accountNumber.trim(),
              accountName: form.accountName.trim(),
              status: form.status,
              apiProvider: form.apiProvider || "none",
              apiToken: form.apiToken.trim(),
              bankUsername: form.bankUsername.trim(),
              bankPassword: form.bankPassword.trim(),
              deviceId: "",
            }
            if (editingBank) updateBankMutation.mutate({ id: editingBank.id, ...payload })
            else addBankMutation.mutate(payload)
          }}
          isPending={addBankMutation.isPending || updateBankMutation.isPending}
        />
      )}

      <ConfirmDialog
        open={!!deletingBank}
        onOpenChange={(open) => !open && setDeletingBank(null)}
        title="Xóa ngân hàng"
        description={deletingBank ? `Xóa ${deletingBank.shortName} - ${deletingBank.accountNumber}?` : ""}
        variant="destructive"
        confirmText="Xóa"
        cancelText="Hủy"
        isPending={deleteBankMutation.isPending}
        onConfirm={() => deletingBank && deleteBankMutation.mutate({ id: deletingBank.id })}
      />

      <GuideDialog open={guideOpen} onOpenChange={setGuideOpen} />
    </div>
  )
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function ProviderBadge({ provider }: { provider: string }) {
  const normalized = provider || "none"
  const tone = normalized === "none" ? "bg-muted text-muted-foreground" : isDirectProvider(normalized) ? "bg-emerald-500/15 text-emerald-600" : "bg-blue-500/15 text-blue-600"
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}>{normalized}</span>
}

function BankFormDialog({ bank, onClose, onSubmit, isPending }: { bank: AdminBank | null; onClose: () => void; onSubmit: (form: BankFormState) => void; isPending: boolean }) {
  const [form, setForm] = useState<BankFormState>(() => bank ? {
    shortName: bank.shortName,
    accountNumber: bank.accountNumber,
    accountName: bank.accountName,
    status: bank.status,
    apiProvider: bank.apiProvider || "none",
    apiToken: bank.apiToken || "",
    bankUsername: bank.bankUsername || "",
    bankPassword: bank.bankPassword || "",
  } : emptyForm)

  function setField<K extends keyof BankFormState>(key: K, value: BankFormState[K]): void {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function handleSubmit(): void {
    if (!form.shortName.trim() || !form.accountNumber.trim() || !form.accountName.trim()) {
      toast.error("Vui lòng nhập đủ thông tin ngân hàng")
      return
    }
    if (isDirectProvider(form.apiProvider) && (!form.bankUsername.trim() || !form.bankPassword.trim())) {
      toast.error("Direct API yêu cầu username và password")
      return
    }
    onSubmit(form)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !isPending && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-lg">
        <DialogHeader><DialogTitle>{bank ? "Sửa ngân hàng" : "Thêm ngân hàng"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <Field label="Ngân hàng">
            <SelectCustom
              value={form.shortName}
              onValueChange={(value) => {
                const options = getProviderOptions(value)
                setForm((current) => ({
                  ...current,
                  shortName: value,
                  apiProvider: options.some((option) => option.value === current.apiProvider) ? current.apiProvider : "none",
                }))
              }}
              placeholder="Chọn ngân hàng..."
              searchable
              searchPlaceholder="Tìm ngân hàng..."
              emptyMessage="Không tìm thấy ngân hàng"
              contentClassName="max-h-80 overflow-y-auto"
              options={bankOptions.map((item) => ({
                value: item.shortName,
                label: (
                  <div className="flex min-w-0 items-center gap-2">
                    <img src={`/ibankings/${item.bin}.png`} alt={item.shortName} className="size-6 rounded object-contain" />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{item.shortName}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{item.fullName}</span>
                    </span>
                  </div>
                ),
                triggerLabel: (
                  <div className="flex min-w-0 items-center gap-2">
                    <img src={`/ibankings/${item.bin}.png`} alt={item.shortName} className="size-5 rounded object-contain" />
                    <span className="truncate">{item.shortName} - {item.fullName}</span>
                  </div>
                ),
              }))}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Số tài khoản">
              <Input value={form.accountNumber} onChange={(event) => setField("accountNumber", event.target.value)} />
            </Field>
            <Field label="Chủ tài khoản">
              <Input value={form.accountName} onChange={(event) => setField("accountName", event.target.value)} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Provider API">
              <SelectCustom value={form.apiProvider || "none"} onValueChange={(value) => setField("apiProvider", value)} options={getProviderOptions(form.shortName)} />
            </Field>
            <Field label="Trạng thái">
              <SelectCustom value={String(form.status)} onValueChange={(value) => setField("status", Number(value))} options={[{ value: "1", label: "Đang bật" }, { value: "0", label: "Đang tắt" }]} />
            </Field>
          </div>
          {isDirectProvider(form.apiProvider) ? (
            <>
              <Field label="Username iBanking">
                <Input value={form.bankUsername} onChange={(event) => setField("bankUsername", event.target.value)} />
              </Field>
              <Field label="Password iBanking">
                <Input type="password" value={form.bankPassword} onChange={(event) => setField("bankPassword", event.target.value)} />
              </Field>
            </>
          ) : form.apiProvider !== "none" ? (
            <Field label="API token hoặc URL history">
              <Input value={form.apiToken} onChange={(event) => setField("apiToken", event.target.value)} placeholder="Token Coderent / ThueApiBank" />
              <p className="mt-1 text-xs text-muted-foreground">Có thể nhập token ngắn hoặc URL history đầy đủ từ provider.</p>
            </Field>
          ) : null}
        </div>
        <DialogFooter className="flex-row gap-2 sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={isPending}>Hủy</Button>
          <Button onClick={handleSubmit} disabled={isPending}>{isPending ? "Đang lưu..." : bank ? "Cập nhật" : "Thêm mới"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function GuideDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><IconAlertWarning size={18} /> Hướng dẫn cấu hình auto bank</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm text-muted-foreground">
          <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-4">
            <h3 className="mb-2 font-bold text-foreground">Direct API</h3>
            <p>ACB, MBBank và OCB có thể dùng username/password iBanking. Thông tin được mã hóa trước khi lưu.</p>
          </div>
          <div className="rounded-lg border border-blue-500/25 bg-blue-500/10 p-4">
            <h3 className="mb-2 font-bold text-foreground">Coderent / ThueApiBank</h3>
            <p>Nhập API token hoặc URL history. Cron bank sẽ đọc giao dịch, match mã hóa đơn trong nội dung chuyển khoản và tự cộng tiền.</p>
          </div>
          <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-4">
            <h3 className="mb-2 font-bold text-foreground">Cron tự động</h3>
            <code className="block rounded bg-background/80 p-2 text-xs text-foreground">/cmstdev/cron/deposit/check?type=MBBank&amp;secret=CRON_SECRET</code>
            <p className="mt-2">Mỗi ngân hàng nên có một cron riêng theo short name.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
