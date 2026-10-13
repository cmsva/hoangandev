"use client"

import { useTRPC } from "@/trpc/client"
import { useQuery } from "@tanstack/react-query"
import { RecentOrdersSkeleton } from "@/components/dashboard/dashboard-skeletons"

export function RecentOrders() {
  const trpc = useTRPC()
  const { data: transactions, isLoading } = useQuery(trpc.dashboard.recentTransactions.queryOptions()) as { data: any[] | undefined; isLoading: boolean }

  if (isLoading) return <RecentOrdersSkeleton />

  const formatDate = (d: string | Date) =>
    new Date(d).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Giao dịch gần đây</h3>
          <p className="text-sm text-muted-foreground">Lịch sử biến động số dư tài khoản</p>
        </div>
        <a href="/customer/transactions" className="text-xs font-medium text-primary hover:underline">
          Xem tất cả →
        </a>
      </div>

      {/* ───── Mobile (card list) — < md ───── */}
      <div className="space-y-3 md:hidden">
        {transactions && transactions.length > 0 ? (
          transactions.map((tx: any) => (
            <div
              key={tx.id}
              className="rounded-lg border border-border/60 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <p
                  className="flex-1 text-sm font-medium leading-snug break-words"
                  style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}
                >
                  {tx.content}
                </p>
                <span
                  className={`shrink-0 text-sm font-semibold ${tx.moneyChange > 0 ? "text-green-500" : "text-red-500"}`}
                >
                  {tx.moneyChange > 0 ? "+" : ""}
                  {tx.moneyChange.toLocaleString()}đ
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>{formatDate(tx.createdAt)}</span>
                <span className="font-medium text-foreground">
                  Số dư: {tx.moneyAfter.toLocaleString()}đ
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Chưa có giao dịch nào
          </div>
        )}
      </div>

      {/* ───── Desktop (table) — md+ ───── */}
      <div className="hidden md:block overflow-x-hidden">
        <table className="w-full table-fixed">
          <colgroup>
            <col className="w-[38%]" />
            <col className="w-[24%]" />
            <col className="w-[18%]" />
            <col className="w-[20%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-border text-left">
              <th className="pb-3 pr-3 text-xs font-medium text-muted-foreground">Nội dung</th>
              <th className="pb-3 pr-3 text-xs font-medium text-muted-foreground">Thời gian</th>
              <th className="pb-3 pr-3 text-right text-xs font-medium text-muted-foreground">Biến động</th>
              <th className="pb-3 text-right text-xs font-medium text-muted-foreground">Số dư</th>
            </tr>
          </thead>
          <tbody>
            {transactions && transactions.length > 0 ? (
              transactions.map((tx: any) => (
                <tr key={tx.id} className="border-b border-border/50 last:border-0">
                  <td className="py-3 pr-3 align-top text-sm font-medium">
                    <span
                      className="block truncate"
                      title={typeof tx.content === "string" ? tx.content : ""}
                    >
                      {tx.content}
                    </span>
                  </td>
                  <td className="py-3 pr-3 align-top text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(tx.createdAt)}
                  </td>
                  <td
                    className={`py-3 pr-3 align-top text-right text-sm font-semibold whitespace-nowrap ${tx.moneyChange > 0 ? "text-green-500" : "text-red-500"}`}
                  >
                    {tx.moneyChange > 0 ? "+" : ""}
                    {tx.moneyChange.toLocaleString()}đ
                  </td>
                  <td className="py-3 align-top text-right text-sm font-medium whitespace-nowrap tabular-nums">
                    {tx.moneyAfter.toLocaleString()}đ
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                  Chưa có giao dịch nào
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
