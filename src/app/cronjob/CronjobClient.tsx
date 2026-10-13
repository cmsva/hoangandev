"use client"

import { useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { useSidebar } from "@/components/sidebar-context"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { useCronjobCreate } from "@/hooks/use-cronjob-create"
import { ChevronsUpDown, Check, Clipboard } from "lucide-react"
import { cn } from "@/lib/utils"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SelectCustom } from "@/components/ui/select-custom"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

function formatPrice(n: number | undefined | null): string {
  return new Intl.NumberFormat("vi-VN").format(Number(n) || 0) + "đ"
}

export function CronjobClient() {
  const { collapsed } = useSidebar()
  const form = useCronjobCreate()

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    form.submit()
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div
        className={cn(
          "flex flex-1 flex-col transition-all duration-300 ease-in-out",
          collapsed ? "lg:ml-[72px]" : "lg:ml-[260px]"
        )}
      >
        <DashboardHeader />
        <main className="flex-1 p-4 sm:p-6">
          <div className="space-y-6">
            {/* Breadcrumb + title */}
            <div className="space-y-1">
              <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <a href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</a>
                <span className="text-muted-foreground/50">/</span>
                <span className="text-foreground">Cronjob</span>
              </nav>
              <h1 className="text-2xl font-bold tracking-tight">Cronjob</h1>
              <p className="text-sm text-muted-foreground">Dịch vụ thuê cronjob tự động chạy link theo lịch</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Panel — Form */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle>THUÊ CRONJOBS</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <form onSubmit={onSubmit} className="space-y-4">
                      {/* Server combobox */}
                      <div className="space-y-2">
                        <Label htmlFor="server">Chọn máy chủ</Label>
                        <Popover open={form.serverOpen} onOpenChange={form.setServerOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              role="combobox"
                              aria-expanded={form.serverOpen}
                              className="w-full justify-between h-11"
                              disabled={form.isLoadingServers}
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                {form.selectedServer ? (
                                  <>
                                    <span className="text-muted-foreground font-mono">#{form.selectedIndex}</span>
                                    <span className="truncate">{form.selectedServer.name}</span>
                                    <span className="ml-auto text-primary font-medium">{formatPrice(form.selectedServer.price)}</span>
                                  </>
                                ) : (
                                  <span className="text-muted-foreground">Chọn máy chủ</span>
                                )}
                              </div>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-[var(--radix-popover-trigger-width)] p-0"
                            align="start"
                          >
                            <Command shouldFilter={true}>
                              <CommandInput placeholder="Tìm kiếm máy chủ..." />
                              <CommandList>
                                <CommandEmpty>Không tìm thấy máy chủ.</CommandEmpty>
                                <CommandGroup>
                                  {form.servers.map((s, index) => (
                                    <CommandItem
                                      key={s.id}
                                      value={`${s.id} ${s.name}`}
                                      disabled={s.full}
                                      onSelect={() => {
                                        form.setServerId(form.serverId === s.id ? "" : s.id)
                                        form.setServerOpen(false)
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4 shrink-0",
                                          form.serverId === s.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="flex items-center gap-2 min-w-0">
                                            <span className="text-muted-foreground font-mono text-[10px]">
                                              #{index + 1}
                                            </span>
                                            <span className="font-bold truncate">{s.name}</span>
                                            {s.discountPercent > 0 && (
                                              <span className="rounded-sm bg-rose-500/15 text-rose-500 px-1 py-0 text-[10px] font-bold">
                                                -{s.discountPercent}%
                                              </span>
                                            )}
                                          </div>
                                          <span className="text-primary font-bold text-sm shrink-0">
                                            {formatPrice(s.price)}
                                          </span>
                                        </div>
                                        <div className="flex items-center justify-between text-[10px] text-muted-foreground font-medium uppercase">
                                          <span className="shrink-0 bg-muted px-1.5 py-0.5 rounded-sm italic">
                                            Tối thiểu: {s.timeloop}s
                                          </span>
                                          <span className="shrink-0">
                                            Còn lại:{" "}
                                            <span className="text-primary font-bold">
                                              {s.remaining.toLocaleString()}
                                            </span>{" "}
                                            slot
                                          </span>
                                        </div>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* URL */}
                      <div className="space-y-2">
                        <Label htmlFor="form.url">URL Cronjob</Label>
                        <div className="relative">
                          <Input
                            id="form.url"
                            type="text"
                            placeholder="https://example.com/api/cron"
                            value={form.url}
                            onChange={(e) => form.setUrl(e.target.value)}
                            className="pr-10 h-11 font-mono"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                            onClick={form.pasteUrl}
                          >
                            <Clipboard className="size-4" />
                            <span className="sr-only">Dán</span>
                          </Button>
                        </div>
                      </div>

                      {/* Method toggle — segmented control full-width */}
                      <div className="space-y-2">
                        <Label>Phương thức HTTP</Label>
                        <div className="grid grid-cols-2 gap-2 rounded-md border border-input bg-muted/30 p-1 h-11">
                          {([
                            { value: "GET" as const, color: "emerald", desc: "Lấy dữ liệu" },
                            { value: "POST" as const, color: "amber", desc: "Gửi dữ liệu" },
                          ]).map((m) => {
                            const active = form.method === m.value
                            const colorMap = {
                              emerald: "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30",
                              amber: "bg-amber-500 text-white shadow-sm shadow-amber-500/30",
                            } as const
                            return (
                              <button
                                key={m.value}
                                type="button"
                                onClick={() => form.setMethod(m.value)}
                                className={cn(
                                  "flex items-center justify-center gap-2 rounded-sm font-bold text-sm transition-all duration-200",
                                  active
                                    ? colorMap[m.color as keyof typeof colorMap]
                                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                                )}
                              >
                                <span className="font-mono tracking-wide">{m.value}</span>
                                <span className={cn(
                                  "text-[10px] font-medium uppercase tracking-wider",
                                  active ? "opacity-90" : "opacity-60"
                                )}>
                                  {m.desc}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Interval + Months */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="form.intervalSeconds">
                            Số giây{" "}
                            <span className="text-muted-foreground font-normal">
                              (tối thiểu {form.selectedServer?.timeloop ?? "..."}s)
                            </span>
                          </Label>
                          <Input
                            id="form.intervalSeconds"
                            type="number"
                            placeholder={form.selectedServer ? `${form.selectedServer.timeloop}+` : "Nhập số giây"}
                            value={form.intervalSeconds}
                            onChange={(e) => form.setIntervalSeconds(e.target.value)}
                            className="h-11"
                          />
                          <p className="text-xs text-muted-foreground">Ví dụ: 60 = chạy mỗi 60 giây</p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="form.months">Thời gian sử dụng</Label>
                          <SelectCustom
                            id="form.months"
                            value={form.months}
                            onValueChange={form.setMonths}
                            size="lg"
                            disabled={!form.selectedServer}
                            placeholder={form.selectedServer ? "-- Chọn thời gian --" : "Vui lòng chọn máy chủ trước"}
                            options={
                              form.selectedServer
                                ? Array.from({ length: 12 }).map((_, i) => {
                                    const m = i + 1
                                    const price = form.selectedServer?.price ?? 0
                                    return {
                                      value: String(m),
                                      label: `${m} tháng`,
                                      triggerLabel: `${m} tháng - ${formatPrice(price * m)}`,
                                      description: formatPrice(price * m),
                                    }
                                  })
                                : []
                            }
                          />
                        </div>
                      </div>

                      {/* Advanced toggle */}
                      <button
                        type="button"
                        onClick={() => form.setShowAdvanced((v) => !v)}
                        className="text-xs text-primary hover:underline"
                      >
                        {form.showAdvanced ? "− Ẩn tùy chọn nâng cao" : "+ Tùy chọn nâng cao (Headers / Body)"}
                      </button>

                      {form.showAdvanced && (
                        <div className="space-y-4 rounded-md border bg-muted/30 p-3">
                          <div className="space-y-2">
                            <Label>Headers (JSON, optional)</Label>
                            <textarea
                              value={form.headers}
                              onChange={(e) => form.setHeaders(e.target.value)}
                              placeholder='{"Authorization": "Bearer xxx"}'
                              rows={3}
                              maxLength={8192}
                              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3"
                            />
                          </div>
                          {form.method === "POST" && (
                            <div className="space-y-2">
                              <Label>Body (raw, optional)</Label>
                              <textarea
                                value={form.body}
                                onChange={(e) => form.setBody(e.target.value)}
                                placeholder='{"key": "value"}'
                                rows={3}
                                maxLength={16384}
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3"
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Total */}
                      <div className="space-y-2">
                        <Label htmlFor="total">Tổng thanh toán</Label>
                        <Input
                          id="total"
                          type="text"
                          value={formatPrice(form.totalPay)}
                          readOnly
                          className="bg-muted h-11 font-bold text-primary"
                        />
                      </div>

                      <Button
                        type="submit"
                        className="w-full h-11 font-bold"
                        disabled={form.isCreating || !form.selectedServer}
                      >
                        {form.isCreating ? "Đang xử lý..." : "Thuê Cronjob"}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>

              {/* Right Panel — Notes */}
              <div className="lg:col-span-1">
                <Card>
                  <CardHeader>
                    <CardTitle>LƯU Ý</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <h3 className="font-bold text-foreground text-base mb-3">
                      Quy định về việc sử dụng hệ thống :
                    </h3>
                    <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                      <p>
                        <strong className="text-foreground">
                          - Không kích hoạt Firewall đối với liên kết CRON:
                        </strong>{" "}
                        Việc bật Firewall có thể gây gián đoạn hệ thống và ngăn cản CRON thực hiện nhiệm vụ.
                      </p>
                      <p>
                        <strong className="text-foreground">
                          - Sử dụng đúng mục đích:
                        </strong>{" "}
                        Chúng tôi có quyền tạm ngưng hoặc hủy vĩnh viễn các liên kết CRON vi phạm. Các trường hợp lạm dụng sẽ không được hoàn tiền.
                      </p>
                      <p>
                        <strong className="text-foreground">
                          - Cung cấp chính xác liên kết CRON:
                        </strong>{" "}
                        Đảm bảo nhập đầy đủ và chính xác đường dẫn, bao gồm tiền tố "https://...". URL sai sẽ không được hoàn tiền.
                      </p>
                      <p>
                        <strong className="text-foreground">
                          - Không sử dụng CronJob để tấn công DDoS, spam,
                        </strong>{" "}
                        hoặc bất kỳ hành vi vi phạm pháp luật nào.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

