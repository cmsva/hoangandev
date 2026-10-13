import type { MetadataRoute } from "next"
import { connectDB } from "@/lib/db"
import mongoose from "mongoose"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://vankhanh.dev"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${BASE_URL}/source-code`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/create-website`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/create-logo`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/domain`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/blogs`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
  ]

  try {
    await connectDB()

    // Blog posts
    const Post = mongoose.models.Post
    const blogRoutes: MetadataRoute.Sitemap = []
    if (Post) {
      const posts = await Post.find({ status: 1 })
        .select("slug updatedAt")
        .lean()
        .limit(500)
      for (const post of posts) {
        blogRoutes.push({
          url: `${BASE_URL}/blogs/${(post as any).slug}`,
          lastModified: (post as any).updatedAt || new Date(),
          changeFrequency: "weekly",
          priority: 0.7,
        })
      }
    }

    // Source code products
    const Product = mongoose.models.Product
    const productRoutes: MetadataRoute.Sitemap = []
    if (Product) {
      const products = await Product.find({ status: 1 })
        .select("slug updatedAt")
        .lean()
        .limit(500)
      for (const product of products) {
        productRoutes.push({
          url: `${BASE_URL}/source-code/${(product as any).slug}`,
          lastModified: (product as any).updatedAt || new Date(),
          changeFrequency: "weekly",
          priority: 0.8,
        })
      }
    }

    // Logo catalog
    const Logo = mongoose.models.Logo
    const logoRoutes: MetadataRoute.Sitemap = []
    if (Logo) {
      const logos = await Logo.find({ status: 1 })
        .select("slug updatedAt")
        .lean()
        .limit(500)
      for (const logo of logos) {
        logoRoutes.push({
          url: `${BASE_URL}/create-logo/${(logo as any).slug}`,
          lastModified: (logo as any).updatedAt || new Date(),
          changeFrequency: "weekly",
          priority: 0.7,
        })
      }
    }

    return [...staticRoutes, ...blogRoutes, ...productRoutes, ...logoRoutes]
  } catch (err) {
    console.warn("[sitemap] DB connection not available during build:", err)
    return staticRoutes
  }
}
