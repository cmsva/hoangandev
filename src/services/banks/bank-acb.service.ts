

const CLIENT_ID = "iuSuHYVufIUuNIREV0FB9EoLn9kHsDbm"
const FETCH_TIMEOUT = 15_000

const BASE_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  Host: "apiapp.acb.com.vn",
  Connection: "keep-alive",
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.26 Safari/537.36 Edg/85.0.564.13",
}

export interface ACBLoginResult {
  accessToken?: string
  [key: string]: any
}

export class BankACB {
  async login(username: string, password: string): Promise<ACBLoginResult | null> {
    try {
      const res = await fetch("https://apiapp.acb.com.vn/mb/v2/auth/tokens", {
        method: "POST",
        headers: BASE_HEADERS,
        body: JSON.stringify({ clientId: CLIENT_ID, username, password }),
        signal: AbortSignal.timeout(FETCH_TIMEOUT),
      })
      return (await res.json()) as ACBLoginResult
    } catch {
      return null
    }
  }

  async getTransactionHistory(
    accountNo: string,
    maxRows: number,
    accessToken: string
  ): Promise<any> {
    try {
      const url = `https://apiapp.acb.com.vn/mb/legacy/ss/cs/bankservice/saving/tx-history?maxRows=${maxRows}&account=${accountNo}`
      const res = await fetch(url, {
        method: "GET",
        headers: { ...BASE_HEADERS, Authorization: `bearer ${accessToken}` },
        signal: AbortSignal.timeout(FETCH_TIMEOUT),
      })
      return await res.json()
    } catch {
      return null
    }
  }

  /**
   * Normalize raw response → mảng {transactionID, amount, description, transactionDate, type}.
   * Trả null nếu raw lỗi hoặc rỗng.
   */
  normalizeTransactions(rawData: any): any[] | null {
    if (!rawData || rawData.codeStatus !== 200 || !rawData.data) return null

    const transactions = (rawData.data as any[]).map((trans) => ({
      transactionID: trans.transactionNumber || "",
      amount: trans.amount || 0,
      description: trans.description || "",
      transactionDate: trans.effectiveDate
        ? new Date(trans.effectiveDate).toLocaleString("vi-VN")
        : "",
      type: trans.type || "",
    }))

    return transactions.sort((a, b) =>
      String(b.transactionID).localeCompare(String(a.transactionID))
    )
  }
}
