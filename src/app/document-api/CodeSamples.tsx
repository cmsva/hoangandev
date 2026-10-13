"use client"

/**
 * Sub-component: render mẫu code cURL / JS / PHP cho 1 endpoint.
 *
 * Tự sinh dựa trên catalog. Có nút copy.
 */
import * as React from "react"
import type { ApiEndpoint } from "@/lib/api-docs-catalog"

type Lang = "curl" | "js" | "php"

interface Props {
  endpoint: ApiEndpoint
  baseUrl: string
}

export function CodeSamples({ endpoint, baseUrl }: Props) {
  const [lang, setLang] = React.useState<Lang>("curl")
  const [copied, setCopied] = React.useState(false)

  const code = React.useMemo(() => generateCode(endpoint, lang, baseUrl), [endpoint, lang, baseUrl])

  function handleCopy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    })
  }

  return (
    <div className="rounded-xl border border-border/40 overflow-hidden bg-zinc-950">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/5">
        <div className="flex items-center gap-1">
          {(["curl", "js", "php"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={
                "px-2.5 py-1 text-xs font-medium rounded-md transition-colors " +
                (lang === l
                  ? "bg-white/10 text-white"
                  : "text-zinc-400 hover:text-white hover:bg-white/5")
              }
            >
              {l === "curl" ? "cURL" : l === "js" ? "JavaScript" : "PHP"}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="text-[11px] font-medium px-2 py-1 rounded-md text-zinc-400 hover:text-white hover:bg-white/5"
        >
          {copied ? "✓ Đã copy" : "Copy"}
        </button>
      </div>
      <pre className="text-[12.5px] leading-5 text-zinc-100 p-4 overflow-x-auto font-mono">
        <code>{code}</code>
      </pre>
    </div>
  )
}

// ─── Code generators ────────────────────────────────────────────────────────

function generateCode(endpoint: ApiEndpoint, lang: Lang, baseUrl: string): string {
  const url = baseUrl + endpoint.path
  const needsAuth = endpoint.requiresAuth !== false
  const hasBody = endpoint.bodyExample && endpoint.method !== "GET"
  const bodyStr = hasBody ? JSON.stringify(endpoint.bodyExample, null, 2) : ""

  if (lang === "curl") {
    const lines: string[] = [
      `curl --request ${endpoint.method} \\`,
      `  --url '${url}' \\`,
      `  --header 'api-key: YOUR_API_KEY'`,
    ]
    if (needsAuth) lines[lines.length - 1] += ` \\\n  --header 'auth-token: YOUR_AUTH_TOKEN'`
    if (hasBody) {
      lines[lines.length - 1] += ` \\\n  --header 'Content-Type: application/json'`
      lines.push(`  --data '${bodyStr}'`)
    }
    return lines.join("\n")
  }

  if (lang === "js") {
    const headersLines: string[] = [`    'api-key': 'YOUR_API_KEY',`]
    if (needsAuth) headersLines.push(`    'auth-token': 'YOUR_AUTH_TOKEN',`)
    if (hasBody) headersLines.push(`    'Content-Type': 'application/json',`)
    const init: string[] = [
      `const res = await fetch('${url}', {`,
      `  method: '${endpoint.method}',`,
      `  headers: {`,
      ...headersLines,
      `  },`,
    ]
    if (hasBody) init.push(`  body: JSON.stringify(${bodyStr}),`)
    init.push(`})`)
    init.push(`const data = await res.json()`)
    init.push(`console.log(data)`)
    return init.join("\n")
  }

  // PHP
  const phpHeaders: string[] = [`    'api-key: YOUR_API_KEY',`]
  if (needsAuth) phpHeaders.push(`    'auth-token: YOUR_AUTH_TOKEN',`)
  if (hasBody) phpHeaders.push(`    'Content-Type: application/json',`)
  const phpLines: string[] = [
    `<?php`,
    `$ch = curl_init('${url}');`,
    `curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);`,
    `curl_setopt($ch, CURLOPT_CUSTOMREQUEST, '${endpoint.method}');`,
    `curl_setopt($ch, CURLOPT_HTTPHEADER, [`,
    ...phpHeaders,
    `]);`,
  ]
  if (hasBody) {
    phpLines.push(`curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(${jsonToPhp(endpoint.bodyExample)}));`)
  }
  phpLines.push(`$res = curl_exec($ch);`)
  phpLines.push(`curl_close($ch);`)
  phpLines.push(`$data = json_decode($res, true);`)
  phpLines.push(`print_r($data);`)
  return phpLines.join("\n")
}

function jsonToPhp(value: unknown): string {
  // Naive JSON → PHP array convert. Đủ cho example.
  return JSON.stringify(value)
    .replace(/\{/g, "[")
    .replace(/\}/g, "]")
    .replace(/"([^"]+)":/g, "'$1' => ")
    .replace(/"([^"]*)"/g, "'$1'")
}
