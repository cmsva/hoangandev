"use client"

import { useEffect, useRef } from "react"

declare global {
  interface Window {
    CKEDITOR?: any
  }
}

const CKE_SRC = "https://macode.vn/cpanel/assets/ckeditor/ckeditor.js?v=1760970972"

let cdnPromise: Promise<void> | null = null

function loadCKEditorCDN(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"))
  if (window.CKEDITOR) return Promise.resolve()
  if (cdnPromise) return cdnPromise

  cdnPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CKE_SRC}"]`)
    if (existing) {
      existing.addEventListener("load", () => resolve())
      existing.addEventListener("error", () => reject(new Error("CKEditor load failed")))
      return
    }
    const script = document.createElement("script")
    script.src = CKE_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("CKEditor load failed"))
    document.head.appendChild(script)
  })

  return cdnPromise
}

interface CKEditorProps {
  value: string
  onChange: (html: string) => void
  height?: number
  placeholder?: string
  id?: string
}

/**
 * CKEditor 4 (CDN) wrapper. Khởi tạo với cấu hình giống smmcmstdev/macode.vn.
 *
 * Flow:
 *  1. Mount textarea với value
 *  2. Load CDN async (singleton)
 *  3. CKEDITOR.replace() khi sẵn sàng
 *  4. Listen "change" event → emit HTML qua onChange
 *  5. Cleanup destroy instance on unmount
 */
export function CKEditor({ value, onChange, height = 300, placeholder, id }: CKEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const instanceRef = useRef<any>(null)
  const onChangeRef = useRef(onChange)
  const valueRef = useRef(value)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    valueRef.current = value
    // Sync external value → editor (avoid loop khi user gõ)
    const inst = instanceRef.current
    if (inst && inst.getData() !== value) {
      inst.setData(value || "")
    }
  }, [value])

  useEffect(() => {
    let destroyed = false
    let inst: any = null

    loadCKEditorCDN()
      .then(() => {
        if (destroyed || !textareaRef.current || !window.CKEDITOR) return

        // Đảm bảo textarea có id (CKEDITOR.replace cần)
        if (!textareaRef.current.id) {
          textareaRef.current.id = `cke-${Math.random().toString(36).slice(2, 10)}`
        }

        inst = window.CKEDITOR.replace(textareaRef.current.id, {
          height,
          versionCheck: false,
          removeButtons: "Save,NewPage,Preview,Print,Templates,About",
          allowedContent: true,
          toolbarGroups: [
            { name: "clipboard", groups: ["clipboard", "undo"] },
            { name: "editing", groups: ["find", "selection"] },
            { name: "links", groups: ["links"] },
            { name: "insert", groups: ["insert"] },
            { name: "forms", groups: ["forms"] },
            "/",
            { name: "basicstyles", groups: ["basicstyles", "cleanup"] },
            { name: "paragraph", groups: ["list", "indent", "blocks", "align"] },
            { name: "styles", groups: ["styles"] },
            { name: "colors", groups: ["colors"] },
            { name: "tools", groups: ["tools"] },
            { name: "others", groups: ["others"] },
          ],
        })

        instanceRef.current = inst
        if (valueRef.current) {
          inst.setData(valueRef.current)
        }
        inst.on("change", () => {
          onChangeRef.current?.(inst.getData())
        })
        inst.on("blur", () => {
          onChangeRef.current?.(inst.getData())
        })
      })
      .catch((err) => {
        // CDN load fail → fallback textarea (user vẫn có thể nhập HTML thô)
        console.error("[CKEditor]", err)
      })

    return () => {
      destroyed = true
      try {
        instanceRef.current?.destroy()
      } catch {
        // no-op
      }
      instanceRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height])

  return (
    <textarea
      ref={textareaRef}
      id={id}
      defaultValue={value}
      placeholder={placeholder}
      className="min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
    />
  )
}
