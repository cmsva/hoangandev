import { NextResponse } from "next/server"

const GOOGLE_FONTS_API = "https://www.googleapis.com/webfonts/v1/webfonts"
// Font-only API key — không nhạy cảm, hardcode để picker luôn tải được full list.
const API_KEY = "AIzaSyCQ7hGYfPxECqcO-DcYcdwZ-Fo812-yzMw"

// Popular fonts fallback nếu API lỗi
const FALLBACK_FONTS = [
  { family: "Inter", category: "sans-serif", variants: ["400", "500", "600", "700"] },
  { family: "Roboto", category: "sans-serif", variants: ["400", "500", "700"] },
  { family: "Open Sans", category: "sans-serif", variants: ["400", "600", "700"] },
  { family: "Lato", category: "sans-serif", variants: ["400", "700"] },
  { family: "Montserrat", category: "sans-serif", variants: ["400", "500", "600", "700"] },
  { family: "Poppins", category: "sans-serif", variants: ["400", "500", "600", "700"] },
  { family: "Outfit", category: "sans-serif", variants: ["400", "500", "600", "700"] },
  { family: "Nunito", category: "sans-serif", variants: ["400", "600", "700"] },
  { family: "Be Vietnam Pro", category: "sans-serif", variants: ["400", "500", "600", "700"] },
  { family: "Lexend", category: "sans-serif", variants: ["400", "500", "600", "700"] },
]

// Cache in memory for 24h
let cache: { data: any; expiresAt: number } | null = null

export async function GET() {
  const now = Date.now()
  if (cache && cache.expiresAt > now) {
    return NextResponse.json(cache.data)
  }

  try {
    const res = await fetch(
      `${GOOGLE_FONTS_API}?key=${API_KEY}&sort=popularity`,
      { next: { revalidate: 86400 }, signal: AbortSignal.timeout(8_000) }
    )
    const json = await res.json()
    const fonts = (json.items || [])
      .slice(0, 200)
      .map((f: any) => ({
        family: f.family,
        category: f.category,
        variants: f.variants,
      }))

    if (fonts.length > 0) {
      cache = { data: fonts, expiresAt: now + 86_400_000 }
      return NextResponse.json(fonts)
    }
    return NextResponse.json(FALLBACK_FONTS)
  } catch {
    return NextResponse.json(FALLBACK_FONTS)
  }
}
