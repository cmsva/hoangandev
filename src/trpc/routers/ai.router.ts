import { z } from "zod"
import { createTRPCRouter, adminProcedure, baseProcedure } from "@/trpc/init"
import {
  getAiConfigForAdmin,
  saveAiConfig,
  getPublicAiConfig,
  testAiConnection,
  handleAiChat,
  getProviderCatalog,
  generateAiTemplate,
} from "@/services/ai.service"
import { invalidateAiContext } from "@/lib/ai/context"
import { AI_PROVIDERS_ENUM } from "@/models/ai-config.model"
import { consumeRateLimit, strictLimiter, composeKey } from "@/lib/rate-limit"

const providerEnum = z.enum(AI_PROVIDERS_ENUM)

// ─── Admin router ─────────────────────────────────────────────────────────
export const adminAiRouter = createTRPCRouter({
  catalog: adminProcedure.query(() => getProviderCatalog()),

  getConfig: adminProcedure.query(() => getAiConfigForAdmin()),

  saveConfig: adminProcedure
    .input(
      z.object({
        enabled: z.boolean(),
        provider: providerEnum,
        model: z.string().min(1).max(100),
        apiKey: z.string().max(500).nullable().optional(),
        systemPrompt: z.string().max(4000).default(""),
        maxTokens: z.number().int().min(64).max(8192),
        temperature: z.number().min(0).max(2),
        perUserPerHour: z.number().int().min(1).max(1000),
        perIpPerHour: z.number().int().min(1).max(1000),
        widgetTitle: z.string().min(1).max(80),
        widgetGreeting: z.string().min(1).max(500),
        widgetPosition: z.enum(["right", "left"]),
        allowDbContext: z.boolean(),
      })
    )
    .mutation(async ({ input }) => {
      await saveAiConfig({
        ...input,
        apiKey: input.apiKey ?? null,
      })
      return { ok: true }
    }),

  testConnection: adminProcedure
    .input(
      z.object({
        provider: providerEnum,
        model: z.string().min(1).max(100),
        apiKey: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ input }) => testAiConnection(input)),

  refreshContext: adminProcedure.mutation(() => {
    invalidateAiContext()
    return { ok: true }
  }),

  generateTemplate: adminProcedure
    .input(
      z.object({
        kind: z.enum([
          "mail_subject",
          "mail_html",
          "telegram_text",
          "notification_title",
          "notification_html",
          "rich_description",
        ]),
        hint: z.string().min(1).max(1000),
        related: z
          .array(
            z.object({
              label: z.string().max(40),
              value: z.string().max(500),
            })
          )
          .max(5)
          .default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Rate limit: tránh admin spam tốn API key.
      await consumeRateLimit(
        strictLimiter,
        composeKey("ai.generateTemplate", String(ctx.user._id)),
        "ai.generateTemplate"
      )
      return generateAiTemplate(input)
    }),
})

// ─── Public router ────────────────────────────────────────────────────────
export const aiRouter = createTRPCRouter({
  publicConfig: baseProcedure.query(() => getPublicAiConfig()),

  chat: baseProcedure
    .input(
      z.object({
        message: z.string().min(1).max(2000),
        history: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string().min(1).max(4000),
            })
          )
          .max(20)
          .default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return handleAiChat({
        userId: ctx.userId,
        ip: ctx.ip || "unknown",
        history: input.history,
        message: input.message,
      })
    }),
})
