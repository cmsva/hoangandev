"use client"

import { useState, useEffect, useRef } from "react"

const LANGUAGES = [
  { code: "vi", label: "Tiếng Việt", flag: "vn" },
  { code: "en", label: "English", flag: "gb" },
  { code: "zh-CN", label: "简体中文", flag: "cn" },
  { code: "zh-TW", label: "繁體中文", flag: "tw" },
  { code: "ja", label: "日本語", flag: "jp" },
  { code: "ko", label: "한국어", flag: "kr" },
  { code: "th", label: "ไทย", flag: "th" },
  { code: "fr", label: "Français", flag: "fr" },
  { code: "de", label: "Deutsch", flag: "de" },
  { code: "ru", label: "Русский", flag: "ru" },
  { code: "es", label: "Español", flag: "es" },
  { code: "pt", label: "Português", flag: "pt" },
  { code: "id", label: "Bahasa Indonesia", flag: "id" },
  { code: "ms", label: "Bahasa Melayu", flag: "my" },
  { code: "ar", label: "العربية", flag: "sa" },
  { code: "hi", label: "हिन्दी", flag: "in" },
  { code: "it", label: "Italiano", flag: "it" },
  { code: "nl", label: "Nederlands", flag: "nl" },
  { code: "pl", label: "Polski", flag: "pl" },
  { code: "tr", label: "Türkçe", flag: "tr" },
  { code: "uk", label: "Українська", flag: "ua" },
  { code: "km", label: "ភាសាខ្មែរ", flag: "kh" },
  { code: "lo", label: "ພາສາລາວ", flag: "la" },
  { code: "my", label: "ဗမာစာ", flag: "mm" },
]

function triggerGoogleTranslate(langCode: string) {
  // For Vietnamese (original), clear cookies and reload to restore
  if (langCode === "vi") {
    document.cookie = "googtrans=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC"
    document.cookie = `googtrans=; path=/; domain=${window.location.hostname}; expires=Thu, 01 Jan 1970 00:00:00 UTC`
    // Try to use the Google Translate restore
    const frame = document.querySelector(".goog-te-banner-frame") as HTMLIFrameElement
    if (frame) {
      const btn = frame.contentDocument?.querySelector(".goog-close-link") as HTMLElement
      if (btn) { btn.click(); return }
    }
    window.location.reload()
    return
  }

  // Set cookies for Google Translate
  const path = `/vi/${langCode}`
  document.cookie = `googtrans=${path}; path=/; expires=${new Date(Date.now() + 365 * 86400000).toUTCString()}`
  document.cookie = `googtrans=${path}; path=/; domain=${window.location.hostname}; expires=${new Date(Date.now() + 365 * 86400000).toUTCString()}`

  // Try to trigger the hidden Google Translate select
  const tryTrigger = () => {
    const el = document.querySelector(".goog-te-combo") as HTMLSelectElement
    if (el) {
      el.value = langCode
      el.dispatchEvent(new Event("change"))
      return true
    }
    return false
  }

  if (!tryTrigger()) {
    let attempts = 0
    const interval = setInterval(() => {
      attempts++
      if (tryTrigger() || attempts > 10) {
        clearInterval(interval)
        if (attempts > 10) window.location.reload()
      }
    }, 300)
  }
}

export function LanguageSwitcher() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<typeof LANGUAGES[0]>(LANGUAGES[0])
  const ref = useRef<HTMLDivElement>(null)

  // Load saved language on mount + auto-trigger translate
  useEffect(() => {
    const saved = localStorage.getItem("app_lang")
    if (saved) {
      const found = LANGUAGES.find((l) => l.code === saved)
      if (found) setSelected(found)
      // Auto-trigger translation if not Vietnamese
      if (saved !== "vi") {
        setTimeout(() => triggerGoogleTranslate(saved), 1500)
      }
    }
  }, [])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const filtered = LANGUAGES.filter((l) =>
    l.label.toLowerCase().includes(search.toLowerCase()) ||
    l.code.toLowerCase().includes(search.toLowerCase())
  )

  const handleSelect = (lang: typeof LANGUAGES[0]) => {
    setSelected(lang)
    setOpen(false)
    setSearch("")
    localStorage.setItem("app_lang", lang.code)
    triggerGoogleTranslate(lang.code)
  }

  return (
    <div className="relative notranslate" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-accent hover:text-foreground"
        aria-label="Ngôn ngữ"
        title="Ngôn ngữ"
      >
        <img
          alt={selected.label}
          width="20"
          height="20"
          className="h-5 w-5 rounded-full object-cover"
          src={`https://flagcdn.com/w40/${selected.flag}.png`}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-[300px] rounded-xl border border-border bg-popover p-0 shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Search */}
            <div className="p-2 border-b border-border">
              <div className="relative">
                <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.34-4.34" />
                </svg>
                <input
                  placeholder="Tìm kiếm ngôn ngữ..."
                  className="w-full rounded-lg border border-input bg-muted/40 py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            {/* Language list */}
            <div className="max-h-[320px] overflow-y-auto px-1.5 py-1.5">
              <div className="space-y-0.5">
                {filtered.map((lang) => {
                  const isActive = selected.code === lang.code
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => handleSelect(lang)}
                      className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                        isActive
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-popover-foreground hover:bg-accent"
                      }`}
                    >
                      <img
                        alt={lang.label}
                        width="24"
                        height="24"
                        className="h-6 w-6 rounded-full object-cover ring-1 ring-border flex-shrink-0"
                        src={`https://flagcdn.com/w40/${lang.flag}.png`}
                      />
                      <span className="flex-1 text-left truncate">{lang.label}</span>
                      <span className="text-xs text-muted-foreground uppercase flex-shrink-0">{lang.code}</span>
                      {isActive && (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
