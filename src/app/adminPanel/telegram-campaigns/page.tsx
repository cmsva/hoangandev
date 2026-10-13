import { CampaignsClient } from "../_components/CampaignsClient"

export const metadata = {
  title: "Chiến dịch Telegram | Admin Panel",
}

export default function AdminTelegramCampaignsPage() {
  return <CampaignsClient type="telegram" />
}
