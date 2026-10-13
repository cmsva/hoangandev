/**
 * Drop unique index (userId, logoId) trên LogoOrder vì giờ user có thể thuê
 * cùng 1 logo nhiều lần.
 *
 * Usage: npx tsx scripts/drop-logo-order-unique.ts
 */
import "dotenv/config"
import mongoose from "mongoose"
import { LogoOrder } from "@/models/logo.model"

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error("MONGODB_URI not set")
    process.exit(1)
  }
  await mongoose.connect(uri)

  const indexes = await LogoOrder.collection.indexes()
  console.log("Current indexes:", indexes.map((i) => i.name))

  // Tìm unique index trên (userId, logoId) — name có thể là "userId_1_logoId_1"
  const target = indexes.find(
    (idx) =>
      idx.unique === true &&
      idx.key &&
      idx.key.userId === 1 &&
      idx.key.logoId === 1
  )

  if (!target) {
    console.log("✓ No unique (userId, logoId) index found — already migrated")
  } else {
    console.log(`Dropping ${target.name}...`)
    await LogoOrder.collection.dropIndex(target.name as string)
    console.log("✓ Dropped")
  }

  // Đảm bảo các index mới (non-unique) tồn tại
  await LogoOrder.syncIndexes()
  console.log("✓ Indexes synced")

  await mongoose.disconnect()
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
