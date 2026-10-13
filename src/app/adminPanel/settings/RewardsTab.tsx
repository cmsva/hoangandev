"use client"

import * as React from "react"
import { useTRPC } from "@/trpc/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@/components/ui/toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import { IconCheck, IconLoader, IconDollarCircle } from "@/components/icons"

export function RewardsTab() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const cfgQuery = useQuery(trpc.adminRewards.getConfig.queryOptions())
  const saveMut = useMutation({
    ...trpc.adminRewards.saveConfig.mutationOptions(),
    onSuccess: () => {
      toast.success("Đã lưu cấu hình")
      queryClient.invalidateQueries({ queryKey: trpc.adminRewards.getConfig.queryOptions().queryKey })
    },
    onError: (err: any) => toast.error(err.message || "Lưu thất bại"),
  })

  const [enabled, setEnabled] = React.useState(true)
  const [earnVnd, setEarnVnd] = React.useState("1000")
  const [redeemVnd, setRedeemVnd] = React.useState("100")
  const [minPoints, setMinPoints] = React.useState("500")
  const [loaded, setLoaded] = React.useState(false)

  React.useEffect(() => {
    if (cfgQuery.data && !loaded) {
      const d = cfgQuery.data
      setEnabled(d.enabled)
      setEarnVnd(String(d.earnVndPerPoint))
      setRedeemVnd(String(d.redeemVndPerPoint))
      setMinPoints(String(d.redeemMinPoints))
      setLoaded(true)
    }
  }, [cfgQuery.data, loaded])

  const earnNum = Math.max(1, parseInt(earnVnd.replace(/\D/g, "") || "0", 10))
  const redeemNum = Math.max(1, parseInt(redeemVnd.replace(/\D/g, "") || "0", 10))
  const minPointsNum = Math.max(1, parseInt(minPoints.replace(/\D/g, "") || "0", 10))

  const sampleEarn = 100_000 // 100.000đ mua → ? điểm
  const sampleEarnPoints = Math.floor(sampleEarn / earnNum)
  const sampleRedeemVnd = minPointsNum * redeemNum

  function handleSave() {
    saveMut.mutate({
      enabled,
      earnVndPerPoint: earnNum,
      redeemVndPerPoint: redeemNum,
      redeemMinPoints: minPointsNum,
    })
  }

  if (cfgQuery.isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Cấu hình tỉ lệ quy đổi điểm thưởng. Khách nhận điểm khi mua dịch vụ
          (không tính nạp tiền), đổi điểm sang số dư tại trang Điểm thưởng.
        </p>
        <Button type="button" size="sm" onClick={handleSave} disabled={saveMut.isPending} className="gap-2 shrink-0">
          {saveMut.isPending ? <IconLoader size={16} className="animate-spin" /> : <IconCheck size={16} />}
          Lưu cấu hình
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="p-6 space-y-6">
          {/* Toggle */}
          <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-border bg-muted/30 p-4 hover:bg-muted/50 transition-colors">
            <Checkbox
              checked={enabled}
              onCheckedChange={(v) => setEnabled(v === true)}
              className="mt-0.5"
            />
            <div className="space-y-1 flex-1">
              <div className="font-medium text-sm">Kích hoạt hệ thống điểm thưởng</div>
              <p className="text-xs text-muted-foreground">
                Khi tắt, người dùng vẫn có điểm tích lũy nhưng không nhận thêm và không đổi được.
              </p>
            </div>
          </label>

          {/* Earn rate */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="earn-vnd" className="text-sm font-medium">
                Tỉ lệ tích điểm (đ ↔ điểm)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="earn-vnd"
                  type="text"
                  value={earnVnd ? parseInt(earnVnd.replace(/\D/g, "") || "0").toLocaleString("vi-VN") : ""}
                  onChange={(e) => setEarnVnd(e.target.value)}
                  className="flex-1"
                  placeholder="1.000"
                />
                <span className="text-sm text-muted-foreground shrink-0">đ = 1 điểm</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Ví dụ: Mua {sampleEarn.toLocaleString("vi-VN")}đ → khách nhận{" "}
                <strong className="text-foreground">{sampleEarnPoints.toLocaleString("vi-VN")} điểm</strong>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="redeem-vnd" className="text-sm font-medium">
                Giá trị quy đổi (1 điểm = ? đ)
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground shrink-0">1 điểm =</span>
                <Input
                  id="redeem-vnd"
                  type="text"
                  value={redeemVnd ? parseInt(redeemVnd.replace(/\D/g, "") || "0").toLocaleString("vi-VN") : ""}
                  onChange={(e) => setRedeemVnd(e.target.value)}
                  className="flex-1"
                  placeholder="100"
                />
                <span className="text-sm text-muted-foreground shrink-0">đ</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Ví dụ: Khách đổi {minPointsNum.toLocaleString("vi-VN")} điểm →{" "}
                <strong className="text-foreground">{sampleRedeemVnd.toLocaleString("vi-VN")}đ</strong> số dư
              </p>
            </div>
          </div>

          {/* Min points */}
          <div className="space-y-2 max-w-md">
            <Label htmlFor="min-points" className="text-sm font-medium">
              Số điểm tối thiểu để đổi
            </Label>
            <Input
              id="min-points"
              type="text"
              value={minPoints ? parseInt(minPoints.replace(/\D/g, "") || "0").toLocaleString("vi-VN") : ""}
              onChange={(e) => setMinPoints(e.target.value)}
              placeholder="500"
            />
            <p className="text-xs text-muted-foreground">
              Khách phải đạt tối thiểu số điểm này mới có thể đổi sang số dư.
            </p>
          </div>

          {/* Preview card */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <IconDollarCircle size={16} />
              Tóm tắt cấu hình
            </div>
            <ul className="text-sm space-y-1 ml-6 list-disc text-muted-foreground">
              <li>
                Trạng thái:{" "}
                <strong className={enabled ? "text-emerald-600" : "text-rose-600"}>
                  {enabled ? "Đang bật" : "Đang tắt"}
                </strong>
              </li>
              <li>
                Khách mua{" "}
                <strong className="text-foreground">
                  {earnNum.toLocaleString("vi-VN")}đ
                </strong>{" "}
                = <strong className="text-foreground">1 điểm</strong>
              </li>
              <li>
                <strong className="text-foreground">1 điểm</strong> đổi được{" "}
                <strong className="text-foreground">{redeemNum.toLocaleString("vi-VN")}đ</strong>
              </li>
              <li>
                Tối thiểu{" "}
                <strong className="text-foreground">
                  {minPointsNum.toLocaleString("vi-VN")} điểm
                </strong>{" "}
                để được đổi
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
