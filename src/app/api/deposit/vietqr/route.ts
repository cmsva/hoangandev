import { NextRequest, NextResponse } from "next/server"

const BANK_CODE_RE = /^[A-Za-z0-9_-]{2,30}$/
const ACCOUNT_RE = /^[0-9A-Za-z._-]{3,64}$/

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const bank = searchParams.get("bank") || ""
  const account = searchParams.get("account") || ""
  const amount = Math.max(0, Number(searchParams.get("amount") || 0))
  const addInfo = (searchParams.get("addInfo") || "").slice(0, 120)
  const accountName = (searchParams.get("accountName") || "").slice(0, 120)

  if (!BANK_CODE_RE.test(bank) || !ACCOUNT_RE.test(account) || !Number.isFinite(amount)) {
    return NextResponse.json({ error: "Invalid QR params" }, { status: 400 })
  }

  const url = new URL(`https://img.vietqr.io/image/${bank}-${account}-qr_only.png`)
  url.searchParams.set("amount", String(Math.trunc(amount)))
  url.searchParams.set("addInfo", addInfo)
  url.searchParams.set("accountName", accountName)

  const res = await fetch(url, {
    next: { revalidate: 60 },
    signal: AbortSignal.timeout(8_000),
  })
  if (!res.ok || !res.body) {
    return NextResponse.json({ error: "Cannot fetch QR" }, { status: 502 })
  }

  return new NextResponse(res.body, {
    headers: {
      "Content-Type": res.headers.get("content-type") || "image/png",
      "Cache-Control": "public, max-age=60",
    },
  })
}
