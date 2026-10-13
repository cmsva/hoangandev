/**
 * Backfill `nextRunAt` cho các cronjob đang active mà chưa có nextRunAt.
 * Chạy 1 lần sau khi deploy version mới có cron engine production.
 *
 * Usage: npx tsx scripts/backfill-cron-next-run.ts
 */
import "dotenv/config"
import mongoose from "mongoose"
import { Cronjob } from "@/models/cronjob.model"

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error("MONGODB_URI not set")
    process.exit(1)
  }
  await mongoose.connect(uri)

  // Set nextRunAt = now cho các active jobs chưa có nextRunAt
  const activeRes = await Cronjob.updateMany(
    { status: "active", nextRunAt: { $exists: false } },
    { $set: { nextRunAt: new Date() } }
  )
  console.log(`✓ Active jobs backfilled: ${activeRes.modifiedCount}`)

  // Set null cho paused/expired
  const inactiveRes = await Cronjob.updateMany(
    { status: { $in: ["paused", "expired"] }, nextRunAt: { $exists: false } },
    { $set: { nextRunAt: null } }
  )
  console.log(`✓ Inactive jobs reset: ${inactiveRes.modifiedCount}`)

  await mongoose.disconnect()
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
