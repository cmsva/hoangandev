import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { BankClient } from "./BankClient"

export const metadata = {
  title: "Nạp ngân hàng | Admin Panel",
}

export default async function AdminBankPage() {
  prefetch(trpc.adminDeposit.getAdminInvoices.queryOptions({ limit: 500 }))

  return (
    <HydrateClient>
      <BankClient />
    </HydrateClient>
  )
}
