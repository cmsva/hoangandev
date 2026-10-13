/**
 * GET /cmstdev/cron/deposit/check?type=<shortName>&secret=<token>
 *
 * Auto-check bank transactions và match với invoice pending.
 *
 * Idempotent: dùng markInvoicePaid với atomic Invoice {status: 0 → 1}.
 * Nếu callback chạy lại trên cùng invoice → 0 modifiedCount → skip.
 *
 * Response:
 *   { success: true, bank, totalIn, pending, matched, results }
 */
import { NextRequest, NextResponse } from "next/server"
import { Bank } from "@/models/bank.model"
import { Invoice } from "@/models/invoice.model"
import { fetchBankTransactions } from "@/services/bank-gateway.service"
import { markInvoicePaid } from "@/services/deposit.service"
import { verifyCronSecret } from "@/lib/cron-auth"
import { trackCronRun } from "@/services/cron-monitor.service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type CronResult = { status: number; body: Record<string, unknown> }

export async function GET(request: NextRequest) {
  // ─── Auth ─────────────────────────────────────────────────────────────
  const authError = await verifyCronSecret(request, "deposit")
  if (authError) return authError

  const startedAt = Date.now()
  try {
    const { status, body } = await runDepositCheck(request)
    await trackCronRun({
      key: "deposit",
      status: "success",
      durationMs: Date.now() - startedAt,
      message: JSON.stringify(body).slice(0, 300),
    })
    return NextResponse.json(body, { status })
  } catch (err) {
    await trackCronRun({
      key: "deposit",
      status: "error",
      durationMs: Date.now() - startedAt,
      message: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}

async function runDepositCheck(request: NextRequest): Promise<CronResult> {
  const bankType = request.nextUrl.searchParams.get("type")
  if (!bankType) {
    return { status: 400, body: { error: "Missing ?type=" } }
  }

  // ─── Find bank ────────────────────────────────────────────────────────
  const bank = await Bank.findOne({
    shortName: { $regex: new RegExp(`^${escapeRegex(bankType)}$`, "i") },
    status: 1,
  })

  if (!bank) {
    return { status: 404, body: { error: `Bank ${bankType} not found or disabled` } }
  }

  // ─── Fetch transactions từ provider ───────────────────────────────────
  const fetchResult = await fetchBankTransactions(bank)
  if (!fetchResult.ok) {
    return {
      status: 502,
      body: {
        error: `Bank error: ${fetchResult.msg || "Unknown"}`,
        otpRequired: fetchResult.otpRequired || false,
        otpUrl: fetchResult.otpUrl,
      },
    }
  }

  const inTxns = fetchResult.transactions.filter((tx) => tx.type === "IN")
  if (inTxns.length === 0) {
    return {
      status: 200,
      body: {
        success: true,
        bank: bank.shortName,
        totalIn: 0,
        pending: 0,
        matched: 0,
        message: "No IN transactions",
      },
    }
  }

  // ─── Get pending invoices của bank này ─────────────────────────────────
  const pendingInvoices = await Invoice.find({
    status: 0,
    gateway: bank.shortName,
  }).lean<any[]>()

  if (pendingInvoices.length === 0) {
    return {
      status: 200,
      body: {
        success: true,
        bank: bank.shortName,
        totalIn: inTxns.length,
        pending: 0,
        matched: 0,
        message: "No pending invoices",
      },
    }
  }

  // ─── Match invoice với transaction ─────────────────────────────────────
  const results: Array<{
    transId: string
    invoiceId: string
    finalAmount: number
    txAmount: number
    commission?: any
  }> = []
  let matched = 0

  for (const invoice of pendingInvoices) {
    const transId: string = invoice.transId
    if (!transId) continue

    const matchedTx = inTxns.find((tx) =>
      (tx.description || "").toUpperCase().includes(transId.toUpperCase())
    )
    if (!matchedTx) continue

    const txAmount = Number(matchedTx.amount) || 0
    // So với amount (số user phải chuyển), KHÔNG phải finalAmount —
    // finalAmount đã gồm bonus khuyến mãi, user chỉ chuyển đúng amount.
    if (txAmount < (invoice.amount || invoice.finalAmount)) continue

    // Delegate sang markInvoicePaid (atomic + AFF commission + plusCredit)
    const result = await markInvoicePaid({
      transId,
      paidAmount: txAmount,
      gatewayRef: matchedTx.transactionID || null,
    })

    if (result.success) {
      matched++
      results.push({
        transId,
        invoiceId: result.invoiceId,
        finalAmount: result.finalAmount,
        txAmount,
        commission: result.commission,
      })
    }
  }

  return {
    status: 200,
    body: {
      success: true,
      bank: bank.shortName,
      totalIn: inTxns.length,
      pending: pendingInvoices.length,
      matched,
      results,
    },
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
