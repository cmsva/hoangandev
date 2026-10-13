import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://vankhanh.dev"
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/adminPanel/", "/api/", "/cmstdev/", "/customer/", "/ticket/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
