/**
 * Seed Sample Data — chạy 1 lần để khởi tạo data demo cho settings, banks,
 * telcos, promotions.
 *
 * Chạy: `npx tsx src/scripts/seed-sample-data.ts`
 *
 * AN TOÀN: dùng upsert nên không xoá data cũ.
 */
import "dotenv/config"
import { connectDB } from "@/lib/db"
import { Setting } from "@/models/setting.model"
import { Bank } from "@/models/bank.model"
import { Telco } from "@/models/telco.model"
import { Promotion } from "@/models/promotion.model"

// ─── Settings (security + payment + announcement) ──────────────────────────
const SETTINGS: Array<{ key: string; value: string }> = [
  // Identity
  { key: "title", value: "VanKhanh Dashboard" },
  { key: "description", value: "Quản lý dịch vụ mã nguồn, website, logo, cronjob, tên miền." },
  // Security — rate limits
  { key: "rate_limit_login", value: "5" },
  { key: "rate_limit_register", value: "3" },
  { key: "rate_limit_forgot", value: "3" },
  { key: "rate_limit_purchase", value: "5000" },
  { key: "rate_limit_deposit", value: "10000" },
  { key: "login_ban_duration", value: "900000" },
  { key: "max_pending_invoices", value: "1" },
  { key: "api_key_max_attempts", value: "10" },
  // Security headers
  { key: "security_csp", value: "" },
  { key: "security_hsts", value: "1" },
  { key: "security_x_frame", value: "SAMEORIGIN" },
  { key: "security_referrer", value: "strict-origin-when-cross-origin" },
  // App toggles
  { key: "register_enabled", value: "1" },
  { key: "maintenance_mode", value: "0" },
  // Captcha (default tắt — admin tự set provider + keys)
  { key: "captcha_provider", value: "none" },
  { key: "captcha_site_key", value: "" },
  { key: "captcha_secret_key", value: "" },
  { key: "captcha_functions", value: "" },
  // Payment — bank
  { key: "bank_min", value: "10000" },
  { key: "bank_max", value: "10000000" },
  { key: "time_invoices", value: "86400" },
  { key: "prefix_autobank", value: "VK" },
  { key: "range_random", value: "8" },
  { key: "type_random", value: "0" },
  // Payment — card
  { key: "card_status", value: "1" },
  { key: "card_ck", value: "0" },
  { key: "card_notice", value: "Vui lòng nhập đúng mệnh giá thẻ. Nhập sai mệnh giá sẽ bị trừ phí phạt." },
  { key: "card_partner_id", value: "" },
  { key: "card_partner_key", value: "" },
  { key: "card_url_api", value: "" },
  // Announcement
  { key: "announcement_enabled", value: "0" },
  { key: "announcement_title", value: "Chào mừng" },
  { key: "announcement_content", value: "Chào mừng bạn đến với VanKhanh!" },
]

// ─── Banks (sample) ─────────────────────────────────────────────────────────
const BANKS = [
  { shortName: "MBBank", accountNumber: "0123456789", accountName: "NGUYEN VAN A", status: 1 },
  { shortName: "Vietcombank", accountNumber: "1234567890", accountName: "NGUYEN VAN A", status: 1 },
  { shortName: "ACB", accountNumber: "2345678901", accountName: "NGUYEN VAN A", status: 1 },
  { shortName: "Techcombank", accountNumber: "3456789012", accountName: "NGUYEN VAN A", status: 1 },
]

// ─── Telcos (sample) ────────────────────────────────────────────────────────
const TELCOS: Array<{ telco: string; img: string; value: number; fees: number; penalty: number }> = [
  // VIETTEL
  { telco: "VIETTEL", img: "/telco/viettel.svg", value: 10000, fees: 25, penalty: 50 },
  { telco: "VIETTEL", img: "/telco/viettel.svg", value: 20000, fees: 25, penalty: 50 },
  { telco: "VIETTEL", img: "/telco/viettel.svg", value: 50000, fees: 25, penalty: 50 },
  { telco: "VIETTEL", img: "/telco/viettel.svg", value: 100000, fees: 25, penalty: 50 },
  { telco: "VIETTEL", img: "/telco/viettel.svg", value: 200000, fees: 25, penalty: 50 },
  { telco: "VIETTEL", img: "/telco/viettel.svg", value: 500000, fees: 25, penalty: 50 },
  // MOBIFONE
  { telco: "MOBIFONE", img: "/telco/mobifone.svg", value: 10000, fees: 27, penalty: 50 },
  { telco: "MOBIFONE", img: "/telco/mobifone.svg", value: 20000, fees: 27, penalty: 50 },
  { telco: "MOBIFONE", img: "/telco/mobifone.svg", value: 50000, fees: 27, penalty: 50 },
  { telco: "MOBIFONE", img: "/telco/mobifone.svg", value: 100000, fees: 27, penalty: 50 },
  { telco: "MOBIFONE", img: "/telco/mobifone.svg", value: 200000, fees: 27, penalty: 50 },
  { telco: "MOBIFONE", img: "/telco/mobifone.svg", value: 500000, fees: 27, penalty: 50 },
  // VINAPHONE
  { telco: "VINAPHONE", img: "/telco/vinaphone.svg", value: 10000, fees: 28, penalty: 50 },
  { telco: "VINAPHONE", img: "/telco/vinaphone.svg", value: 20000, fees: 28, penalty: 50 },
  { telco: "VINAPHONE", img: "/telco/vinaphone.svg", value: 50000, fees: 28, penalty: 50 },
  { telco: "VINAPHONE", img: "/telco/vinaphone.svg", value: 100000, fees: 28, penalty: 50 },
  { telco: "VINAPHONE", img: "/telco/vinaphone.svg", value: 200000, fees: 28, penalty: 50 },
  { telco: "VINAPHONE", img: "/telco/vinaphone.svg", value: 500000, fees: 28, penalty: 50 },
]

// ─── Promotions (bonus tiers) ──────────────────────────────────────────────
const PROMOTIONS = [
  { amount: 100000, discount: 2 },
  { amount: 500000, discount: 5 },
  { amount: 1000000, discount: 8 },
  { amount: 5000000, discount: 12 },
]

async function seed() {
  console.log("→ Connecting DB...")
  await connectDB()

  console.log("→ Seeding settings...")
  for (const s of SETTINGS) {
    await Setting.updateOne({ key: s.key }, { $set: s }, { upsert: true })
  }
  console.log(`  ✓ ${SETTINGS.length} settings`)

  console.log("→ Seeding banks...")
  for (const b of BANKS) {
    await Bank.updateOne({ shortName: b.shortName }, { $set: b }, { upsert: true })
  }
  console.log(`  ✓ ${BANKS.length} banks`)

  console.log("→ Seeding telcos...")
  for (const t of TELCOS) {
    await Telco.updateOne({ telco: t.telco, value: t.value }, { $set: t }, { upsert: true })
  }
  console.log(`  ✓ ${TELCOS.length} telcos`)

  console.log("→ Seeding promotions...")
  for (const p of PROMOTIONS) {
    await Promotion.updateOne({ amount: p.amount }, { $set: p }, { upsert: true })
  }
  console.log(`  ✓ ${PROMOTIONS.length} promotions`)

  console.log("✅ Done. Exiting...")
  process.exit(0)
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err)
  process.exit(1)
})
