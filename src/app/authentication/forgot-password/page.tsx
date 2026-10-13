import { getPageSeo } from "@/lib/seo-config"
import { ForgotPasswordForm } from "./ForgotPasswordForm"

export const generateMetadata = () => getPageSeo("auth-forgot-password")

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />
}
