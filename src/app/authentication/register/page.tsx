import { getPageSeo } from "@/lib/seo-config"
import { RegisterForm } from "./RegisterForm"

export const generateMetadata = () => getPageSeo("auth-register")

export default function RegisterPage() {
  return <RegisterForm />
}
