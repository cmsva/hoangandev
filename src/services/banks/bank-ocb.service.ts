/**
 * OCB Omni iBanking integration — OAuth code flow + cookie session.
 *
 * Source: ported từ levuphong/lib/banks/bank-ocb.service.ts.
 * Phụ thuộc axios + axios-cookiejar-support + tough-cookie để lưu cookies
 * giữa các request trong 1 session.
 */
import crypto from "node:crypto"
import axios, { type AxiosInstance } from "axios"
import { wrapper } from "axios-cookiejar-support"
import { CookieJar } from "tough-cookie"

const FETCH_TIMEOUT = 20_000
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"

export interface OCBSessionData {
  state: string
  nonce: string
  codeVerifier: string
  codeChallenge: string
  cookies?: any
  authToken?: string | null
  refreshToken?: string | null
  serviceAgreementId?: string | null
  accountId?: string | null
}

export interface OCBLoginResult {
  success: boolean
  code?: string
  message?: string
  otp_required?: boolean
  url?: string
}

export class BankOCB {
  private username: string
  private passwordHash: string
  private accountNumber: string
  private jar: CookieJar
  private client: AxiosInstance

  public state: string
  public nonce: string
  public codeVerifier: string
  public codeChallenge: string

  public authToken: string | null = null
  public refreshToken: string | null = null
  public serviceAgreementId: string | null = null
  public accountId: string | null = null

  constructor(
    username: string,
    passwordHash: string,
    accountNumber: string,
    sessionData?: OCBSessionData | null
  ) {
    this.username = username
    this.passwordHash = passwordHash
    this.accountNumber = accountNumber
    this.jar = new CookieJar()
    this.client = wrapper(
      axios.create({ jar: this.jar, validateStatus: () => true, timeout: FETCH_TIMEOUT })
    )

    if (sessionData?.state) {
      this.state = sessionData.state
      this.nonce = sessionData.nonce
      this.codeVerifier = sessionData.codeVerifier
      this.codeChallenge = sessionData.codeChallenge
      if (sessionData.cookies) {
        this.jar = CookieJar.deserializeSync(sessionData.cookies)
        this.client = wrapper(
          axios.create({
            jar: this.jar,
            validateStatus: () => true,
            timeout: FETCH_TIMEOUT,
          })
        )
      }
      this.authToken = sessionData.authToken || null
      this.refreshToken = sessionData.refreshToken || null
      this.serviceAgreementId = sessionData.serviceAgreementId || null
      this.accountId = sessionData.accountId || null
    } else {
      this.state = this.getImei()
      this.nonce = this.state
      this.codeVerifier = this.getRandomString(96)
      this.codeChallenge = this.getCodeChallenge(this.codeVerifier)
    }
  }

  getSessionData(): OCBSessionData {
    return {
      state: this.state,
      nonce: this.nonce,
      codeVerifier: this.codeVerifier,
      codeChallenge: this.codeChallenge,
      cookies: this.jar.serializeSync(),
      authToken: this.authToken,
      refreshToken: this.refreshToken,
      serviceAgreementId: this.serviceAgreementId,
      accountId: this.accountId,
    }
  }

  private getRandomString(length: number): string {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    let result = ""
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  private getCodeChallenge(verifier: string): string {
    return crypto
      .createHash("sha256")
      .update(verifier)
      .digest("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "")
  }

  private getImei(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === "x" ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }

  private getHeaders(isApi = false) {
    if (isApi) {
      return {
        Accept: "application/json",
        "Accept-Language": "vi",
        Connection: "keep-alive",
        Lang: "vi",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "User-Agent": USER_AGENT,
        Authorization: this.authToken ? `Bearer ${this.authToken}` : "",
      }
    }
    return {
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      Connection: "keep-alive",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "same-site",
      "Sec-Fetch-User": "?1",
      "Upgrade-Insecure-Requests": "1",
      "User-Agent": USER_AGENT,
    }
  }

  private getSessionAndCode(url: string) {
    try {
      const u = new URL(url)
      return {
        session_state: u.searchParams.get("session_state"),
        code: u.searchParams.get("code"),
      }
    } catch {
      return { session_state: null, code: null }
    }
  }

  async getLoginUrl(): Promise<{
    url: string | null
    sessionAndCode: { code: string | null } | null
  }> {
    const params = new URLSearchParams({
      client_id: "bb-web-client",
      redirect_uri: "https://ocbomni.ocb.com.vn/en-US/select-context",
      state: this.state,
      response_type: "code",
      scope: "openid",
      nonce: this.nonce,
      ui_locales: "vi",
      code_challenge: this.codeChallenge,
      code_challenge_method: "S256",
    })

    const url = `https://identity-omni.ocb.com.vn/auth/realms/backbase/protocol/openid-connect/auth?${params.toString()}`
    const res = await this.client.get(url, { headers: this.getHeaders() })

    const finalUrl = res.request?.res?.responseUrl || res.config.url || ""
    const sc = this.getSessionAndCode(finalUrl)
    if (sc.code) return { url: null, sessionAndCode: sc }

    if (typeof res.data === "string") {
      const match = res.data.match(/action="([^"\s]+)"/)
      if (match) return { url: match[1].replace(/&amp;/g, "&"), sessionAndCode: null }
    }
    return { url, sessionAndCode: null }
  }

  async doLogin(): Promise<OCBLoginResult> {
    const { url: loginUrl, sessionAndCode } = await this.getLoginUrl()
    if (sessionAndCode?.code) return { success: true, code: sessionAndCode.code }
    if (!loginUrl) return { success: false, message: "Could not get login URL" }

    const data = new URLSearchParams()
    data.append("username", this.username)
    data.append("password", this.passwordHash)
    data.append("locale", "vi")
    data.append("rememberMe", "on")

    try {
      const res = await this.client.post(loginUrl, data.toString(), {
        headers: {
          ...this.getHeaders(),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        maxRedirects: 5,
      })

      const finalUrl = res.request?.res?.responseUrl || res.config.url || ""
      const sc = this.getSessionAndCode(finalUrl)
      if (sc.code) return { success: true, code: sc.code }

      if (typeof res.data === "string") {
        if (
          res.data.includes("Xác thực đăng nhập") ||
          res.data.includes("otpChoice")
        ) {
          return {
            success: false,
            message: "OTP Required",
            otp_required: true,
            url: finalUrl,
          }
        }
        const errMatch = res.data.match(
          /<span\s+id="template-error-msg".*?>(.*?)<\/span>/
        )
        if (errMatch) return { success: false, message: errMatch[1] }
      }
      return { success: false, message: "Login failed, invalid credentials or blocked" }
    } catch (err: any) {
      return { success: false, message: err.message }
    }
  }

  async submitOtp(requestUrl: string, otpCode: string): Promise<OCBLoginResult> {
    const data = new URLSearchParams()
    data.append("totp", "")
    data.append("otp", otpCode)
    try {
      const res = await this.client.post(requestUrl, data.toString(), {
        headers: {
          ...this.getHeaders(),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        maxRedirects: 5,
      })
      const finalUrl = res.request?.res?.responseUrl || res.config.url || ""
      const sc = this.getSessionAndCode(finalUrl)
      if (sc.code) return { success: true, code: sc.code }
      return { success: false, message: "Invalid OTP" }
    } catch (err: any) {
      return { success: false, message: err.message }
    }
  }

  async getToken(code: string): Promise<boolean> {
    const data = new URLSearchParams()
    data.append("code", code)
    data.append("grant_type", "authorization_code")
    data.append("client_id", "bb-web-client")
    data.append("redirect_uri", "https://ocbomni.ocb.com.vn/en-US/select-context")
    data.append("code_verifier", this.codeVerifier)
    data.append("ui_locales", "vi")

    const url =
      "https://identity-omni.ocb.com.vn/auth/realms/backbase/protocol/openid-connect/token"
    const res = await this.client.post(url, data.toString(), {
      headers: { ...this.getHeaders(), "Content-Type": "application/x-www-form-urlencoded" },
    })

    if (res.data?.access_token) {
      this.authToken = res.data.access_token
      this.refreshToken = res.data.refresh_token
      return true
    }
    return false
  }

  async doRefreshToken(): Promise<boolean> {
    if (!this.refreshToken) return false
    const data = new URLSearchParams()
    data.append("grant_type", "refresh_token")
    data.append("client_id", "bb-web-client")
    data.append("refresh_token", this.refreshToken)
    data.append("scope", "openid")
    data.append("ui_locales", "vi")

    const url =
      "https://identity-omni.ocb.com.vn/auth/realms/backbase/protocol/openid-connect/token"
    const res = await this.client.post(url, data.toString(), {
      headers: { ...this.getHeaders(), "Content-Type": "application/x-www-form-urlencoded" },
    })

    if (res.data?.access_token) {
      this.authToken = res.data.access_token
      this.refreshToken = res.data.refresh_token
      return true
    }
    return false
  }

  private async getServiceAgreements(): Promise<boolean> {
    const url =
      "https://ocbomni.ocb.com.vn/api/access-control/client-api/v3/accessgroups/user-context/service-agreements?from=0&size=7"
    const res = await this.client.get(url, { headers: this.getHeaders(true) })
    if (res.data && res.data.length > 0) {
      this.serviceAgreementId = res.data[0].id
      return true
    }
    return false
  }

  private async setUserContext(): Promise<boolean> {
    const url =
      "https://ocbomni.ocb.com.vn/api/access-control/client-api/v3/accessgroups/user-context"
    const res = await this.client.post(
      url,
      { serviceAgreementId: this.serviceAgreementId },
      { headers: { ...this.getHeaders(true), "Content-Type": "application/json" } }
    )
    return res.status === 200 || res.status === 204 || !!res.data
  }

  async getInfo(): Promise<{ balance: number; accountId: string } | null> {
    if (!this.serviceAgreementId) {
      await this.getServiceAgreements()
      await this.setUserContext()
    }
    const url =
      "https://ocbomni.ocb.com.vn/api/arrangement-manager/client-api/v2/arrangement-views/account-overview/groups/current-account-vnd?_limit=100"
    const res = await this.client.get(url, { headers: this.getHeaders(true) })

    if (res.data?.elements) {
      for (const el of res.data.elements) {
        if (
          el.attributes?.bban?.value === this.accountNumber
        ) {
          this.accountId = el.id
          return {
            balance: parseInt(el.attributes.availableBalance.value, 10),
            accountId: el.id,
          }
        }
      }
    }
    return null
  }

  async getTransactions(fromDate: string, toDate: string, limit = 30): Promise<any[]> {
    if (!this.accountId) await this.getInfo()
    if (!this.accountId) return []

    const toDateExclusive = new Date(new Date(toDate).getTime() + 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0]
    const url = `https://ocbomni.ocb.com.vn/api/transaction-manager/client-api/v3/transactions?bookingDateGreaterThan=${fromDate}&bookingDateLessThan=${toDateExclusive}&arrangementsIds=${this.accountId}&from=0&size=${limit}&orderBy=bookingDate&direction=DESC`

    const res = await this.client.get(url, { headers: this.getHeaders(true) })
    if (res.data?.elements) {
      return res.data.elements.map((tx: any) => {
        const amount = parseFloat(tx.transactionAmountCurrency.amount)
        return {
          transactionID: tx.id,
          amount: Math.abs(amount),
          description: tx.description,
          transactionDate: tx.bookingDate,
          type: tx.creditDebitIndicator === "CRDT" || amount > 0 ? "IN" : "OUT",
        }
      })
    }
    return []
  }
}
