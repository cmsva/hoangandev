"use client"

import { useEffect } from "react"

export function GoogleTranslateInit() {
  useEffect(() => {
    // Create the container
    const existing = document.getElementById("google_translate_element")
    if (!existing) {
      const div = document.createElement("div")
      div.id = "google_translate_element"
      document.body.appendChild(div)
    }

    // Define init function
    ;(window as any).googleTranslateElementInit = () => {
      new (window as any).google.translate.TranslateElement(
        {
          pageLanguage: "vi",
          autoDisplay: false,
          layout: (window as any).google.translate.TranslateElement.InlineLayout.NONE,
        },
        "google_translate_element"
      )
    }

    // Load script if not already loaded
    if (!document.querySelector('script[src*="translate.google.com"]')) {
      const script = document.createElement("script")
      script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
      script.async = true
      document.body.appendChild(script)
    }
  }, [])

  return null
}
