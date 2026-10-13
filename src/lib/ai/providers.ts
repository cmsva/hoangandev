/**
 * AI Provider Catalog — Endpoint chuẩn + danh sách model + pricing tham khảo.
 *
 * Pricing: USD per 1M tokens (input/output). Provider thay đổi giá thường
 * xuyên nên dùng làm tham khảo, lúc gọi API thực tế provider sẽ tính chính
 * xác. Admin có thể fetch live model list qua endpoint /models nếu provider
 * support (OpenAI-compatible chuẩn).
 *
 * Tất cả endpoint đều OFFICIAL từ nhà cung cấp.
 */

export type AiProviderId =
  | "deepseek"
  | "minimax"
  | "grok"
  | "groq"
  | "gemini"
  | "claude"

export interface AiModelSpec {
  id: string
  label: string
  contextWindow: number
  inputPer1M: number // USD
  outputPer1M: number // USD
  notes?: string
}

export interface AiProviderSpec {
  id: AiProviderId
  label: string
  baseUrl: string
  // Cách gọi API: "openai" = OpenAI-compatible (DeepSeek, Grok, MiniMax),
  // "anthropic" = Messages API, "gemini" = Google generateContent.
  protocol: "openai" | "anthropic" | "gemini"
  authHeader: string // header name cho API key
  authPrefix: string // prefix cho value (vd "Bearer ")
  modelsListUrl?: string // optional GET endpoint trả về model list
  docsUrl: string
  models: AiModelSpec[]
  defaultModel: string
}

export const AI_PROVIDERS: Record<AiProviderId, AiProviderSpec> = {
  // ─── DeepSeek ────────────────────────────────────────────────────────────
  deepseek: {
    id: "deepseek",
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    protocol: "openai",
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    modelsListUrl: "https://api.deepseek.com/models",
    docsUrl: "https://api-docs.deepseek.com",
    defaultModel: "deepseek-chat",
    models: [
      {
        id: "deepseek-chat",
        label: "DeepSeek Chat (V3)",
        contextWindow: 128_000,
        inputPer1M: 0.27,
        outputPer1M: 1.1,
        notes: "Cân bằng chi phí và tốc độ, dùng cho chat thông thường",
      },
      {
        id: "deepseek-reasoner",
        label: "DeepSeek Reasoner (R1)",
        contextWindow: 128_000,
        inputPer1M: 0.55,
        outputPer1M: 2.19,
        notes: "Reasoning model — chậm hơn nhưng trả lời chính xác hơn",
      },
    ],
  },

  // ─── MiniMax ─────────────────────────────────────────────────────────────
  minimax: {
    id: "minimax",
    label: "MiniMax",
    baseUrl: "https://api.minimax.chat/v1",
    protocol: "openai",
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    docsUrl: "https://platform.minimaxi.com/document",
    defaultModel: "MiniMax-M1",
    models: [
      {
        id: "MiniMax-M1",
        label: "MiniMax M1",
        contextWindow: 1_000_000,
        inputPer1M: 0.4,
        outputPer1M: 2.2,
        notes: "Reasoning, context cực dài (1M tokens)",
      },
      {
        id: "abab6.5s-chat",
        label: "ABAB 6.5s Chat",
        contextWindow: 245_000,
        inputPer1M: 0.15,
        outputPer1M: 0.45,
        notes: "Nhanh, rẻ — phù hợp tư vấn ngắn",
      },
    ],
  },

  // ─── xAI Grok ────────────────────────────────────────────────────────────
  grok: {
    id: "grok",
    label: "xAI Grok",
    baseUrl: "https://api.x.ai/v1",
    protocol: "openai",
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    modelsListUrl: "https://api.x.ai/v1/models",
    docsUrl: "https://docs.x.ai",
    defaultModel: "grok-3-mini",
    models: [
      {
        id: "grok-4",
        label: "Grok 4",
        contextWindow: 256_000,
        inputPer1M: 3.0,
        outputPer1M: 15.0,
      },
      {
        id: "grok-3",
        label: "Grok 3",
        contextWindow: 131_072,
        inputPer1M: 3.0,
        outputPer1M: 15.0,
      },
      {
        id: "grok-3-mini",
        label: "Grok 3 Mini",
        contextWindow: 131_072,
        inputPer1M: 0.3,
        outputPer1M: 0.5,
        notes: "Rẻ, đủ tốt cho tư vấn web service",
      },
    ],
  },

  // ─── Groq (Free tier / OpenAI-compatible) ────────────────────────────────
  groq: {
    id: "groq",
    label: "Groq (Free tier)",
    baseUrl: "https://api.groq.com/openai/v1",
    protocol: "openai",
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    modelsListUrl: "https://api.groq.com/openai/v1/models",
    docsUrl: "https://console.groq.com/docs",
    defaultModel: "llama-3.3-70b-versatile",
    models: [
      {
        id: "llama-3.3-70b-versatile",
        label: "Llama 3.3 70B Versatile (Free)",
        contextWindow: 128_000,
        inputPer1M: 0,
        outputPer1M: 0,
        notes: "Groq free tier — khuyến nghị cho widget tư vấn miễn phí",
      },
      {
        // Mixtral 8x7B đã bị Groq khai tử (gọi sẽ lỗi 400). Thay bằng Gemma2 9B
        // — model free tier còn hoạt động, nhanh, phù hợp chat ngắn.
        id: "gemma2-9b-it",
        label: "Gemma2 9B IT (Free)",
        contextWindow: 8_192,
        inputPer1M: 0,
        outputPer1M: 0,
        notes: "Option miễn phí, nhanh, phù hợp chat ngắn",
      },
      {
        id: "llama-3.1-8b-instant",
        label: "Llama 3.1 8B Instant (Free)",
        contextWindow: 128_000,
        inputPer1M: 0,
        outputPer1M: 0,
        notes: "Nhanh nhất, dùng khi cần giảm tải",
      },
    ],
  },

  // ─── Google Gemini ───────────────────────────────────────────────────────
  gemini: {
    id: "gemini",
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    protocol: "gemini",
    authHeader: "x-goog-api-key",
    authPrefix: "",
    modelsListUrl: "https://generativelanguage.googleapis.com/v1beta/models",
    docsUrl: "https://ai.google.dev/gemini-api/docs",
    defaultModel: "gemini-2.5-flash",
    models: [
      {
        id: "gemini-2.5-pro",
        label: "Gemini 2.5 Pro",
        contextWindow: 2_000_000,
        inputPer1M: 1.25,
        outputPer1M: 10.0,
        notes: "Pro: ≤200K input $1.25 / >200K $2.50",
      },
      {
        id: "gemini-2.5-flash",
        label: "Gemini 2.5 Flash",
        contextWindow: 1_000_000,
        inputPer1M: 0.3,
        outputPer1M: 2.5,
        notes: "Mặc định khuyến nghị — cân bằng giữa chất lượng và giá",
      },
      {
        id: "gemini-2.5-flash-lite",
        label: "Gemini 2.5 Flash Lite",
        contextWindow: 1_000_000,
        inputPer1M: 0.1,
        outputPer1M: 0.4,
        notes: "Rẻ nhất, dùng tư vấn nhanh",
      },
    ],
  },

  // ─── Anthropic Claude ────────────────────────────────────────────────────
  claude: {
    id: "claude",
    label: "Anthropic Claude",
    baseUrl: "https://api.anthropic.com/v1",
    protocol: "anthropic",
    authHeader: "x-api-key",
    authPrefix: "",
    modelsListUrl: "https://api.anthropic.com/v1/models",
    docsUrl: "https://docs.anthropic.com",
    defaultModel: "claude-3-5-haiku-latest",
    models: [
      {
        id: "claude-opus-4-5",
        label: "Claude Opus 4.5",
        contextWindow: 200_000,
        inputPer1M: 5.0,
        outputPer1M: 25.0,
      },
      {
        id: "claude-sonnet-4-5",
        label: "Claude Sonnet 4.5",
        contextWindow: 200_000,
        inputPer1M: 3.0,
        outputPer1M: 15.0,
      },
      {
        id: "claude-3-5-haiku-latest",
        label: "Claude 3.5 Haiku",
        contextWindow: 200_000,
        inputPer1M: 0.8,
        outputPer1M: 4.0,
        notes: "Nhanh, rẻ — khuyến nghị cho widget chat",
      },
    ],
  },
}

export const AI_PROVIDER_IDS = Object.keys(AI_PROVIDERS) as AiProviderId[]

export function getProviderSpec(id: AiProviderId | string): AiProviderSpec | null {
  return (AI_PROVIDERS as Record<string, AiProviderSpec>)[id] ?? null
}

export function getModelSpec(providerId: AiProviderId | string, modelId: string): AiModelSpec | null {
  const provider = getProviderSpec(providerId)
  if (!provider) return null
  return provider.models.find((m) => m.id === modelId) ?? null
}
