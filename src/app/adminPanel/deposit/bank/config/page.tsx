import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { BankConfigClient } from "./BankConfigClient"

export const metadata = {
  title: "Cấu hình ngân hàng | Admin Panel",
}

export default function AdminBankConfigPage() {
  void Promise.all([
    prefetch(trpc.adminDeposit.getAdminBankConfig.queryOptions()),
    prefetch(trpc.adminDeposit.getAdminBanks.queryOptions())
  ])

  return (
    <HydrateClient>
      <BankConfigClient />
    </HydrateClient>
  )
}
