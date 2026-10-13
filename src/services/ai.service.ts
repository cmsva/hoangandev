/**
 * AI service — protocol-agnostic business logic cho widget chat + admin config.
 *
 * Trách nhiệm:
 *   - getConfig / saveConfig (admin)
 *   - getPublicConfig (client widget — không lộ key)
 *   - testConnection (admin)
 *   - chat (user) — rate limit, anti-injection, context, gọi provider
 *
 * Hardening (2026-05-30):
 *   - loadFullConfig: findOneAndUpdate upsert atomic, không race.
 *   - Anti-injection scan TẤT CẢ history items (client fake role được).
 *   - Check `enabled` TRƯỚC rate limit để không tốn quota khi AI tắt.
 *   - Mask API key trong error message từ provider trước khi log/throw.
 *   - Cache config 5s qua Redis → mỗi chat không hammer DB.
 *   - Wrap encryption với try/catch trả error message rõ ràng.
 */
import { TRPCError } from "@trpc/server"
import { connectDB } from "@/lib/db"
import { AiConfig, AI_PROVIDERS_ENUM } from "@/models/ai-config.model"
import { encryptValue, decryptValue } from "@/lib/encryption"
import { cached, invalidate } from "@/lib/cache"
import { getProviderSpec, type AiProviderId, AI_PROVIDERS } from "@/lib/ai/providers"
import { buildSystemPrompt, looksLikeInjection, REFUSAL_TEMPLATE } from "@/lib/ai/system-prompt"
import { chatWithAi, testProvider, type ChatTurn, type ChatResult } from "@/lib/ai/client"
import { getAiContextSnapshot, snapshotToMarkdown } from "@/lib/ai/context"
import { getCachedGeneralSettings } from "@/services/settings.service"
import { RateLimiterMemory } from "rate-limiter-flexible"
import { logger } from "@/lib/logger"

// ─── Rate limiters ──────────────────────────────────────────────────────
// 3 layer: user (đã login) > IP (đã login) > IP anon (chưa login).
// Anon limit chặt hơn 5x để chống drain API key bằng anonymous spam.
let userLimiter = new RateLimiterMemory({ points: 30, duration: 3600 })
let ipAuthLimiter = new RateLimiterMemory({ points: 20, duration: 3600 })
let ipAnonLimiter = new RateLimiterMemory({ points: 6, duration: 3600 })
let limiterPointsUser = 30
let limiterPointsIp = 20

function rebuildLimiters(perUserPerHour: number, perIpPerHour: number): void {
  if (perUserPerHour !== limiterPointsUser) {
    userLimiter = new RateLimiterMemory({ points: perUserPerHour, duration: 3600 })
    limiterPointsUser = perUserPerHour
  }
  if (perIpPerHour !== limiterPointsIp) {
    ipAuthLimiter = new RateLimiterMemory({ points: perIpPerHour, duration: 3600 })
    // Anon = 1/3 IP cap (min 3, max 10) — chống drain key.
    const anonPoints = Math.min(10, Math.max(3, Math.floor(perIpPerHour / 3)))
    ipAnonLimiter = new RateLimiterMemory({ points: anonPoints, duration: 3600 })
    limiterPointsIp = perIpPerHour
  }
}

const CONFIG_CACHE_KEY = "ai:config:full"
const PUBLIC_CACHE_KEY = "ai:config:public"
const CONFIG_CACHE_TTL_SEC = 5

// ─── Config CRUD ─────────────────────────────────────────────────────────

export interface AdminAiConfig {
  enabled: boolean
  provider: AiProviderId
  model: string
  hasKey: boolean
  systemPrompt: string
  maxTokens: number
  temperature: number
  perUserPerHour: number
  perIpPerHour: number
  widgetTitle: string
  widgetGreeting: string
  widgetPosition: "right" | "left"
  allowDbContext: boolean
}

interface AiConfigPlain {
  enabled: boolean
  provider: string
  model: string
  apiKey: string | null
  systemPrompt: string
  maxTokens: number
  temperature: number
  perUserPerHour: number
  perIpPerHour: number
  widgetTitle: string
  widgetGreeting: string
  widgetPosition: string
  allowDbContext: boolean
}

const DEFAULT_CONFIG: AiConfigPlain = {
  enabled: false,
  provider: "gemini",
  model: "gemini-2.5-flash",
  apiKey: null,
  systemPrompt: "",
  maxTokens: 1024,
  temperature: 0.4,
  perUserPerHour: 30,
  perIpPerHour: 20,
  widgetTitle: "Trợ lý AI",
  widgetGreeting: "Xin chào!",
  widgetPosition: "right",
  allowDbContext: true,
}

/**
 * Load config — atomic upsert tránh race condition khi 2 request cùng tạo.
 * Cache Redis 5s, các call sau đi thẳng RAM (không DB hit).
 */
async function loadFullConfig(): Promise<AiConfigPlain> {
  return await cached(CONFIG_CACHE_KEY, CONFIG_CACHE_TTL_SEC, async () => {
    await connectDB()
    // findOneAndUpdate({}, {$setOnInsert: defaults}, {upsert, new}) là atomic.
    const cfg = await AiConfig.findOneAndUpdate(
      {},
      { $setOnInsert: DEFAULT_CONFIG },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean<AiConfigPlain | null>()
    return cfg ?? DEFAULT_CONFIG
  })
}

export async function getAiConfigForAdmin(): Promise<AdminAiConfig> {
  const cfg = await loadFullConfig()
  return {
    enabled: cfg.enabled,
    provider: cfg.provider as AiProviderId,
    model: cfg.model,
    hasKey: !!cfg.apiKey,
    systemPrompt: cfg.systemPrompt || "",
    maxTokens: cfg.maxTokens,
    temperature: cfg.temperature,
    perUserPerHour: cfg.perUserPerHour,
    perIpPerHour: cfg.perIpPerHour,
    widgetTitle: cfg.widgetTitle,
    widgetGreeting: cfg.widgetGreeting,
    widgetPosition: cfg.widgetPosition as "right" | "left",
    allowDbContext: cfg.allowDbContext,
  }
}

export interface SaveAiConfigInput {
  enabled: boolean
  provider: AiProviderId
  model: string
  apiKey?: string | null // null = giữ nguyên, "" = clear, "..." = đổi key mới
  systemPrompt: string
  maxTokens: number
  temperature: number
  perUserPerHour: number
  perIpPerHour: number
  widgetTitle: string
  widgetGreeting: string
  widgetPosition: "right" | "left"
  allowDbContext: boolean
}

export async function saveAiConfig(input: SaveAiConfigInput): Promise<void> {
  if (!AI_PROVIDERS_ENUM.includes(input.provider)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Provider không hợp lệ" })
  }
  if (!getProviderSpec(input.provider)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Provider chưa được hỗ trợ" })
  }
  if (!input.model.trim()) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Model không hợp lệ" })
  }

  await connectDB()
  const update: Record<string, unknown> = {
    enabled: input.enabled,
    provider: input.provider,
    model: input.model.trim(),
    systemPrompt: input.systemPrompt.slice(0, 4_000),
    maxTokens: Math.min(8192, Math.max(64, input.maxTokens)),
    temperature: Math.min(2, Math.max(0, input.temperature)),
    perUserPerHour: Math.min(1000, Math.max(1, input.perUserPerHour)),
    perIpPerHour: Math.min(1000, Math.max(1, input.perIpPerHour)),
    widgetTitle: input.widgetTitle.slice(0, 80),
    widgetGreeting: input.widgetGreeting.slice(0, 500),
    widgetPosition: input.widgetPosition,
    allowDbContext: input.allowDbContext,
  }

  if (input.apiKey === "") {
    update.apiKey = null
  } else if (typeof input.apiKey === "string" && input.apiKey.length > 0) {
    try {
      update.apiKey = encryptValue(input.apiKey.trim())
    } catch (err) {
      logger.error("encryption failed", { module: "ai", error: (err as Error).message })
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Server chưa cấu hình ENCRYPTION_KEY (32 bytes hex). Liên hệ DevOps.",
      })
    }
  }

  await AiConfig.updateOne({}, { $set: update }, { upsert: true })
  // Invalidate cả 2 cache key (full + public) để client widget pick-up ngay.
  await Promise.all([invalidate(CONFIG_CACHE_KEY), invalidate(PUBLIC_CACHE_KEY)])
}

// ─── Public config (cho widget client) ────────────────────────────────────

export interface PublicAiConfig {
  enabled: boolean
  widgetTitle: string
  widgetGreeting: string
  widgetPosition: "right" | "left"
}

export async function getPublicAiConfig(): Promise<PublicAiConfig> {
  return await cached(PUBLIC_CACHE_KEY, 30, async () => {
    const cfg = await loadFullConfig()
    return {
      // Widget chỉ "enabled" khi cả admin bật + có key (không có key = vô nghĩa).
      enabled: cfg.enabled && !!cfg.apiKey,
      widgetTitle: cfg.widgetTitle,
      widgetGreeting: cfg.widgetGreeting,
      widgetPosition: cfg.widgetPosition as "right" | "left",
    }
  })
}

// ─── Test connection ──────────────────────────────────────────────────────

export async function testAiConnection(input: {
  provider: AiProviderId
  model: string
  apiKey?: string
}): Promise<ChatResult> {
  let key = input.apiKey?.trim() || ""
  if (!key) {
    const cfg = await loadFullConfig()
    if (cfg.provider !== input.provider) {
      return { ok: false, error: "Provider khác với key đã lưu — nhập key mới để test" }
    }
    try {
      key = decryptValue(cfg.apiKey) || ""
    } catch {
      key = ""
    }
  }
  if (!key) return { ok: false, error: "Chưa có API key" }

  const result = await testProvider(input.provider, input.model, key)
  // Mask key có thể leak trong error.
  return maskKeyInResult(result, key)
}

// ─── Chat handler ─────────────────────────────────────────────────────────

export interface ChatInput {
  userId: string | null
  ip: string
  history: ChatTurn[]
  message: string
}

export interface ChatOutput {
  reply: string
  refused?: boolean
}

export async function handleAiChat(input: ChatInput): Promise<ChatOutput> {
  // 1. Load config FIRST — tránh tốn rate limit khi AI tắt hoặc thiếu key.
  const cfg = await loadFullConfig()
  if (!cfg.enabled) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Trợ lý AI đang tắt" })
  }

  // 2. Sync rate-limit points theo config nếu admin vừa đổi.
  rebuildLimiters(cfg.perUserPerHour, cfg.perIpPerHour)

  // 3. Rate limit theo tier:
  //  - User đã login → user limit + IP auth limit
  //  - User anon → chỉ IP anon limit (chặt hơn 3-5x)
  if (input.userId) {
    try {
      await userLimiter.consume(input.userId)
    } catch {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Bạn đã hỏi quá nhiều. Vui lòng đợi 1 lúc.",
      })
    }
    if (input.ip && input.ip !== "unknown") {
      try {
        await ipAuthLimiter.consume(input.ip)
      } catch {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Tạm thời quá tải, thử lại sau.",
        })
      }
    }
  } else if (input.ip && input.ip !== "unknown") {
    try {
      await ipAnonLimiter.consume(input.ip)
    } catch {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Đăng nhập để được hỗ trợ nhiều hơn. Đã đạt giới hạn cho người dùng chưa đăng nhập.",
      })
    }
  } else {
    // Không userId, không IP → reject (không track được → nguy hiểm).
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Không xác định được IP. Thử lại sau.",
    })
  }

  // 4. Validate input
  const message = input.message.trim()
  if (!message) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Tin nhắn rỗng" })
  }
  if (message.length > 2_000) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Tin nhắn quá dài (≤ 2000 ký tự)" })
  }

  // 5. Anti-injection — message
  if (looksLikeInjection(message)) {
    return { reply: REFUSAL_TEMPLATE, refused: true }
  }

  // 6. Anti-injection — history (client fake role được).
  // Strip ngầm các turn có injection thay vì block — UX mượt hơn,
  // user vẫn được trả lời câu chat hiện tại.
  const safeHistory = (input.history || [])
    .slice(-10)
    .filter((h) => {
      if (!h?.content) return false
      if (h.content.length > 4_000) return false
      if (h.role !== "user" && h.role !== "assistant") return false
      if (looksLikeInjection(h.content)) return false
      return true
    })

  // 7. Decrypt key
  let apiKey: string | null = null
  try {
    apiKey = decryptValue(cfg.apiKey)
  } catch {
    apiKey = null
  }
  if (!apiKey) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "API key chưa cấu hình hoặc đã hỏng — admin xem lại.",
    })
  }

  // 8. Build context (best-effort, không block khi DB lỗi)
  let siteName = "Website"
  let siteUrl = ""
  let contactInfo = ""
  try {
    const settings = await getCachedGeneralSettings()
    siteName = settings.siteTitle || "Website"
    siteUrl = settings.siteDomain || ""
    contactInfo = [
      settings.adminEmail ? `Email: ${settings.adminEmail}` : null,
      settings.adminHotline ? `Hotline: ${settings.adminHotline}` : null,
      settings.adminTelegram ? `Telegram: ${settings.adminTelegram}` : null,
      settings.adminFanpage ? `Fanpage: ${settings.adminFanpage}` : null,
    ]
      .filter(Boolean)
      .join(" · ")
  } catch (err) {
    logger.warn("AI: settings load failed, using defaults", {
      module: "ai",
      error: (err as Error).message,
    })
  }

  let servicesContext = ""
  if (cfg.allowDbContext) {
    try {
      const snap = await getAiContextSnapshot()
      servicesContext = snapshotToMarkdown(snap, siteUrl)
    } catch (err) {
      logger.warn("AI context build failed", {
        module: "ai",
        error: (err as Error).message,
      })
    }
  }

  const systemPrompt = buildSystemPrompt({
    customPrompt: cfg.systemPrompt,
    siteName,
    siteUrl,
    contactInfo,
    servicesContext,
  })

  // 9. Call provider
  const result = await chatWithAi({
    provider: cfg.provider as AiProviderId,
    model: cfg.model,
    apiKey,
    systemPrompt,
    history: safeHistory,
    userMessage: message,
    maxTokens: cfg.maxTokens,
    temperature: cfg.temperature,
  })

  if (!result.ok || !result.text) {
    // Mask key trước khi log để tránh leak vào file log nếu provider echo key.
    const masked = maskKeyInResult(result, apiKey)
    logger.warn("AI chat failed", {
      module: "ai",
      provider: cfg.provider,
      model: cfg.model,
      error: masked.error,
    })
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Trợ lý đang bận, vui lòng thử lại sau.",
    })
  }

  return { reply: result.text }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Nếu provider echo lại API key trong error body, mask thành ***. */
function maskKeyInResult(result: ChatResult, key: string): ChatResult {
  if (!result.error || !key || key.length < 8) return result
  // Replace key + visible prefix/suffix variants. Không dùng regex split key
  // (tránh edge case key chứa metachar).
  const masked = result.error.split(key).join("***")
  return { ...result, error: masked }
}

/** Trả về catalog providers (không có key) cho UI render selectbox. */
export function getProviderCatalog() {
  return Object.values(AI_PROVIDERS).map((p) => ({
    id: p.id,
    label: p.label,
    docsUrl: p.docsUrl,
    defaultModel: p.defaultModel,
    models: p.models.map((m) => ({
      id: m.id,
      label: m.label,
      contextWindow: m.contextWindow,
      inputPer1M: m.inputPer1M,
      outputPer1M: m.outputPer1M,
      notes: m.notes ?? null,
    })),
  }))
}

// ─── AI Template Generator (admin only) ────────────────────────────────────

export type AiTemplateKind =
  | "mail_subject"
  | "mail_html"
  | "telegram_text"
  | "notification_title"
  | "notification_html"
  | "rich_description"

export interface GenerateTemplateInput {
  kind: AiTemplateKind
  hint: string
  /** Optional context (eg. existing subject when generating body). */
  related?: { label: string; value: string }[]
}

const DESIGN_RULES_HTML = `
**QUY TẮC THIẾT KẾ HTML EMAIL — BẮT BUỘC:**
- Dùng inline CSS (vì email client không hiểu external CSS).
- Bảng màu chuyên nghiệp HSL: nền #f8fafc (slate-50), text #0f172a (slate-900), muted #64748b (slate-500), accent #0f172a hoặc #1e40af (blue-800).
- HẠN CHẾ gradient. Tối đa 1 vùng gradient nhẹ ở header (vd: linear-gradient(135deg, #1e293b, #0f172a)).
- Typography: font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif.
- Border-radius nhỏ (8-12px), padding nội dung 24-32px.
- Layout center max-width 600px, background ngoài #f1f5f9.
- Heading h1 size 22-26px, body 14-15px, line-height 1.6.
- CTA button: nền solid (KHÔNG gradient), padding 12px 24px, border-radius 8px, font-weight 600.
- KHÔNG icon emoji thừa, KHÔNG shadow lòe loẹt.
- Trả VỀ CHỈ HTML thuần (bắt đầu bằng <div hoặc <table). KHÔNG kèm \`\`\`html\`\`\` markdown fence, KHÔNG comment.
`

const DESIGN_RULES_NOTIFICATION = `
**QUY TẮC NỘI DUNG THÔNG BÁO IN-APP:**
- HTML ngắn gọn, súc tích (≤ 3 đoạn).
- Allowed tags: <p>, <strong>, <em>, <a>, <br>, <ul>, <li>.
- KHÔNG inline style, KHÔNG <script>, KHÔNG <iframe>.
- Tone chuyên nghiệp, không exclamation marks dồn dập.
- Đặt số tiền/giá trị quan trọng trong <strong>.
- Nếu có CTA, dùng <a href="...">Text</a> rõ ràng.
- Trả về CHỈ HTML thuần. KHÔNG kèm fence markdown.
`

const DESIGN_RULES_TELEGRAM = `
**QUY TẮC TIN NHẮN TELEGRAM:**
- Telegram chỉ hỗ trợ HTML subset: <b>, <i>, <u>, <s>, <code>, <pre>, <a href="..."> và xuống dòng \\n.
- KHÔNG <p>, KHÔNG <div>, KHÔNG <br>, KHÔNG inline CSS.
- Kết cấu: tiêu đề <b>...</b> + 1 dòng trống + nội dung + 1 dòng trống + CTA link.
- Ngắn gọn ≤ 800 ký tự.
- Có thể thêm 1-2 emoji nếu phù hợp ngữ cảnh (vd 🎉 cho khuyến mãi), KHÔNG quá 2.
- Trả về CHỈ TEXT thuần. KHÔNG fence markdown.
`

const DESIGN_RULES_RICH_DESCRIPTION = `
**QUY TẮC NỘI DUNG MÔ TẢ CHI TIẾT (sản phẩm / logo / dịch vụ):**
- Render trong khối \`prose\` (Tailwind typography), KHÔNG cần inline CSS.
- Allowed tags: <h2>, <h3>, <p>, <strong>, <em>, <ul>, <ol>, <li>, <blockquote>, <a>, <br>, <code>, <pre>, <img>, <table>, <thead>, <tbody>, <tr>, <th>, <td>, <hr>.
- KHÔNG <h1> (đã có ở header trang). KHÔNG <script>, <iframe>, <form>, <style>.
- Cấu trúc đề xuất:
  + Đoạn mở đầu giới thiệu (1-2 câu ngắn)
  + <h2>Tính năng nổi bật</h2> + <ul>...</ul> 4-6 bullet
  + <h2>Phù hợp với</h2> + đoạn ngắn / bullet
  + <h2>Yêu cầu hệ thống</h2> (nếu là source code) + bullet PHP/MySQL/Node
  + Đoạn kết với CTA mua/thuê
- Văn phong chuyên nghiệp, súc tích, dùng \`<strong>\` để nhấn từ khóa.
- KHÔNG markdown fence, KHÔNG quote bao quanh.
- Trả về CHỈ HTML thuần.
`

function buildTemplatePrompt(input: GenerateTemplateInput): { system: string; user: string } {
  const relatedBlock = (input.related || [])
    .filter((r) => r.value && r.value.trim())
    .map((r) => `- ${r.label}: ${r.value.slice(0, 500)}`)
    .join("\n")

  let designRules = ""
  let outputDesc = ""

  switch (input.kind) {
    case "mail_subject":
      designRules = "Trả về MỘT dòng subject email tiếng Việt, ≤ 70 ký tự, chuyên nghiệp, KHÔNG dấu chấm cuối, KHÔNG quote, KHÔNG markdown. Có thể chèn 1 emoji ở đầu nếu phù hợp."
      outputDesc = "Subject email"
      break
    case "mail_html":
      designRules = DESIGN_RULES_HTML
      outputDesc = "Nội dung email HTML đầy đủ"
      break
    case "telegram_text":
      designRules = DESIGN_RULES_TELEGRAM
      outputDesc = "Tin nhắn Telegram"
      break
    case "notification_title":
      designRules = "Trả về MỘT dòng tiêu đề thông báo tiếng Việt, ≤ 80 ký tự, súc tích, không dấu chấm cuối, không quote, không markdown."
      outputDesc = "Tiêu đề thông báo"
      break
    case "notification_html":
      designRules = DESIGN_RULES_NOTIFICATION
      outputDesc = "Nội dung thông báo HTML"
      break
    case "rich_description":
      designRules = DESIGN_RULES_RICH_DESCRIPTION
      outputDesc = "Mô tả chi tiết HTML"
      break
  }

  const system = `Bạn là chuyên gia copywriter + designer email/notification cho hệ thống Việt Nam. Văn phong chuyên nghiệp, súc tích, đáng tin cậy. KHÔNG dùng tiếng Anh trừ tên thương hiệu/từ khoá kỹ thuật. KHÔNG nịnh hót, KHÔNG mở đầu bằng "Tuyệt vời" hay "Chắc chắn rồi".

${designRules}

CHỈ trả về nội dung được yêu cầu, không kèm giải thích, không kèm tiêu đề "Đây là...", không kèm code fence.`

  const user = `Sinh ${outputDesc} cho yêu cầu sau:

${input.hint.slice(0, 1000)}

${relatedBlock ? `\n**Ngữ cảnh liên quan:**\n${relatedBlock}\n` : ""}

Sinh ngay nội dung theo đúng quy tắc trên.`

  return { system, user }
}

/** Strip code fences nếu LLM lỡ kèm vào. */
function stripFences(text: string): string {
  return text
    .replace(/^```(?:html|text|markdown)?\s*\n?/i, "")
    .replace(/\n?```\s*$/, "")
    .trim()
}

export async function generateAiTemplate(input: GenerateTemplateInput): Promise<{ output: string }> {
  await connectDB()
  const cfg = await loadFullConfig()
  if (!cfg.enabled) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "AI chưa được bật. Hãy bật ở Settings → AI." })
  }
  let apiKey: string | null = null
  try {
    apiKey = decryptValue(cfg.apiKey)
  } catch {
    apiKey = null
  }
  if (!apiKey) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Chưa có API key AI. Cấu hình ở Settings → AI." })
  }
  const hint = input.hint.trim()
  if (!hint) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Hãy nhập gợi ý nội dung muốn AI sinh." })
  }
  if (hint.length > 1_000) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Gợi ý quá dài (≤ 1000 ký tự)." })
  }
  if (looksLikeInjection(hint)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Gợi ý chứa nội dung không hợp lệ." })
  }

  const { system, user } = buildTemplatePrompt(input)

  // Email/notification HTML cần token cao hơn chat thường.
  const tokensForKind: Record<AiTemplateKind, number> = {
    mail_subject: 100,
    mail_html: 2_500,
    telegram_text: 500,
    notification_title: 100,
    notification_html: 800,
    rich_description: 2_000,
  }

  const result = await chatWithAi({
    provider: cfg.provider as AiProviderId,
    model: cfg.model,
    apiKey,
    systemPrompt: system,
    history: [],
    userMessage: user,
    maxTokens: tokensForKind[input.kind] ?? cfg.maxTokens,
    // Nhiệt độ thấp hơn để output ổn định, ít hallucinate.
    temperature: Math.min(0.5, cfg.temperature),
  })

  if (!result.ok || !result.text) {
    const masked = maskKeyInResult(result, apiKey)
    logger.warn("AI template generation failed", {
      module: "ai.generateTemplate",
      kind: input.kind,
      provider: cfg.provider,
      error: masked.error,
    })
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "AI tạm thời không phản hồi. Thử lại sau ít phút.",
    })
  }

  return { output: stripFences(result.text) }
}
