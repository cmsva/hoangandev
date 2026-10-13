import { getPageSeo } from "@/lib/seo-config"
import { LoginForm } from "./LoginForm"

export const generateMetadata = () => getPageSeo("auth-login")

export default function LoginPage() {
  return <LoginForm />
}
