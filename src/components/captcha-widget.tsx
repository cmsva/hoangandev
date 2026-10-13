"use client"

/**
 * CaptchaWidget — Client component render captcha widget theo provider.
 *
 * Usage:
 *   <CaptchaWidget action="login" onVerify={(token) => setCaptchaToken(token)} />
 *
 * Tự fetch config từ tRPC. Nếu provider = "none" hoặc action không nằm trong
 * config.functions → không render gì.
 */
import { useEffect, useRef, useState } from "react"
import { useTRPC } from "@/trpc/client"
import { useQuery } from "@tanstack/react-query"

declare global {
  interface Window {
    grecaptcha?: any
    turnstile?: any
    hcaptcha?: any
    onCaptchaLoad?: () => void
  }
}

interface CaptchaWidgetProps {
  action: "register" | "login" | "forgot_password" | "create_ticket" | "verify_2fa"
  onVerify: (token: string | null) => void
}

export function CaptchaWidget({ action, onVerify }: CaptchaWidgetProps) {
  const trpc = useTRPC()
  const cfgQuery = useQuery(trpc.public.captchaConfig.queryOptions()) as {
    data: { provider: string; siteKey: string; functions: string[] } | undefined
  }

  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<any>(null)
  const [scriptLoaded, setScriptLoaded] = useState(false)

  const cfg = cfgQuery.data
  const enabled = !!cfg && cfg.provider !== "none" && cfg.functions.includes(action) && !!cfg.siteKey

  // Load script
  useEffect(() => {
    if (!enabled || !cfg) return

    const provider = cfg.provider
    let scriptSrc = ""
    let scriptId = ""

    if (provider === "recaptcha_v2") {
      scriptSrc = "https://www.google.com/recaptcha/api.js?onload=onCaptchaLoad&render=explicit"
      scriptId = "recaptcha-script"
    } else if (provider === "turnstile") {
      scriptSrc = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onCaptchaLoad&render=explicit"
      scriptId = "turnstile-script"
    } else if (provider === "hcaptcha") {
      scriptSrc = "https://hcaptcha.com/1/api.js?onload=onCaptchaLoad&render=explicit"
      scriptId = "hcaptcha-script"
    }

    if (!scriptSrc) return

    // Đã load
    if (document.getElementById(scriptId)) {
      setScriptLoaded(true)
      return
    }

    window.onCaptchaLoad = () => setScriptLoaded(true)

    const script = document.createElement("script")
    script.id = scriptId
    script.src = scriptSrc
    script.async = true
    script.defer = true
    document.head.appendChild(script)
  }, [enabled, cfg])

  // Render widget khi script đã load
  useEffect(() => {
    if (!scriptLoaded || !containerRef.current || !cfg || !enabled) return
    if (widgetIdRef.current !== null) return

    const onSuccess = (token: string) => onVerify(token)
    const onExpire = () => onVerify(null)

    try {
      if (cfg.provider === "recaptcha_v2" && window.grecaptcha) {
        widgetIdRef.current = window.grecaptcha.render(containerRef.current, {
          sitekey: cfg.siteKey,
          callback: onSuccess,
          "expired-callback": onExpire,
        })
      } else if (cfg.provider === "turnstile" && window.turnstile) {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: cfg.siteKey,
          callback: onSuccess,
          "expired-callback": onExpire,
        })
      } else if (cfg.provider === "hcaptcha" && window.hcaptcha) {
        widgetIdRef.current = window.hcaptcha.render(containerRef.current, {
          sitekey: cfg.siteKey,
          callback: onSuccess,
          "expired-callback": onExpire,
        })
      }
    } catch {
      // ignore — widget có thể đã render
    }
  }, [scriptLoaded, cfg, enabled, onVerify])

  if (!enabled) return null

  return <div ref={containerRef} className="flex justify-center" />
}
