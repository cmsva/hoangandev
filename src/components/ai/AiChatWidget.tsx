"use client"

/**
 * AI chat widget — floating bubble client-side.
 *
 * Tự ẩn nếu config tắt hoặc thiếu key. Lưu history trong session để conversation
 * mượt khi refresh tab. Auto-scroll, max 10 turn lịch sử gửi server.
 */
import * as React from "react"
import { usePathname } from "next/navigation"
import { useTRPC } from "@/trpc/client"
import { useQuery, useMutation } from "@tanstack/react-query"
import { cn } from "@/lib/utils"

type Msg = { role: "user" | "assistant"; content: string; at: number }

const STORAGE_KEY = "ai-widget-chat"
const MAX_HISTORY = 10

function loadHistory(): Msg[] {
  if (typeof window === "undefined") return []
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveHistory(msgs: Msg[]): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-30)))
  } catch {
    /* quota — ignore */
  }
}

export function AiChatWidget() {
  const pathname = usePathname()
  const trpc = useTRPC()
  const cfgQuery = useQuery({
    ...trpc.ai.publicConfig.queryOptions(),
    staleTime: 60_000,
  })

  const [open, setOpen] = React.useState(false)
  const [input, setInput] = React.useState("")
  const [messages, setMessages] = React.useState<Msg[]>([])
  const [greetingShown, setGreetingShown] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  // Load history once
  React.useEffect(() => {
    setMessages(loadHistory())
  }, [])

  // Persist
  React.useEffect(() => {
    saveHistory(messages)
  }, [messages])

  // Auto-scroll
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, open])

  // Inject greeting lần đầu mở
  React.useEffect(() => {
    if (!open || greetingShown) return
    if (messages.length === 0 && cfgQuery.data?.widgetGreeting) {
      setMessages([
        { role: "assistant", content: cfgQuery.data.widgetGreeting, at: Date.now() },
      ])
    }
    setGreetingShown(true)
  }, [open, greetingShown, messages.length, cfgQuery.data])

  const chatMut = useMutation({
    ...trpc.ai.chat.mutationOptions(),
    onSuccess: (data, vars) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply, at: Date.now() },
      ])
    },
    onError: (err: any) => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: err?.message || "Trợ lý đang bận, vui lòng thử lại.",
          at: Date.now(),
        },
      ])
    },
  })

  // Hide trong admin / cron / api / authentication
  if (pathname && (pathname.startsWith("/adminPanel") || pathname.startsWith("/cmstdev") || pathname.startsWith("/api"))) {
    return null
  }
  if (!cfgQuery.data?.enabled) return null

  const cfg = cfgQuery.data
  const positionClass = cfg.widgetPosition === "left" ? "left-4 md:left-6" : "right-4 md:right-6"

  function handleSend() {
    const msg = input.trim()
    if (!msg || chatMut.isPending) return
    const userMsg: Msg = { role: "user", content: msg, at: Date.now() }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput("")

    // Lấy 10 turn gần nhất, exclude greeting đầu nếu duy nhất.
    const history = next
      .slice(-MAX_HISTORY * 2 - 2, -1)
      .map((m) => ({ role: m.role, content: m.content }))

    chatMut.mutate({ message: msg, history })
  }

  function handleClear() {
    setMessages(
      cfg.widgetGreeting
        ? [{ role: "assistant", content: cfg.widgetGreeting, at: Date.now() }]
        : []
    )
  }

  return (
    <>
      {/* Bubble button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed bottom-4 z-50 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all hover:scale-105 hover:shadow-xl md:bottom-6",
          positionClass
        )}
        aria-label="Mở trợ lý AI"
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className={cn(
            "fixed bottom-20 z-50 flex w-[calc(100vw-2rem)] max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl md:bottom-24",
            positionClass
          )}
          style={{ height: "min(560px, calc(100vh - 8rem))" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-border bg-card px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 8V4H8M16 4h-4M21 9V8a2 2 0 0 0-2-2h-1M3 9V8a2 2 0 0 1 2-2h1M3 15v1a2 2 0 0 0 2 2h1M21 15v1a2 2 0 0 1-2 2h-1M9 22h6" />
                  <rect x="3" y="9" width="18" height="6" rx="2" />
                  <circle cx="9" cy="12" r=".5" fill="currentColor" />
                  <circle cx="15" cy="12" r=".5" fill="currentColor" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">{cfg.widgetTitle}</div>
                <div className="text-[10px] text-muted-foreground">Tư vấn dịch vụ web</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleClear}
                className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Xóa lịch sử"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {cfg.widgetGreeting}
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "flex",
                  m.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {chatMut.isPending && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-muted px-3 py-2 text-sm">
                  <span className="inline-flex gap-1">
                    <span className="size-1.5 animate-bounce rounded-full bg-foreground/60" style={{ animationDelay: "0ms" }} />
                    <span className="size-1.5 animate-bounce rounded-full bg-foreground/60" style={{ animationDelay: "150ms" }} />
                    <span className="size-1.5 animate-bounce rounded-full bg-foreground/60" style={{ animationDelay: "300ms" }} />
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-border bg-card p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSend()
              }}
              className="flex items-end gap-2"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder="Hỏi về dịch vụ web…"
                rows={1}
                maxLength={2000}
                disabled={chatMut.isPending}
                className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={chatMut.isPending || !input.trim()}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m22 2-7 20-4-9-9-4Z M22 2 11 13" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
