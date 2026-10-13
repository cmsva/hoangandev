/**
 * Cleanup script: drop tất cả OrderService cũ vì schema đã đổi (rename
 * shopAccount→shopAccountEnc, thêm serviceName/serviceImage/...).
 *
 * Run: npx tsx scripts/drop-old-service-orders.ts
 */
import "dotenv/config"
import mongoose from "mongoose"

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error("MONGODB_URI not set")
    process.exit(1)
  }
  await mongoose.connect(uri)
  const db = mongoose.connection.db!
  const result = await db.collection("orderservices").deleteMany({})
  console.log(`Deleted ${result.deletedCount} old order service docs`)
  await mongoose.disconnect()
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
