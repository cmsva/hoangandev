import { Suspense } from "react"
import { getPageSeo } from "@/lib/seo-config"
import { ResetPasswordForm } from "./ResetPasswordForm"

export const generateMetadata = () => getPageSeo("auth-reset-password")

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted/40" />}>
      <ResetPasswordForm />
    </Suspense>
  )
}
