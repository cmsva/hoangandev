/**
 * Seed ServerCronjob — chạy: npx tsx scripts/seed-cronjob-servers.ts
 */
import "dotenv/config"
import mongoose from "mongoose"
import { ServerCronjob } from "../src/models/cronjob.model"

const SERVERS = [
  {
    name: "Server SG-1 (Singapore)",
    price: 10_000,
    usageLimit: 200,
    timeloop: 30,
    discountPercent: 10,
    discountValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  },
  {
    name: "Server VN-1 (Hà Nội)",
    price: 8_000,
    usageLimit: 150,
    timeloop: 60,
    discountPercent: 0,
  },
  {
    name: "Server VN-2 (TP. HCM)",
    price: 8_000,
    usageLimit: 150,
    timeloop: 60,
    discountPercent: 5,
    discountValidUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  },
  {
    name: "Server US-1 (New York)",
    price: 15_000,
    usageLimit: 100,
    timeloop: 30,
    discountPercent: 0,
  },
  {
    name: "Server EU-1 (Frankfurt)",
    price: 15_000,
    usageLimit: 100,
    timeloop: 30,
    discountPercent: 0,
  },
]

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error("MONGODB_URI not set")

  await mongoose.connect(uri)
  let created = 0
  let updated = 0
  let skipped = 0
  for (const s of SERVERS) {
    const existing = await ServerCronjob.findOne({ name: s.name })
    if (existing) {
      // Backfill timeloop nếu thiếu
      if ((existing as any).timeloop == null) {
        await ServerCronjob.updateOne({ _id: existing._id }, { $set: { timeloop: s.timeloop } })
        updated++
      } else {
        skipped++
      }
      continue
    }
    await ServerCronjob.create(s)
    created++
  }
  console.log(`✓ Created ${created}, updated ${updated}, skipped ${skipped}.`)
  await mongoose.disconnect()
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
