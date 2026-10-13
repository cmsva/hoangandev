
import crypto from "node:crypto"

const FETCH_TIMEOUT = 20_000

const CAPTCHA_API_KEY = "DB852946-8C92-4C14-8A78-916ED9486BF1"
const ENCRYPT_URL = "http://103.78.2.65:7222/mb/encrypt-data"

export interface MBBLoginResult {
  success: boolean
  sessionId: string | null
  error: string | null
}

export class BankMBBank {
  private username: string
  private passwordHash: string
  private deviceId: string
  private mbHeaders: Record<string, string>

  constructor(username: string, passwordHash: string, deviceId?: string) {
    this.username = username
    this.passwordHash = passwordHash
    this.deviceId = deviceId || `o07leblt-mbib-0000-0000-${Date.now()}`

    this.mbHeaders = {
      accept: "application/json, text/plain, */*",
      app: "MB_WEB",
      authorization: "Basic RU1CUkVUQUlMV0VCOlNEMjM0ZGZnMzQlI0BGR0AzNHNmc2RmNDU4NDNm",
      "content-type": "application/json; charset=UTF-8",
      deviceid: this.deviceId,
      origin: "https://online.mbbank.com.vn",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
      Connection: "keep-alive",
    }
  }

  getDeviceId() {
    return this.deviceId
  }

  /** Hash password to MD5 (MBBank requires) */
  static hashPassword(password: string): string {
    return crypto.createHash("md5").update(password).digest("hex")
  }

  private async getCaptcha(): Promise<any> {
    const refNo = `${Date.now()}${Math.floor(Math.random() * 900) + 100}`
    try {
      const res = await fetch(
        "https://online.mbbank.com.vn/api/retail-internetbankingms/getCaptchaImage",
        {
          method: "POST",
          headers: {
            ...this.mbHeaders,
            referer: "https://online.mbbank.com.vn/pl/login?returnUrl=%2F",
            refno: refNo,
          },
          body: JSON.stringify({ refNo, deviceIdCommon: this.deviceId, sessionId: "" }),
          signal: AbortSignal.timeout(FETCH_TIMEOUT),
        }
      )
      return await res.json()
    } catch {
      return null
    }
  }

  private async bypassCaptcha(imageBase64: string): Promise<string | null> {
    try {
      const res = await fetch(
        "https://ecaptcha.dichvuright.com/api/captcha/mbbank",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ api_key: CAPTCHA_API_KEY, img_base64: imageBase64 }),
          signal: AbortSignal.timeout(FETCH_TIMEOUT),
        }
      )
      const result: any = await res.json()
      if (result?.status && result?.data?.captcha) return result.data.captcha
      return null
    } catch {
      return null
    }
  }

  private async wasmEncrypt(data: any): Promise<any> {
    try {
      const res = await fetch(ENCRYPT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(FETCH_TIMEOUT),
      })
      return await res.json()
    } catch {
      return null
    }
  }

  private async sendLogin(dataEnc: string): Promise<any> {
    try {
      const res = await fetch(
        "https://online.mbbank.com.vn/api/retail_web/internetbanking/v2.0/doLogin",
        {
          method: "POST",
          headers: {
            ...this.mbHeaders,
            referer: "https://online.mbbank.com.vn/pl/login?returnUrl=%2F",
          },
          body: JSON.stringify({ dataEnc }),
          signal: AbortSignal.timeout(FETCH_TIMEOUT),
        }
      )
      return await res.json()
    } catch {
      return null
    }
  }

  async doLogin(): Promise<MBBLoginResult> {
    const captchaData = await this.getCaptcha()
    if (!captchaData?.imageString) {
      return { success: false, sessionId: null, error: "Không thể lấy captcha từ MBBank" }
    }

    const captchaText = await this.bypassCaptcha(captchaData.imageString)
    if (!captchaText) {
      return { success: false, sessionId: null, error: "Bypass captcha thất bại" }
    }

    const requestData = {
      userId: this.username,
      password: this.passwordHash,
      captcha: captchaText,
      ibAuthen2faString: "",
      sessionId: null,
      refNo: Date.now().toString(),
      deviceIdCommon: this.deviceId,
    }

    const encrypted = await this.wasmEncrypt(requestData)
    if (!encrypted?.dataEnc) {
      return { success: false, sessionId: null, error: "WASM encrypt thất bại" }
    }

    const loginResult = await this.sendLogin(encrypted.dataEnc)
    if (!loginResult?.sessionId) {
      let msg = "Login thất bại"
      if (loginResult?.result?.message) msg += ": " + loginResult.result.message
      return { success: false, sessionId: null, error: msg }
    }

    return { success: true, sessionId: loginResult.sessionId, error: null }
  }

  async getTransactionHistory(
    accountNo: string,
    sessionId: string,
    days = 10
  ): Promise<any> {
    const toDate = new Date()
    const fromDate = new Date()
    fromDate.setDate(toDate.getDate() - days)

    const fmtDate = (d: Date) => {
      const dd = String(d.getDate()).padStart(2, "0")
      const mm = String(d.getMonth() + 1).padStart(2, "0")
      const yyyy = d.getFullYear()
      return `${dd}/${mm}/${yyyy}`
    }

    try {
      const res = await fetch(
        "https://online.mbbank.com.vn/api/retail-transactionms/transactionms/get-account-transaction-history",
        {
          method: "POST",
          headers: {
            ...this.mbHeaders,
            referer: "https://online.mbbank.com.vn/information-account/source-account",
            refno: `${this.username}-${Date.now()}-${Math.floor(Math.random() * 90000) + 10000
              }`,
          },
          body: JSON.stringify({
            toDate: fmtDate(toDate),
            accountNo,
            sessionId,
            fromDate: fmtDate(fromDate),
            refNo: `${this.username}-${Date.now()}`,
            deviceIdCommon: this.deviceId,
          }),
          signal: AbortSignal.timeout(FETCH_TIMEOUT),
        }
      )
      return await res.json()
    } catch {
      return null
    }
  }

  normalizeTransactions(rawData: any): any[] | null {
    if (!rawData?.transactionHistoryList || !Array.isArray(rawData.transactionHistoryList)) {
      return null
    }
    return rawData.transactionHistoryList.map((trans: any) => {
      const credit = parseInt(trans.creditAmount, 10) || 0
      const debit = parseInt(trans.debitAmount, 10) || 0
      return {
        transactionID: trans.refNo || "",
        amount: credit === 0 ? debit : credit,
        description: trans.description || "",
        transactionDate: trans.transactionDate || "",
        type: credit === 0 ? "OUT" : "IN",
      }
    })
  }
}
