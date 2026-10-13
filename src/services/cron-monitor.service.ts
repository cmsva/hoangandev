/**
 * Cronjob monitoring service.
 *
 * - trackCronRun: cron route gọi để ghi last run vào MongoDB (best-effort).
 * - getCronStatuses: admin tab gọi để lấy catalog (đã điền URL + secret thật)
 *   + last run đã merge. Deposit được clone theo từng ngân hàng active.
 */
import { connectDB } from "@/lib/db"
import { CronRun, type ICronRun, type CronRunStatus } from "@/models/cron-run.model"
import { CRON_JOBS } from "@/constants/cron-jobs"
import { Bank } from "@/models/bank.model"
import { getCronSecretRaw } from "@/services/security-settings.service"

// ─── Side-effect: ghi last run (best-effort, không throw) ──────────────────

interface TrackCronRunArgs {
  key: string
  status: CronRunStatus
  durationMs: number
  message?: string
}

/**
 * Upsert bản ghi last-run của 1 cron job vào MongoDB.
 *
 * Best-effort: nuốt mọi lỗi để không làm hỏng cron chính.
 * Tự connectDB phòng trường hợp route chưa kết nối.
 */
export async function trackCronRun({
  key,
  status,
  durationMs,
  message = "",
}: TrackCronRunArgs): Promise<void> {
  try {
    await connectDB()
    await CronRun.updateOne(
      { key },
      {
        $set: {
          lastRunAt: new Date(),
          lastStatus: status,
          lastDurationMs: Math.max(0, Math.round(durationMs)),
          lastMessage: message.slice(0, 500),
        },
        $inc: { runCount: 1 },
      },
      { upsert: true }
    )
  } catch {
    // best-effort — bỏ qua lỗi tracking
  }
}

// ─── Repository + merge cho admin tab ──────────────────────────────────────

export interface CronStatusItem {
  /** Key job (deposit clone theo bank vẫn giữ key gốc để map last run) */
  key: string
  label: string
  description: string
  /** URL đầy đủ đã điền domain + secret (+ type nếu perBank) */
  url: string
  recommended: string
  /** Tên ngân hàng (chỉ có với job perBank) */
  bankName: string | null
  lastRunAt: string | null
  lastStatus: CronRunStatus | null
  lastDurationMs: number | null
  runCount: number
}

/** Lấy base URL từ env, bỏ dấu / cuối. Fallback rỗng → path tương đối. */
function getBaseUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_APP_URL || "").trim()
  return raw.replace(/\/+$/, "")
}

/**
 * Trả catalog cron job + last run (merge từ DB), đã điền URL + secret thật.
 * - Job perBank (deposit) clone 1 hàng cho mỗi ngân hàng active.
 * - Job chưa từng chạy → lastRunAt = null.
 */
export async function getCronStatuses(): Promise<CronStatusItem[]> {
  await connectDB()

  const [runs, secret, banks] = await Promise.all([
    CronRun.find({}).lean() as unknown as Promise<ICronRun[]>,
    getCronSecretRaw(),
    Bank.find({ status: 1 }).select("shortName").lean() as unknown as Promise<
      { shortName: string }[]
    >,
  ])

  const byKey = new Map(runs.map((r) => [r.key, r]))
  const base = getBaseUrl()
  const secretValue = secret || "<chưa-cấu-hình-secret>"

  const items: CronStatusItem[] = []

  for (const job of CRON_JOBS) {
    const run = byKey.get(job.key)
    const lastRun = {
      lastRunAt: run ? new Date(run.lastRunAt).toISOString() : null,
      lastStatus: run ? run.lastStatus : null,
      lastDurationMs: run ? run.lastDurationMs : null,
      runCount: run ? run.runCount : 0,
    }

    if (job.perBank) {
      // Clone 1 hàng cho mỗi ngân hàng active
      if (banks.length === 0) {
        // Chưa có bank nào → vẫn hiện 1 hàng mẫu với placeholder
        items.push({
          key: job.key,
          label: job.label,
          description: job.description,
          url: base + job.pathTemplate.replace("{type}", "<chưa-có-ngân-hàng>").replace("{secret}", secretValue),
          recommended: job.recommended,
          bankName: null,
          ...lastRun,
        })
      } else {
        for (const bank of banks) {
          items.push({
            key: job.key,
            label: job.label,
            description: job.description,
            url: base + job.pathTemplate.replace("{type}", bank.shortName).replace("{secret}", secretValue),
            recommended: job.recommended,
            bankName: bank.shortName,
            ...lastRun,
          })
        }
      }
    } else {
      items.push({
        key: job.key,
        label: job.label,
        description: job.description,
        url: base + job.pathTemplate.replace("{secret}", secretValue),
        recommended: job.recommended,
        bankName: null,
        ...lastRun,
      })
    }
  }

  return items
}
