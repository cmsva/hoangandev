/**
 * Next.js instrumentation hook — chạy 1 lần khi server start.
 * Khởi động cron engine + web-create worker theo env.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  const { startCronEngine } = await import("./lib/cron-engine")
  await startCronEngine()
  const { startWebCreateWorker } = await import("./lib/web-create-worker")
  await startWebCreateWorker()
}
