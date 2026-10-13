/**
 * Provider-agnostic chat adapter — gọi 1 hàm `chatWithAi()`, tự route đến API
 * tương ứng (OpenAI-compatible / Anthropic Messages / Gemini generateContent).
 *
 * Mọi provider đều fail-soft: trả `{ error: string }` thay vì throw.
 * Timeout cứng 30s để widget không bị treo.
 */
import { getProviderSpec, type AiProviderId } from "@/lib/ai/providers"

export interface ChatTurn {
  role: "user" | "assistant"
  content: string
}

export interface ChatRequest {
  provider: AiProviderId
  model: string
  apiKey: string
  systemPrompt: string
  history: ChatTurn[]
  userMessage: string
  maxTokens: number
  temperature: number
}

export interface ChatResult {
  ok: boolean
  text?: string
  error?: string
  usage?: { inputTokens: number; outputTokens: number }
}

const TIMEOUT_MS = 30_000

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

// ─── OpenAI-compatible (DeepSeek / Grok / MiniMax) ────────────────────────
async function chatOpenAi(req: ChatRequest, baseUrl: string, authHeader: string, authPrefix: string): Promise<ChatResult> {
  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: req.systemPrompt },
    ...req.history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: req.userMessage },
  ]

  try {
    const resp = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [authHeader]: `${authPrefix}${req.apiKey}`,
      },
      body: JSON.stringify({
        model: req.model,
        messages,
        max_tokens: req.maxTokens,
        temperature: req.temperature,
        stream: false,
      }),
    })

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "")
      return { ok: false, error: `${resp.status}: ${errText.slice(0, 200)}` }
    }

    const data = (await resp.json()) as any
    const text = data?.choices?.[0]?.message?.content
    if (typeof text !== "string") {
      return { ok: false, error: "Provider trả response không hợp lệ" }
    }
    return {
      ok: true,
      text,
      usage: {
        inputTokens: data?.usage?.prompt_tokens ?? 0,
        outputTokens: data?.usage?.completion_tokens ?? 0,
      },
    }
  } catch (err: any) {
    if (err?.name === "AbortError") return { ok: false, error: "Provider timeout" }
    return { ok: false, error: err?.message || "Network error" }
  }
}

// ─── Anthropic Messages API ───────────────────────────────────────────────
async function chatClaude(req: ChatRequest, baseUrl: string): Promise<ChatResult> {
  const messages = [
    ...req.history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: req.userMessage },
  ]

  try {
    const resp = await fetchWithTimeout(`${baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": req.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: req.model,
        system: req.systemPrompt,
        messages,
        max_tokens: req.maxTokens,
        temperature: req.temperature,
      }),
    })

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "")
      return { ok: false, error: `${resp.status}: ${errText.slice(0, 200)}` }
    }

    const data = (await resp.json()) as any
    const block = (data?.content || []).find((b: any) => b.type === "text")
    const text = block?.text
    if (typeof text !== "string") {
      return { ok: false, error: "Claude trả response không hợp lệ" }
    }
    return {
      ok: true,
      text,
      usage: {
        inputTokens: data?.usage?.input_tokens ?? 0,
        outputTokens: data?.usage?.output_tokens ?? 0,
      },
    }
  } catch (err: any) {
    if (err?.name === "AbortError") return { ok: false, error: "Claude timeout" }
    return { ok: false, error: err?.message || "Network error" }
  }
}

// ─── Google Gemini generateContent ────────────────────────────────────────
async function chatGemini(req: ChatRequest, baseUrl: string): Promise<ChatResult> {
  const contents = [
    ...req.history.map((h) => ({
      role: h.role === "assistant" ? "model" : "user",
      parts: [{ text: h.content }],
    })),
    { role: "user", parts: [{ text: req.userMessage }] },
  ]

  const url = `${baseUrl}/models/${encodeURIComponent(req.model)}:generateContent`

  try {
    const resp = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": req.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: req.systemPrompt }] },
        contents,
        generationConfig: {
          maxOutputTokens: req.maxTokens,
          temperature: req.temperature,
        },
      }),
    })

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "")
      return { ok: false, error: `${resp.status}: ${errText.slice(0, 200)}` }
    }

    const data = (await resp.json()) as any
    const parts = data?.candidates?.[0]?.content?.parts || []
    const text = parts.map((p: any) => p?.text || "").join("").trim()
    if (!text) {
      const finishReason = data?.candidates?.[0]?.finishReason
      return { ok: false, error: `Gemini không trả nội dung (${finishReason || "unknown"})` }
    }
    return {
      ok: true,
      text,
      usage: {
        inputTokens: data?.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: data?.usageMetadata?.candidatesTokenCount ?? 0,
      },
    }
  } catch (err: any) {
    if (err?.name === "AbortError") return { ok: false, error: "Gemini timeout" }
    return { ok: false, error: err?.message || "Network error" }
  }
}

/** Entry point — route theo provider. */
export async function chatWithAi(req: ChatRequest): Promise<ChatResult> {
  const spec = getProviderSpec(req.provider)
  if (!spec) return { ok: false, error: `Unknown provider: ${req.provider}` }
  if (!req.apiKey) return { ok: false, error: "API key chưa được cấu hình" }

  if (spec.protocol === "openai") {
    return chatOpenAi(req, spec.baseUrl, spec.authHeader, spec.authPrefix)
  }
  if (spec.protocol === "anthropic") {
    return chatClaude(req, spec.baseUrl)
  }
  if (spec.protocol === "gemini") {
    return chatGemini(req, spec.baseUrl)
  }
  return { ok: false, error: "Protocol không hỗ trợ" }
}

/** Test connection — gửi 1 prompt rất ngắn. */
export async function testProvider(provider: AiProviderId, model: string, apiKey: string): Promise<ChatResult> {
  return chatWithAi({
    provider,
    model,
    apiKey,
    systemPrompt: "You are a test bot. Reply with the word: OK",
    history: [],
    userMessage: "ping",
    maxTokens: 16,
    temperature: 0,
  })
}
