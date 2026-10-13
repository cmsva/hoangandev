import mongoose, { Schema, type Document } from "mongoose"
import { registerModel } from "@/lib/register-model"

// ============================================================
// Setting — Site options / config (collection: settings)
// ============================================================
export interface ISetting extends Document {
  key: string
  value: string
}

const settingSchema = new Schema<ISetting>(
  {
    key: { type: String, required: true, unique: true },
    value: { type: String, default: "" },
  },
  { timestamps: false, versionKey: false, collection: "settings" }
)


export const Setting = registerModel<ISetting>("Setting", settingSchema)

// ─── Helpers ───────────────────────────────────────────────────────────────

export async function getSiteOption(key: string): Promise<string> {
  const doc = await Setting.findOne({ key }).lean<{ value: string } | null>()
  return doc?.value ?? ""
}

export async function getSiteOptions(keys: string[]): Promise<Record<string, string>> {
  const docs = await Setting.find({ key: { $in: keys } }).lean<Array<{ key: string; value: string }>>()
  const map: Record<string, string> = {}
  for (const k of keys) map[k] = ""
  for (const doc of docs) map[doc.key] = doc.value
  return map
}

export async function getSiteOptionInt(key: string, defaultVal = 0): Promise<number> {
  const val = await getSiteOption(key)
  const n = parseInt(val, 10)
  return isNaN(n) ? defaultVal : n
}

/** Upsert 1 setting key. */
export async function setSiteOption(key: string, value: string): Promise<void> {
  await Setting.updateOne(
    { key },
    { $set: { key, value } },
    { upsert: true }
  )
}

/** Upsert nhiều setting keys cùng lúc (bulk). */
export async function setSiteOptions(entries: Record<string, string>): Promise<void> {
  const ops = Object.entries(entries).map(([key, value]) => ({
    updateOne: {
      filter: { key },
      update: { $set: { key, value } },
      upsert: true,
    },
  }))
  if (ops.length === 0) return
  await Setting.bulkWrite(ops)
}
