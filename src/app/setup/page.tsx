import { redirect } from "next/navigation"
import { isSetupComplete } from "@/services/setup.service"
import { SetupWizardClient } from "./SetupWizardClient"

// Trang setup check DB để redirect → phải chạy runtime, không prerender static.
export const dynamic = "force-dynamic"

export const metadata = {
  title: "Cài đặt hệ thống",
  robots: { index: false, follow: false },
}

export default async function SetupPage() {
  // Nếu đã setup → không được vào lại trang này.
  const completed = await isSetupComplete()
  if (completed) {
    redirect("/authentication/login")
  }

  return <SetupWizardClient />
}
