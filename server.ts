/**
 * Custom Next.js server — Next.js + Socket.IO chung 1 process, 1 port.
 *
 * Production: `npm start` (tsx server.ts, NODE_ENV=production).
 * Dev có socket: `npm run dev:socket`. Dev UI thuần (Turbopack): `npm run dev`.
 *
 * ⚠ QUAN TRỌNG — thứ tự nạp env:
 *   tsx KHÔNG tự load .env. Mà db.ts đọc MONGODB_URI và io.ts đọc JWT_SECRET ngay
 *   ở top-level (lúc import). Vì ESM hoist static import (chạy trước thân module),
 *   nếu import tĩnh các module đó thì chúng đọc process.env khi .env CHƯA nạp →
 *   MONGODB_URI undefined (throw) và JWT_SECRET = "" (auth socket hỏng âm thầm).
 *
 *   Giải pháp:
 *     1. Static import DUY NHẤT @next/env (không phụ thuộc .env của ta).
 *     2. Gọi loadEnvConfig() ngay — nạp .env vào process.env.
 *     3. Dynamic import phần còn lại (next, socket, db) SAU khi env đã sẵn sàng.
 *
 * server.ts + src/socket/io.ts chỉ dùng RELATIVE import + npm package (không @/)
 * để tsx resolve được khi chạy ngoài bundler Next.
 */
import { createRequire } from "node:module"

const dev = process.env.NODE_ENV !== "production"

// @next/env là CommonJS — Node ESM không detect được named export qua static import.
// Dùng createRequire để load chắc chắn.
const require = createRequire(import.meta.url)
const { loadEnvConfig } = require("@next/env") as typeof import("@next/env")

// Nạp biến môi trường từ .env vào process.env NGAY, trước mọi import khác.
loadEnvConfig(process.cwd(), dev)

async function main() {
  const { createServer } = await import("node:http")
  const { parse } = await import("node:url")
  const { default: next } = await import("next")
  const { initSocketIO } = await import("./src/socket/io")
  const { connectDB } = await import("./src/lib/db")

  const hostname = process.env.HOSTNAME || "0.0.0.0"
  const port = parseInt(process.env.PORT || "3000", 10)

  const app = next({ dev, hostname, port })
  const handle = app.getRequestHandler()

  await app.prepare()

  const server = createServer((req, res) => {
    try {
      const parsedUrl = parse(req.url || "/", true)
      handle(req, res, parsedUrl)
    } catch (err) {
      console.error("[server] request error", err)
      res.statusCode = 500
      res.end("Internal Server Error")
    }
  })

  // Gắn Socket.IO vào cùng HTTP server (cùng port với Next).
  initSocketIO(server)

  // Kết nối MongoDB sớm để socket verify được quyền sở hữu ticket (join_ticket).
  // Fail-soft: DB chưa lên → join_ticket từ chối (an toàn) cho tới khi reconnect.
  connectDB().catch((err) => {
    console.error("[server] initial DB connect failed (socket ticket-auth degraded)", err)
  })

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port} (dev=${dev}) — socket attached`)
  })
}

main().catch((err) => {
  console.error("[server] fatal startup error", err)
  process.exit(1)
})
