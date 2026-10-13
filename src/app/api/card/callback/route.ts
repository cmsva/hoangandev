/**
 * Card Callback API — Nhận callback từ partner API nạp thẻ.
 *
 * Theo postman v2 spec: partner gọi POST (form-urlencoded hoặc JSON) hoặc GET (query)
 * với các field: request_id, status, amount, value, message, sign, code, serial.
 *
 * Sign verification được thực hiện trong service.processCardCallback —
 * route này chỉ parse params và forward.
 */
import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import { processCardCallback } from "@/services/card.service"

interface CallbackParams {
  request_id?: string
  status?: string | number
  amount?: string | number
  value?: string | number
  message?: string
  /** Một số partner (doithe1s) gửi chữ ký dưới tên `callback_sign` thay vì `sign`. */
  sign?: string
  callback_sign?: string
  code?: string
  serial?: string
}

function parseCallback(params: CallbackParams) {
  // Partner doithe1s gửi chữ ký qua param `callback_sign`; fallback `sign` cho các partner khác.
  const rawSign = params.callback_sign ?? params.sign
  return {
    request_id: String(params.request_id || ""),
    status: parseInt(String(params.status ?? "0"), 10),
    amount: params.amount !== undefined && params.amount !== "" ? parseInt(String(params.amount), 10) : undefined,
    value: params.value !== undefined && params.value !== "" ? parseInt(String(params.value), 10) : undefined,
    message: params.message ? String(params.message) : undefined,
    sign: rawSign ? String(rawSign) : undefined,
    code: params.code ? String(params.code) : undefined,
    serial: params.serial ? String(params.serial) : undefined,
  }
}

async function readBody(req: NextRequest): Promise<CallbackParams> {
  const contentType = req.headers.get("content-type") || ""

  if (contentType.includes("application/json")) {
    return (await req.json().catch(() => ({}))) as CallbackParams
  }

  // form-urlencoded / multipart
  const formData = await req.formData().catch(() => null)
  if (formData) {
    const obj: Record<string, string> = {}
    formData.forEach((value, key) => {
      obj[key] = String(value)
    })
    return obj as CallbackParams
  }

  // Fallback: URL search params
  const url = new URL(req.url)
  const obj: Record<string, string> = {}
  url.searchParams.forEach((value, key) => {
    obj[key] = value
  })
  return obj as CallbackParams
}

export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const params = await readBody(req)
    const result = await processCardCallback(parseCallback(params))
    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Internal error" },
      { status: 500 }
    )
  }
}

// Một số partner gọi callback bằng GET — chấp nhận luôn.
export async function GET(req: NextRequest) {
  try {
    await connectDB()
    const url = new URL(req.url)
    const obj: Record<string, string> = {}
    url.searchParams.forEach((value, key) => {
      obj[key] = value
    })
    const result = await processCardCallback(parseCallback(obj as CallbackParams))
    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Internal error" },
      { status: 500 }
    )
  }
}
