import mongoose from "mongoose"
import { Category } from "@/models/product.model"
import { Product } from "@/models/product.model"
import { connectDB } from "@/lib/db"

const categories = [
  { name: "Php Script", slug: "php-script" },
  { name: "Html - Css - JS", slug: "html-css-js" },
  { name: "Web Designs", slug: "web-designs" },
  { name: "Code shop Game", slug: "code-shop-game" },
  { name: "React - NextJS", slug: "react-nextjs" },
]

const products = [
  {
    title: "Mã nguồn bán domain, tạo web, tạo logo, bán code, cronjob nạp tiền tự động",
    slug: "ma-nguon-ban-domain-tao-web-logo-code-cronjob",
    description: "Hệ thống quản lý bán domain, tạo website, tạo logo, bán mã nguồn và cronjob nạp tiền tự động hoàn chỉnh.",
    price: 100000,
    salePrice: null,
    discountPercentage: null,
    thumbnail: "https://nelo.vnhost.vn/upload/thumbnails/c349f3e9eb5ac3f6c9611940f2bdeb0d.jpg",
    fileUrl: "/files/source-1.zip",
    tags: ["React", "PHP", "JavaScript"],
    salesCount: 1,
    categorySlug: "react-nextjs",
    isFree: false,
  },
  {
    title: "[SHOPCLONE7] Phiên Bản 5.7.1 Thiết kế website bán nguyên liệu ADS tự động",
    slug: "shopclone7-thiet-ke-website-ban-nguyen-lieu-ads",
    description: "Website bán nguyên liệu quảng cáo tự động, tích hợp thanh toán và quản lý kho hàng.",
    price: 350000,
    salePrice: null,
    discountPercentage: null,
    thumbnail: "https://nelo.vnhost.vn/upload/thumbnails/05ebb0f06b4b5b5786c1d60d4744bcaf.png",
    fileUrl: "/files/source-2.zip",
    tags: ["Php Script"],
    salesCount: 0,
    categorySlug: "php-script",
    isFree: false,
  },
  {
    title: "[SHOPCLONE6 Version 7.9.7] Website bán clone, nguyên liệu ads, mail, via, chat gpt",
    slug: "shopclone6-website-ban-clone-nguyen-lieu-ads",
    description: "Thiết kế website bán clone, web bán nguyên liệu ads, mail, via, chat gpt đầy đủ tính năng.",
    price: 200000,
    salePrice: 150000,
    discountPercentage: 25,
    thumbnail: "https://nelo.vnhost.vn/upload/thumbnails/6df3bc9ec62a696fd7f8821635dbfb67.png",
    fileUrl: "/files/source-3.zip",
    tags: ["Php Script"],
    salesCount: 13,
    categorySlug: "php-script",
    isFree: false,
  },
  {
    title: "Website bán acc game đa dạng - Full chức năng thanh toán tự động",
    slug: "website-ban-acc-game-da-dang",
    description: "Code bán acc game đa dạng với hệ thống thanh toán tự động qua ngân hàng.",
    price: 500000,
    salePrice: 400000,
    discountPercentage: 20,
    thumbnail: "https://nelo.vnhost.vn/upload/thumbnails/c349f3e9eb5ac3f6c9611940f2bdeb0d.jpg",
    fileUrl: "/files/source-4.zip",
    tags: ["Php Script", "JavaScript"],
    salesCount: 8,
    categorySlug: "code-shop-game",
    isFree: false,
  },
  {
    title: "Landing Page dịch vụ SEO - Thiết kế hiện đại responsive",
    slug: "landing-page-dich-vu-seo",
    description: "Template landing page cho dịch vụ SEO, thiết kế hiện đại, responsive hoàn hảo.",
    price: 50000,
    salePrice: null,
    discountPercentage: null,
    thumbnail: "https://nelo.vnhost.vn/upload/thumbnails/05ebb0f06b4b5b5786c1d60d4744bcaf.png",
    fileUrl: "/files/source-5.zip",
    tags: ["Html - Css - JS"],
    salesCount: 5,
    categorySlug: "html-css-js",
    isFree: false,
  },
  {
    title: "Template Dashboard Admin - Dark Mode + Light Mode",
    slug: "template-dashboard-admin-dark-light",
    description: "Template admin dashboard với dark/light mode, charts, tables, forms đầy đủ components.",
    price: 0,
    salePrice: null,
    discountPercentage: null,
    thumbnail: "https://nelo.vnhost.vn/upload/thumbnails/6df3bc9ec62a696fd7f8821635dbfb67.png",
    fileUrl: "/files/source-6.zip",
    tags: ["React", "Html - Css - JS"],
    salesCount: 22,
    categorySlug: "web-designs",
    isFree: true,
  },
  {
    title: "Web cá cược Hit.club - Full source code + database",
    slug: "web-ca-cuoc-hit-club-full-source",
    description: "Source code website game bài Hit.club đầy đủ frontend + backend + database.",
    price: 7000000,
    salePrice: 5500000,
    discountPercentage: 21,
    thumbnail: "https://nelo.vnhost.vn/upload/thumbnails/c349f3e9eb5ac3f6c9611940f2bdeb0d.jpg",
    fileUrl: "/files/source-7.zip",
    tags: ["Php Script", "JavaScript"],
    salesCount: 3,
    categorySlug: "code-shop-game",
    isFree: false,
  },
  {
    title: "Source code Go88 - Java nguồn mở",
    slug: "source-code-go88-java",
    description: "Mã nguồn Java website game Go88 hoàn chỉnh.",
    price: 14000000,
    salePrice: null,
    discountPercentage: null,
    thumbnail: "https://nelo.vnhost.vn/upload/thumbnails/05ebb0f06b4b5b5786c1d60d4744bcaf.png",
    fileUrl: "/files/source-8.zip",
    tags: ["Java", "JavaScript"],
    salesCount: 1,
    categorySlug: "code-shop-game",
    isFree: false,
  },
  {
    title: "Website Fake Bill CK - Full hình như ảnh demo",
    slug: "website-fake-bill-ck",
    description: "Tạo Bill CK Fake cccd Full hình như ảnh demo.",
    price: 5400000,
    salePrice: 4000000,
    discountPercentage: 26,
    thumbnail: "https://nelo.vnhost.vn/upload/thumbnails/6df3bc9ec62a696fd7f8821635dbfb67.png",
    fileUrl: "/files/source-9.zip",
    tags: ["Php Script"],
    salesCount: 2,
    categorySlug: "php-script",
    isFree: false,
  },
  {
    title: "Web Dịch Vụ MXH - Tự động cập nhật API SMM Panel",
    slug: "web-dich-vu-mxh-smm-panel",
    description: "Tự động cập nhật giá máy chủ trình, web dịch vụ MXH SMM Panel hoàn chỉnh.",
    price: 3500000,
    salePrice: null,
    discountPercentage: null,
    thumbnail: "https://nelo.vnhost.vn/upload/thumbnails/c349f3e9eb5ac3f6c9611940f2bdeb0d.jpg",
    fileUrl: "/files/source-10.zip",
    tags: ["React", "Php Script"],
    salesCount: 6,
    categorySlug: "react-nextjs",
    isFree: false,
  },
  {
    title: "Code Sub Dạng Mới - Full HD như ảnh live demo",
    slug: "code-sub-dang-moi-full-hd",
    description: "Full HD như ảnh live demo subxh.com, code sub dạng mới nhất.",
    price: 4590000,
    salePrice: 3500000,
    discountPercentage: 24,
    thumbnail: "https://nelo.vnhost.vn/upload/thumbnails/05ebb0f06b4b5b5786c1d60d4744bcaf.png",
    fileUrl: "/files/source-11.zip",
    tags: ["Php Script", "JavaScript"],
    salesCount: 4,
    categorySlug: "php-script",
    isFree: false,
  },
  {
    title: "Portfolio Website - NextJS + Tailwind CSS Modern Design",
    slug: "portfolio-website-nextjs-tailwind",
    description: "Template portfolio cá nhân với NextJS và Tailwind CSS, animation mượt mà.",
    price: 80000,
    salePrice: null,
    discountPercentage: null,
    thumbnail: "https://nelo.vnhost.vn/upload/thumbnails/6df3bc9ec62a696fd7f8821635dbfb67.png",
    fileUrl: "/files/source-12.zip",
    tags: ["React", "Html - Css - JS"],
    salesCount: 15,
    categorySlug: "web-designs",
    isFree: false,
  },
]

export async function seedProducts() {
  await connectDB()

  // Clear existing
  await Category.deleteMany({})
  await Product.deleteMany({})

  // Seed categories
  const categoryDocs = await Category.insertMany(
    categories.map((c) => ({
      name: c.name,
      slug: c.slug,
      status: 1,
      thumbnail: null,
    }))
  )

  // Map slug -> ObjectId
  const categoryMap = new Map<string, mongoose.Types.ObjectId>()
  for (const doc of categoryDocs) {
    categoryMap.set(doc.slug, doc._id as mongoose.Types.ObjectId)
  }

  // Seed products
  await Product.insertMany(
    products.map((p) => ({
      title: p.title,
      slug: p.slug,
      description: p.description,
      detail: null,
      price: p.price,
      salePrice: p.salePrice,
      discountPercentage: p.discountPercentage,
      categoryId: categoryMap.get(p.categorySlug),
      sellerId: null,
      thumbnail: p.thumbnail,
      fileUrl: p.fileUrl,
      status: 1,
      isFree: p.isFree,
      salesCount: p.salesCount,
      view: Math.floor(Math.random() * 500),
      approved: true,
      tags: p.tags,
    }))
  )

  console.log(`✅ Seeded ${categoryDocs.length} categories and ${products.length} products`)
}
