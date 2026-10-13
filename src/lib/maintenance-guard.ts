/**
 * Maintenance guard — shared helper for tRPC + REST API.
 *
 * Khi `maintenance_mode === "1"` trong settings:
 *   - Mọi request từ user không phải admin sẽ bị reject với 503.
 *   - Admin (admin === 1) vẫn truy cập bình thường để tắt maintenance.
 *
 * Áp dụng:
 *   - tRPC `protectedProcedure` — middleware
 *   - REST `withApiAuth` / `withApiPublic` — block ngay sau auth (agency
 *     không có admin → block tất cả).
 */
import { TRPCError } from "@trpc/server"
import { getSecurityConfig } from "@/lib/security-config"

/**
 * Throw SERVICE_UNAVAILABLE nếu maintenance đang bật và caller không phải admin.
 *
 * @param opts.isAdmin - true nếu caller là admin (admin === 1). Default false.
 *                       Public endpoint không có thông tin admin → block.
 */
export async function assertNotMaintenance(opts: { isAdmin?: boolean } = {}): Promise<void> {
  let cfg: { maintenanceMode: boolean } | null = null
  try {
    cfg = await getSecurityConfig()
  } catch {
    // Lỗi load config → cho phép qua để tránh block toàn site khi DB lỗi.
    return
  }
  if (!cfg?.maintenanceMode) return
  if (opts.isAdmin) return
  throw new TRPCError({
    code: "SERVICE_UNAVAILABLE",
    message: "Hệ thống đang bảo trì. Vui lòng quay lại sau ít phút.",
  })
}
