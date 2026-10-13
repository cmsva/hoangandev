/**
 * Seed dữ liệu mẫu cho Logo marketplace.
 * Chạy: `npx tsx scripts/seed-logos.ts`
 *
 * Idempotent: nếu category/logo đã tồn tại theo slug thì skip.
 */
import "dotenv/config"
import mongoose from "mongoose"
import { CategoryLogo, Logo } from "@/models/logo.model"

const CATEGORIES = [
  { name: "Tạo logo Digital Marketing", slug: "tao-logo-digital-marketing" },
  { name: "Tạo logo Shop Game", slug: "tao-logo-shop-game" },
  { name: "Tạo logo Like Sub", slug: "tao-logo-like-sub" },
  { name: "Tạo logo Cá nhân", slug: "tao-logo-ca-nhan" },
  { name: "Tạo logo Doanh nghiệp", slug: "tao-logo-doanh-nghiep" },
]

const LOGOS = [
  {
    stt: 1,
    title: "Logo Digital Marketing Pro",
    slug: "logo-digital-marketing-pro",
    image: "/upload/logo/sample-1.png",
    categorySlug: "tao-logo-digital-marketing",
    content:
      "<p>Bộ logo chuyên nghiệp dành cho agency Digital Marketing — bao gồm 5 biến thể, file PSD/AI gốc, hướng dẫn brand guideline.</p>",
    price: 250_000,
  },
  {
    stt: 2,
    title: "Logo Shop Game Liên Quân",
    slug: "logo-shop-game-lien-quan",
    image: "/upload/logo/sample-2.png",
    categorySlug: "tao-logo-shop-game",
    content:
      "<p>Logo shop game phong cách esport — mascot rồng, gradient neon. Bao gồm phiên bản dùng cho avatar, banner Facebook, watermark.</p>",
    price: 180_000,
  },
  {
    stt: 3,
    title: "Logo Like Sub YouTuber",
    slug: "logo-like-sub-youtuber",
    image: "/upload/logo/sample-3.png",
    categorySlug: "tao-logo-like-sub",
    content:
      "<p>Logo dạng pixel-perfect cho YouTuber dịch vụ like-sub. File chuẩn 1024×1024 + biến thể vuông/tròn.</p>",
    price: 80_000,
  },
  {
    stt: 4,
    title: "Logo Personal Brand Minimalist",
    slug: "logo-personal-brand-minimalist",
    image: "/upload/logo/sample-4.png",
    categorySlug: "tao-logo-ca-nhan",
    content:
      "<p>Logo cá nhân tối giản, dùng được trong CV, profile mạng xã hội, namecard. Có sẵn 3 màu sắc khác nhau.</p>",
    price: 120_000,
  },
  {
    stt: 5,
    title: "Logo Startup Doanh Nghiệp",
    slug: "logo-startup-doanh-nghiep",
    image: "/upload/logo/sample-5.png",
    categorySlug: "tao-logo-doanh-nghiep",
    content:
      "<p>Logo cho startup, công ty SaaS — phong cách corporate hiện đại. Bao gồm trọn bộ favicon, social media kit, brand color.</p>",
    price: 350_000,
  },
  {
    stt: 6,
    title: "Logo Free Demo",
    slug: "logo-free-demo",
    image: "/upload/logo/sample-6.png",
    categorySlug: "tao-logo-ca-nhan",
    content: "<p>Logo demo miễn phí để khách hàng trải nghiệm dịch vụ.</p>",
    price: 0,
  },
]

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error("MONGODB_URI not set")
    process.exit(1)
  }

  await mongoose.connect(uri)

  // 1. Categories
  const catMap = new Map<string, mongoose.Types.ObjectId>()
  let createdCats = 0
  let skippedCats = 0
  for (const c of CATEGORIES) {
    const existing = (await CategoryLogo.findOne({ slug: c.slug }).select("_id").lean()) as any
    if (existing) {
      catMap.set(c.slug, existing._id)
      skippedCats++
      continue
    }
    const created = (await CategoryLogo.create(c)) as any
    catMap.set(c.slug, created._id)
    createdCats++
  }
  console.log(`✓ Categories — created ${createdCats}, skipped ${skippedCats}`)

  // 2. Logos
  let createdLogos = 0
  let skippedLogos = 0
  for (const l of LOGOS) {
    const exists = await Logo.findOne({ slug: l.slug }).select("_id").lean()
    if (exists) {
      skippedLogos++
      continue
    }
    const categoryId = catMap.get(l.categorySlug)
    if (!categoryId) {
      console.warn(`⚠ Skipping ${l.slug} — category ${l.categorySlug} not found`)
      continue
    }
    await Logo.create({
      stt: l.stt,
      title: l.title,
      slug: l.slug,
      image: l.image,
      categoryId,
      content: l.content,
      price: l.price,
      status: 1,
      // download — admin sẽ thêm sau khi upload file thực
    })
    createdLogos++
  }
  console.log(`✓ Logos — created ${createdLogos}, skipped ${skippedLogos}`)

  await mongoose.disconnect()
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
