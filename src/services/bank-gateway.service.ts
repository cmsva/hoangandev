
import { Bank, BankSession, type IBank } from "@/models/bank.model"
import { decryptValue, isValidObjectId } from "@/lib/encryption"
import { connectDB } from "@/lib/db"
import { Types } from "mongoose"
import { BankACB } from "./banks/bank-acb.service"
import { BankMBBank } from "./banks/bank-mbbank.service"
import { BankOCB, type OCBSessionData } from "./banks/bank-ocb.service"
import { logger } from "@/lib/logger"

export interface NormalizedTransaction {
  transactionID: string
  amount: number
  description: string
  transactionDate: string
  type: "IN" | "OUT"
}

export interface FetchResult {
  ok: boolean
  msg?: string
  transactions: NormalizedTransaction[]
  /** OCB-specific: cần OTP lần đầu */
  otpRequired?: boolean
  otpUrl?: string
}

const EXTERNAL_FETCH_TIMEOUT = 15_000

// ─── Provider mapping (từ levuphong) ──────────────────────────────────────

const CODERENT_MAP: Record<string, string> = {
  "Ví THESIEURE.COM": "thesieure",
  "Ví điện tử Zalo Pay": "zalopay",
  "Ngân hàng TMCP Công thương Việt Nam VietinBank": "VIETTIN",
  "Ngân hàng TMCP Ngoại Thương Việt Nam Vietcombank": "VCB",
  "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam BIDV": "BIDV",
  "Ngân hàng TMCP Phương Đông OCB": "OCB",
  "Ngân hàng TMCP Kỹ thương Việt Nam Techcombank": "TCB",
  "Ngân hàng TMCP Việt Nam Thịnh Vượng VPBank": "VPB",
  "Ngân hàng TMCP Tiên Phong TPBank": "TPB",
  "Ngân hàng TMCP Hàng Hải MSB": "MSB",
  "Ngân hàng TMCP Đông Nam Á SeABank": "SEAB",
}

const THUEAPIBANK_MAP: Record<string, string> = {
  "Ngân hàng TMCP Tiên Phong TPBank": "tpbv2",
  "Ngân hàng TMCP Ngoại Thương Việt Nam Vietcombank": "vcbv2",
  "Ngân hàng TMCP Á Châu ACB": "acbv2",
  "Ngân hàng TMCP Quân đội MBBank": "mbbankv2",
  "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam BIDV": "bidvv2",
  "Ngân hàng TMCP Kỹ thương Việt Nam Techcombank": "tcbv2",
  "Ngân hàng TMCP Hàng Hải MSB": "msbv2",
  "Ngân hàng TMCP Việt Nam Thịnh Vượng VPBank": "vpbankv2",
  "Ngân hàng TMCP Phương Đông OCB": "ocbv2",
  "Ngân hàng TMCP Bản Việt VietCapitalBank": "timov2",
  Timo: "timov2",
  Paypal: "paypalv2",
  "Ví điện tử Zalo Pay": "zalopayv2",
  "Ngân hàng TMCP Công thương Việt Nam VietinBank": "viettinv2",
  "Ngân hàng TMCP Đông Nam Á SeABank": "seabankv2",
  "Ví THESIEURE.COM": "thesieurev2",
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Fetch transactions cho 1 bank theo apiProvider của nó.
 * Tự update `lastCheckAt` và `lastError` khi xong.
 */
export async function fetchBankTransactions(bank: IBank): Promise<FetchResult> {
  await connectDB()
  let result: FetchResult
  try {
    switch (bank.apiProvider) {
      case "coderent":
      case "thueapibank":
        result = await fetchExternal(bank)
        break
      case "acb":
        result = await fetchACB(bank)
        break
      case "mbbank":
        result = await fetchMBBank(bank)
        break
      case "ocb":
        result = await fetchOCB(bank)
        break
      case "none":
      default:
        result = { ok: false, msg: "Bank chưa cấu hình API provider", transactions: [] }
    }
  } catch (err: any) {
    logger.error("fetchBankTransactions exception", err, {
      module: "bank-gateway",
      bankId: String(bank._id),
    })
    result = { ok: false, msg: err?.message || "Unknown error", transactions: [] }
  }

  await updateBankStatus(bank._id, result.ok ? null : result.msg || "Lỗi không rõ")
  return result
}

// ─── External providers (coderent / thueapibank) ─────────────────────────

async function fetchExternal(bank: IBank): Promise<FetchResult> {
  const tokenPlain = decryptValueSafe(bank.apiToken)
  if (!tokenPlain) {
    return { ok: false, msg: "Thiếu API Token", transactions: [] }
  }

  let url = tokenPlain
  if (!url.includes("http")) {
    if (bank.apiProvider === "coderent") {
      const code =
        CODERENT_MAP[bank.accountName] ||
        CODERENT_MAP[(bank as any).fullName] ||
        bank.shortName
      if (!code) {
        return {
          ok: false,
          msg: "Ngân hàng này không hỗ trợ API Coderent. Nhập URL thủ công.",
          transactions: [],
        }
      }
      url = `https://api.coderent.vn/api/${code}/historyv2/${tokenPlain}`
    } else if (bank.apiProvider === "thueapibank") {
      const code =
        THUEAPIBANK_MAP[bank.accountName] ||
        THUEAPIBANK_MAP[(bank as any).fullName] ||
        bank.shortName
      if (!code) {
        return {
          ok: false,
          msg: "Ngân hàng này không hỗ trợ API ThueApiBank. Nhập URL thủ công.",
          transactions: [],
        }
      }
      url = `https://thueapibank.vn/historyapi${code}/${tokenPlain}`
    }
  }

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT) })
    const data: any = await res.json()
    if (!data?.transactions || !Array.isArray(data.transactions)) {
      return { ok: false, msg: "Không thể lấy dữ liệu từ API trung gian", transactions: [] }
    }
    return {
      ok: true,
      transactions: data.transactions.map(normalizeExternalTx),
      msg: "OK",
    }
  } catch (err: any) {
    return { ok: false, msg: err?.message || "Fetch error", transactions: [] }
  }
}

function normalizeExternalTx(tx: any): NormalizedTransaction {
  const amount = Number(tx.amount || tx.creditAmount || tx.debitAmount || 0)
  return {
    transactionID: tx.transactionID || tx.transactionId || tx.refNo || "",
    amount: Math.abs(amount),
    description: tx.description || "",
    transactionDate: tx.transactionDate || "",
    type: tx.type === "IN" || amount > 0 ? "IN" : "OUT",
  }
}

// ─── ACB direct ───────────────────────────────────────────────────────────

async function fetchACB(bank: IBank): Promise<FetchResult> {
  const username = decryptValueSafe(bank.bankUsername)
  const password = decryptValueSafe(bank.bankPassword)
  if (!username || !password) {
    return { ok: false, msg: "ACB: Thiếu username/password", transactions: [] }
  }

  const acb = new BankACB()

  // 1. Try old session
  const session = await loadSession(bank._id, "acb")
  if (session) {
    try {
      const sd = JSON.parse(session.sessionData)
      if (sd.accessToken) {
        const raw = await acb.getTransactionHistory(bank.accountNumber, 20, sd.accessToken)
        const txns = acb.normalizeTransactions(raw)
        if (txns !== null) {
          return { ok: true, transactions: txns, msg: "OK (session reuse)" }
        }
        await invalidateSession(bank._id)
      }
    } catch {
      await invalidateSession(bank._id)
    }
  }

  // 2. New login
  const loginResult = await acb.login(username, password)
  if (!loginResult?.accessToken) {
    return { ok: false, msg: "ACB login thất bại", transactions: [] }
  }

  // 3. Save session 30 mins
  await saveSession(
    bank._id,
    "acb",
    JSON.stringify({ accessToken: loginResult.accessToken }),
    30
  )

  // 4. Fetch
  const raw = await acb.getTransactionHistory(bank.accountNumber, 20, loginResult.accessToken)
  const txns = acb.normalizeTransactions(raw)
  if (txns === null) {
    return { ok: false, msg: "ACB: Lấy lịch sử thất bại sau login", transactions: [] }
  }

  return { ok: true, transactions: txns, msg: "OK (new login)" }
}

// ─── MBBank direct ────────────────────────────────────────────────────────

async function fetchMBBank(bank: IBank): Promise<FetchResult> {
  const username = decryptValueSafe(bank.bankUsername)
  const passwordPlain = decryptValueSafe(bank.bankPassword)
  if (!username || !passwordPlain) {
    return { ok: false, msg: "MBBank: Thiếu username/password", transactions: [] }
  }
  const passwordHash =
    passwordPlain.length === 32 ? passwordPlain : BankMBBank.hashPassword(passwordPlain)

  const mb = new BankMBBank(username, passwordHash, bank.deviceId || undefined)

  // Auto-save deviceId nếu chưa có
  if (!bank.deviceId) {
    await Bank.updateOne(
      { _id: bank._id },
      { $set: { deviceId: mb.getDeviceId() } }
    ).catch(() => { })
  }

  // 1. Try session
  const session = await loadSession(bank._id, "mbbank")
  if (session) {
    try {
      const sd = JSON.parse(session.sessionData)
      if (sd.sessionId) {
        const raw = await mb.getTransactionHistory(bank.accountNumber, sd.sessionId, 10)
        const txns = mb.normalizeTransactions(raw)
        if (txns !== null) {
          return { ok: true, transactions: txns, msg: "OK (session reuse)" }
        }
        await invalidateSession(bank._id)
      }
    } catch {
      await invalidateSession(bank._id)
    }
  }

  // 2. New login
  const loginResult = await mb.doLogin()
  if (!loginResult.success || !loginResult.sessionId) {
    return {
      ok: false,
      msg: "MBBank: " + (loginResult.error || "Login thất bại"),
      transactions: [],
    }
  }

  // 3. Save session 15 mins
  await saveSession(
    bank._id,
    "mbbank",
    JSON.stringify({ sessionId: loginResult.sessionId }),
    15
  )

  // 4. Fetch
  const raw = await mb.getTransactionHistory(
    bank.accountNumber,
    loginResult.sessionId,
    10
  )
  const txns = mb.normalizeTransactions(raw)
  if (txns === null) {
    return { ok: false, msg: "MBBank: Lấy lịch sử thất bại sau login", transactions: [] }
  }

  return { ok: true, transactions: txns, msg: "OK (new login)" }
}

// ─── OCB direct ───────────────────────────────────────────────────────────

async function fetchOCB(bank: IBank): Promise<FetchResult> {
  const username = decryptValueSafe(bank.bankUsername)
  const password = decryptValueSafe(bank.bankPassword)
  if (!username || !password) {
    return { ok: false, msg: "OCB: Thiếu username/password", transactions: [] }
  }

  const session = await loadSession(bank._id, "ocb")
  let sessionData: OCBSessionData | null = null
  if (session) {
    try {
      sessionData = JSON.parse(session.sessionData)
    } catch {
      sessionData = null
    }
  }

  const ocb = new BankOCB(username, password, bank.accountNumber, sessionData)

  if (!session) {
    const loginRes = await ocb.doLogin()
    if (!loginRes.success) {
      if (loginRes.otp_required) {
        return {
          ok: false,
          msg: "OCB: Cần xác thực OTP lần đầu",
          transactions: [],
          otpRequired: true,
          otpUrl: loginRes.url,
        }
      }
      return {
        ok: false,
        msg: `OCB: Login failed - ${loginRes.message || ""}`,
        transactions: [],
      }
    }
    if (!loginRes.code) {
      return { ok: false, msg: "OCB: Login response thiếu code", transactions: [] }
    }
    const tokenOk = await ocb.getToken(loginRes.code)
    if (!tokenOk) {
      return { ok: false, msg: "OCB: Không lấy được token", transactions: [] }
    }
    await saveSession(bank._id, "ocb", JSON.stringify(ocb.getSessionData()), 15)
  } else {
    const refreshed = await ocb.doRefreshToken()
    if (!refreshed) {
      await invalidateSession(bank._id)
      return {
        ok: false,
        msg: "OCB: Phiên hết hạn, đã xóa phiên cũ. Chạy lại để login mới.",
        transactions: [],
      }
    }
    await BankSession.updateOne(
      { _id: session._id },
      {
        $set: {
          sessionData: JSON.stringify(ocb.getSessionData()),
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      }
    )
  }

  // Update balance (best-effort)
  const info = await ocb.getInfo().catch(() => null)
  if (info?.balance != null) {
    await Bank.updateOne({ _id: bank._id }, { $set: { balance: info.balance } }).catch(() => { })
  }

  const fromDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0]
  const toDate = new Date().toISOString().split("T")[0]
  const txns = await ocb.getTransactions(fromDate, toDate, 30)

  return { ok: true, transactions: txns as NormalizedTransaction[], msg: "OK" }
}

/**
 * Public method để admin submit OTP cho OCB.
 * Để dùng sau khi UI admin có form OTP — tạm export cho dùng riêng.
 */
export async function submitOCBOtp(input: {
  bankId: string
  otp: string
  url: string
}): Promise<{ ok: boolean; msg: string }> {
  await connectDB()
  if (!isValidObjectId(input.bankId)) {
    return { ok: false, msg: "Bank ID không hợp lệ" }
  }
  const bank = await Bank.findById(input.bankId)
  if (!bank) return { ok: false, msg: "Bank không tồn tại" }
  if (bank.apiProvider !== "ocb") {
    return { ok: false, msg: "Provider không hỗ trợ OTP" }
  }

  const username = decryptValueSafe(bank.bankUsername)
  const password = decryptValueSafe(bank.bankPassword)
  if (!username || !password) return { ok: false, msg: "Thiếu credential" }

  const session = await loadSession(bank._id, "ocb")
  let sessionData: OCBSessionData | null = null
  if (session) {
    try {
      sessionData = JSON.parse(session.sessionData)
    } catch {
      sessionData = null
    }
  }

  const ocb = new BankOCB(username, password, bank.accountNumber, sessionData)
  const otpRes = await ocb.submitOtp(input.url, input.otp)
  if (!otpRes.success) {
    return { ok: false, msg: `Xác minh OTP thất bại: ${otpRes.message || ""}` }
  }
  if (!otpRes.code) return { ok: false, msg: "OTP đúng nhưng thiếu code" }

  const tokenOk = await ocb.getToken(otpRes.code)
  if (!tokenOk) return { ok: false, msg: "OTP đúng nhưng không lấy được token" }

  if (!session) {
    await saveSession(bank._id, "ocb", JSON.stringify(ocb.getSessionData()), 15)
  } else {
    await BankSession.updateOne(
      { _id: session._id },
      {
        $set: {
          sessionData: JSON.stringify(ocb.getSessionData()),
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      }
    )
  }

  return { ok: true, msg: "Xác thực OTP thành công" }
}

// ─── Session helpers ─────────────────────────────────────────────────────

async function loadSession(bankId: Types.ObjectId | string, type: string) {
  return await BankSession.findOne({
    bankId: new Types.ObjectId(String(bankId)),
    bankType: type,
    status: 1,
    expiresAt: { $gt: new Date() },
  })
    .sort({ _id: -1 })
    .lean<any>()
}

async function saveSession(
  bankId: Types.ObjectId | string,
  type: string,
  sessionData: string,
  ttlMins: number
) {
  const expiresAt = new Date(Date.now() + ttlMins * 60 * 1000)
  // Xoá session cũ trước khi insert
  await BankSession.deleteMany({
    bankId: new Types.ObjectId(String(bankId)),
    bankType: type,
  })
  await BankSession.create({
    bankId: new Types.ObjectId(String(bankId)),
    bankType: type,
    sessionData,
    expiresAt,
    status: 1,
  })
}

async function invalidateSession(bankId: Types.ObjectId | string) {
  await BankSession.updateMany(
    { bankId: new Types.ObjectId(String(bankId)) },
    { $set: { status: 0 } }
  ).catch(() => { })
}

async function updateBankStatus(
  bankId: Types.ObjectId | string,
  error: string | null
) {
  await Bank.updateOne(
    { _id: bankId },
    { $set: { lastCheckAt: new Date(), lastError: error } }
  ).catch(() => { })
}

/**
 * Decrypt value an toàn — nếu chưa encrypt (legacy plain) hoặc decrypt fail
 * thì trả về giá trị raw. Tránh crash khi config cũ.
 */
function decryptValueSafe(value: string | null | undefined): string | null {
  if (!value) return null
  // Nếu format hợp lệ (3 phần phân cách bằng `:`) → decrypt
  if (value.includes(":") && value.split(":").length === 3) {
    try {
      return decryptValue(value)
    } catch {
      return value
    }
  }
  return value
}
