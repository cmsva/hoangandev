import { CampaignsClient } from "../_components/CampaignsClient"

export const metadata = {
  title: "Chiến dịch Email | Admin Panel",
}

export default function AdminMailCampaignsPage() {
  return <CampaignsClient type="mail" />
}
