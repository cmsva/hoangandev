/**
 * AI Assistant config — singleton document (1 record duy nhất).
 *
 * `apiKey` lưu encrypt qua `encryptValue()` để DB rò rỉ vẫn an toàn.
 * Ai access: chỉ admin qua tab Settings.
 */
import mongoose, { Schema } from "mongoose"

export const AI_PROVIDERS_ENUM = ["deepseek", "minimax", "grok", "groq", "gemini", "claude"] as const

export interface IAiConfig {
  enabled: boolean
  provider: string
  model: string
  apiKey: string | null // encrypted
  systemPrompt: string
  maxTokens: number
  temperature: number
  perUserPerHour: number
  perIpPerHour: number
  widgetTitle: string
  widgetGreeting: string
  widgetPosition: "right" | "left"
  allowDbContext: boolean
  createdAt?: Date
  updatedAt?: Date
}

const aiConfigSchema = new Schema<IAiConfig>(
  {
    enabled: { type: Boolean, default: false },
    provider: { type: String, enum: AI_PROVIDERS_ENUM, default: "gemini" },
    model: { type: String, default: "gemini-2.5-flash" },
    apiKey: { type: String, default: null },
    systemPrompt: { type: String, default: "" },
    maxTokens: { type: Number, default: 1024, min: 64, max: 8192 },
    temperature: { type: Number, default: 0.4, min: 0, max: 2 },
    perUserPerHour: { type: Number, default: 30, min: 1, max: 1000 },
    perIpPerHour: { type: Number, default: 20, min: 1, max: 1000 },
    widgetTitle: { type: String, default: "Trợ lý AI" },
    widgetGreeting: {
      type: String,
      default: "Xin chào! Mình có thể giúp bạn tìm dịch vụ web phù hợp. Bạn cần tư vấn gì?",
    },
    widgetPosition: { type: String, enum: ["right", "left"], default: "right" },
    allowDbContext: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false }
)

export const AiConfig =
  (mongoose.models.AiConfig as mongoose.Model<IAiConfig>) ||
  mongoose.model<IAiConfig>("AiConfig", aiConfigSchema)
