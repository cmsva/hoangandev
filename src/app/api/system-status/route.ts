/**
 * System Status API — returns real CPU, RAM, Disk, Uptime, and system info.
 * Works on both Windows (wmic) and Linux/macOS (df) servers.
 *
 * Auth: chỉ admin được gọi. Trả 403 nếu không phải admin.
 */
import { NextResponse } from "next/server"
import os from "os"
import { exec } from "child_process"
import { promisify } from "util"
import { cookies } from "next/headers"
import { verifyToken, getCurrentUser } from "@/services/auth.service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const execAsync = promisify(exec)

interface DiskInfo {
  total: number
  used: number
  free: number
  percent: number
}

async function getDiskInfo(): Promise<DiskInfo> {
  try {
    const platform = os.platform()
    if (platform === "win32") {
      const { stdout } = await execAsync(
        'wmic logicaldisk where "DriveType=3" get Size,FreeSpace /format:csv',
        { timeout: 5000 }
      )
      const lines = stdout
        .trim()
        .split("\n")
        .filter((l) => l.trim() && !l.startsWith("Node"))
      let totalAll = 0
      let freeAll = 0
      for (const line of lines) {
        const parts = line.trim().split(",")
        if (parts.length >= 3) {
          const free = parseInt(parts[1]) || 0
          const total = parseInt(parts[2]) || 0
          totalAll += total
          freeAll += free
        }
      }
      return {
        total: totalAll,
        free: freeAll,
        used: totalAll - freeAll,
        percent: totalAll > 0 ? Math.round(((totalAll - freeAll) / totalAll) * 100) : 0,
      }
    } else {
      // Linux / macOS — POSIX df, root filesystem
      const { stdout } = await execAsync("df -B1 / | tail -1", { timeout: 5000 })
      const parts = stdout.trim().split(/\s+/)
      const total = parseInt(parts[1]) || 0
      const used = parseInt(parts[2]) || 0
      const free = parseInt(parts[3]) || 0
      return {
        total,
        used,
        free,
        percent: total > 0 ? Math.round((used / total) * 100) : 0,
      }
    }
  } catch {
    return { total: 0, used: 0, free: 0, percent: 0 }
  }
}

function getCpuUsage(): Promise<number> {
  const cpus1 = os.cpus()
  return new Promise((resolve) => {
    setTimeout(() => {
      const cpus2 = os.cpus()
      let totalIdle = 0
      let totalTick = 0
      for (let i = 0; i < cpus2.length; i++) {
        const c1 = cpus1[i].times
        const c2 = cpus2[i].times
        const idle = c2.idle - c1.idle
        const total =
          c2.user - c1.user +
          (c2.nice - c1.nice) +
          (c2.sys - c1.sys) +
          (c2.idle - c1.idle) +
          (c2.irq - c1.irq)
        totalIdle += idle
        totalTick += total
      }
      const percent = totalTick > 0 ? Math.round(((totalTick - totalIdle) / totalTick) * 100) : 0
      resolve(percent)
    }, 200)
  })
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes"
  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

async function getKernelVersion(): Promise<string> {
  try {
    if (os.platform() === "win32") return os.release()
    const { stdout } = await execAsync("uname -r", { timeout: 3000 })
    return stdout.trim()
  } catch {
    return os.release()
  }
}

async function ensureAdmin() {
  const cookieStore = await cookies()
  const token = cookieStore.get("token")?.value
  if (!token) return false
  const payload = verifyToken(token)
  if (!payload) return false
  const user = await getCurrentUser(payload.sub)
  return Boolean(user && user.admin === 1 && user.banned !== 1)
}

export async function GET() {
  if (!(await ensureAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const [cpuPercent, disk, kernel] = await Promise.all([
      getCpuUsage(),
      getDiskInfo(),
      getKernelVersion(),
    ])

    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    const usedMem = totalMem - freeMem
    const ramPercent = Math.round((usedMem / totalMem) * 100)

    const cpuModel = os.cpus()[0]?.model || "Unknown CPU"
    const cpuCores = os.cpus().length
    const uptime = os.uptime()
    const hostname = os.hostname()
    const platform = `${os.platform()} (${os.arch()})`

    return NextResponse.json({
      cpu: { percent: cpuPercent, model: cpuModel, cores: cpuCores },
      ram: {
        percent: ramPercent,
        used: formatBytes(usedMem),
        total: formatBytes(totalMem),
      },
      disk: {
        percent: disk.percent,
        used: formatBytes(disk.used),
        free: formatBytes(disk.free),
        total: formatBytes(disk.total),
      },
      uptime: { formatted: formatUptime(uptime), seconds: uptime },
      system: {
        hostname,
        platform,
        kernel,
        nodeVersion: process.version,
      },
    })
  } catch (error) {
    console.error("System status error:", error)
    return NextResponse.json({ error: "Failed to get system status" }, { status: 500 })
  }
}
