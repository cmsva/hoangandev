import crypto from "node:crypto"
import https from "node:https"
import { constants as cryptoConstants } from "node:crypto"
import axios, { AxiosError } from "axios"
import { TRPCError } from "@trpc/server"
import { deployDebug, deployDebugError } from "@/lib/deploy-debug"

export interface AaPanelCredentials {
  panelUrl: string
  apiKey: string
}

export interface AaPanelSiteInput {
  domain: string
  path: string
  phpVersion: string
  dbName?: string
  dbUser?: string
  dbPassword?: string
  note?: string
}

export interface AaPanelRealtimeStats {
  cpuPercent: number
  ramPercent: number
  diskPercent: number
  websiteCount: number
  loadAverage: string | null
  loadStatus: string | null
  uptime: string | null
  os: string | null
  panelVersion: string | null
  cpuInfo: string | null
  memoryUsed: string | null
  memoryTotal: string | null
  diskUsed: string | null
  diskTotal: string | null
  networkUp: string | null
  networkDown: string | null
  raw: unknown
}

function md5(value: string): string {
  return crypto.createHash("md5").update(value).digest("hex")
}

function token(apiKey: string): Record<string, string> {
  const requestTime = Math.floor(Date.now() / 1000).toString()
  return { request_time: requestTime, request_token: md5(requestTime + md5(apiKey)) }
}

/**
 * Validate panelUrl trước khi gọi aaPanel API.
 *
 * aaPanel quirk: typically chạy trên port lạ (7800/8888) với self-signed cert,
 * có thể trên private IP (VPS internal network). Admin tự chịu trách nhiệm
 * IP whitelist trên aaPanel UI để ngăn unauthorized access.
 *
 * Validate ở layer này:
 *  - Phải parse được URL
 *  - Protocol http/https only
 *  - Length cap để chặn payload bất thường
 *  - Reject userinfo (no `user:pass@host` smuggling)
 *
 * KHÔNG block private IP — admin có thể intentionally trỏ panel nội bộ.
 */
export function validatePanelUrl(raw: string): { ok: true; url: URL } | { ok: false; reason: string } {
  if (!raw || raw.length > 512) return { ok: false, reason: "Panel URL không hợp lệ hoặc quá dài" }
  let u: URL
  try {
    u = new URL(raw.trim())
  } catch {
    return { ok: false, reason: "Panel URL không hợp lệ" }
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { ok: false, reason: "Chỉ chấp nhận http hoặc https" }
  }
  if (u.username || u.password) {
    return { ok: false, reason: "Panel URL không được chứa username/password" }
  }
  if (!u.hostname) return { ok: false, reason: "Panel URL thiếu hostname" }
  return { ok: true, url: u }
}

function normalizePanelUrl(panelUrl: string): string {
  return panelUrl.trim().replace(/\/+$/, "")
}

const insecureHttpsAgent = new https.Agent({
  rejectUnauthorized: false,
  secureOptions: cryptoConstants.SSL_OP_LEGACY_SERVER_CONNECT,
})

function parsePanelResponse(data: unknown): Record<string, unknown> {
  if (typeof data === "object" && data !== null) return data as Record<string, unknown>
  if (typeof data !== "string") return { raw: data }

  const trimmed = data.trim()
  if (trimmed.startsWith("<!") || trimmed.startsWith("<html")) {
    throw new TRPCError({ code: "BAD_GATEWAY", message: "aaPanel không phản hồi JSON" })
  }
  try {
    return JSON.parse(trimmed) as Record<string, unknown>
  } catch {
    return { status: trimmed === "1" || /^true|ok|success$/i.test(trimmed), raw: trimmed }
  }
}
async function post<T = Record<string, unknown>>(
  credentials: AaPanelCredentials,
  uri: string,
  data: Record<string, string | number | boolean> = {},
  timeoutMs = 60_000
): Promise<T> {
  const signed = { ...token(credentials.apiKey), ...data }
  const body = new URLSearchParams()
  for (const [key, value] of Object.entries(signed)) body.set(key, String(value))
  const url = `${normalizePanelUrl(credentials.panelUrl)}${uri}`

  deployDebug("aapanel", `→ POST ${uri}`, { url, data })
  const startedAt = Date.now()

  try {
    const res = await axios.post(url, body.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: timeoutMs,
      validateStatus: () => true,
      transformResponse: [(value) => value],
      httpsAgent: url.startsWith("https") ? insecureHttpsAgent : undefined,
    })
    if (res.status >= 400) {
      deployDebug("aapanel", `← HTTP ${res.status} ${uri}`, {
        uri,
        httpStatus: res.status,
        durationMs: Date.now() - startedAt,
        rawBody: typeof res.data === "string" ? res.data.slice(0, 1000) : res.data,
      })
      throw new TRPCError({ code: "BAD_GATEWAY", message: `aaPanel HTTP ${res.status}` })
    }
    const parsed = parsePanelResponse(res.data)
    deployDebug("aapanel", `← OK ${uri}`, {
      uri,
      httpStatus: res.status,
      durationMs: Date.now() - startedAt,
      parsed,
    })
    if (parsed.status === false || parsed.status === 0) {
      const message = String(parsed.msg ?? parsed.message ?? "aaPanel từ chối yêu cầu")
      deployDebug("aapanel", `✖ aaPanel rejected ${uri}`, { uri, message, parsed })
      throw new TRPCError({ code: "BAD_GATEWAY", message })
    }
    return parsed as T
  } catch (error) {
    if (error instanceof TRPCError) throw error
    if (error instanceof AxiosError) {
      const sslCodes = new Set(["CERT_HAS_EXPIRED", "DEPTH_ZERO_SELF_SIGNED_CERT", "ERR_TLS_CERT_ALTNAME_INVALID", "ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR", "EPROTO", "UNABLE_TO_VERIFY_LEAF_SIGNATURE"])
      const message = error.message || ""
      deployDebugError("aapanel", `network error ${uri}`, error, { uri, code: error.code, durationMs: Date.now() - startedAt })
      if (error.code === "ECONNREFUSED") throw new TRPCError({ code: "BAD_GATEWAY", message: "Không kết nối được aaPanel" })
      if (error.code === "ETIMEDOUT" || error.code === "ECONNABORTED") throw new TRPCError({ code: "BAD_GATEWAY", message: "Kết nối aaPanel timeout" })
      if (error.code === "ENOTFOUND") throw new TRPCError({ code: "BAD_GATEWAY", message: "Không tìm thấy host aaPanel" })
      if (sslCodes.has(error.code ?? "") || /certificate|ssl|tls|wrong version number/i.test(message)) {
        throw new TRPCError({ code: "BAD_GATEWAY", message: "Lỗi SSL aaPanel. Hãy dùng đúng http/https và port aaPanel" })
      }
    } else {
      deployDebugError("aapanel", `unknown error ${uri}`, error, { uri, durationMs: Date.now() - startedAt })
    }
    throw new TRPCError({ code: "BAD_GATEWAY", message: "Không kết nối được aaPanel" })
  }
}

function percent(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.min(100, Math.round(value)))
  const match = String(value ?? "").match(/([0-9]+(?:\.[0-9]+)?)/)
  return match ? percent(Number(match[1])) : 0
}

function toBytes(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  const raw = String(value ?? "").toLowerCase().replace(/,/g, "")
  const match = raw.match(/([0-9]+(?:\.[0-9]+)?)/)
  const n = match ? Number(match[1]) : 0
  if (raw.includes("tb") || /\bt\b/.test(raw)) return n * 1024 ** 4
  if (raw.includes("gb") || /\bg\b/.test(raw)) return n * 1024 ** 3
  if (raw.includes("mb") || /\bm\b/.test(raw)) return n * 1024 ** 2
  if (raw.includes("kb") || /\bk\b/.test(raw)) return n * 1024
  return n
}

function percentFromUsedTotal(used: unknown, total: unknown): number | null {
  const totalBytes = toBytes(total)
  if (totalBytes <= 0) return null
  return percent((toBytes(used) / totalBytes) * 100)
}

function stringOrNull(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null
  return String(value)
}

function pickString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = stringOrNull(source[key])
    if (value) return value
  }
  return null
}

function pickRecord(source: Record<string, unknown>, keys: string[]): Record<string, unknown> | null {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === "object" && value !== null && !Array.isArray(value)) return value as Record<string, unknown>
  }
  return null
}

function pickLoadAverage(...sources: Record<string, unknown>[]): string | null {
  for (const source of sources) {
    const direct = pickString(source, ["loadAverage", "load_average", "loadavg", "loadAvg", "load"])
    if (direct) return direct
    const one = source.one ?? source.loadOne ?? source.load1 ?? source.load_1 ?? source.lavg_1
    const five = source.five ?? source.loadFive ?? source.load5 ?? source.load_5 ?? source.lavg_5
    const fifteen = source.fifteen ?? source.loadFifteen ?? source.load15 ?? source.load_15 ?? source.lavg_15
    if (one !== undefined && five !== undefined && fifteen !== undefined) return `${one} / ${five} / ${fifteen}`
  }
  return null
}

export async function aaPanelPing(credentials: AaPanelCredentials): Promise<Record<string, unknown>> {
  return post(credentials, "/system?action=GetSystemTotal", {}, 15_000)
}
export async function aaPanelAddSite(credentials: AaPanelCredentials, input: AaPanelSiteInput) {
  const webname = JSON.stringify({ domain: input.domain, domainlist: [], count: 0 })
  const data: Record<string, string> = {
    webname,
    path: input.path,
    type_id: "0",
    type: "PHP",
    version: input.phpVersion,
    port: "80",
    ps: input.note || input.domain,
    ftp: "false",
    sql: input.dbUser ? "MySQL" : "false",
    codeing: "utf8mb4",
  }
  if (input.dbUser && input.dbName && input.dbPassword) {
    data.dataname = input.dbName
    data.name = input.dbName
    data.datauser = input.dbUser
    data.datapassword = input.dbPassword
  }
  return post(credentials, "/site?action=AddSite", data)
}

export async function aaPanelApplySsl(credentials: AaPanelCredentials, domain: string, siteId: number) {
  // Payload chuẩn của /acme?action=apply_cert_api (acme_v2.py): domains + auth_type
  // + auth_to (site ID) + id + auto_wildcard. auth_to là tham số bắt buộc mà bản
  // cũ thiếu → panel không gắn cert vào đúng site.
  return post(credentials, "/acme?action=apply_cert_api", {
    domains: JSON.stringify([domain]),
    auth_type: "http",
    auth_to: String(siteId),
    auto_wildcard: "0",
    id: String(siteId),
  })
}

export async function aaPanelUploadFile(
  credentials: AaPanelCredentials,
  remotePath: string,
  fileUrl: string,
  remoteFilename: string
) {
  return post(credentials, "/files?action=download", {
    path: remotePath,
    url: fileUrl,
    filename: remoteFilename,
  }, 900_000)
}

/** Tạo thư mục trên server aaPanel (idempotent — đã tồn tại vẫn trả ok). */
export async function aaPanelCreateDir(credentials: AaPanelCredentials, dirPath: string) {
  return post(credentials, "/files?action=CreateDir", { path: dirPath })
}

/**
 * Upload 1 buffer file THẲNG lên server aaPanel (port `/files?action=upload`).
 *
 * Khác aaPanelUploadFile (bảo aaPanel tự tải từ URL): hàm này đẩy nội dung file
 * từ Next server lên aaPanel qua multipart. Dùng cho luồng "admin upload ZIP →
 * lưu thẳng trên VPS" để deploy giải nén local, không phụ thuộc tải mạng.
 *
 * aaPanel upload nhận: f_path (dir), f_name, f_size, f_start (offset), blob.
 * Single-shot (f_start=0). Trả raw response để caller kiểm tra.
 */
export async function aaPanelUploadLocalFile(
  credentials: AaPanelCredentials,
  dirPath: string,
  filename: string,
  buffer: Buffer
): Promise<Record<string, unknown>> {
  const auth = token(credentials.apiKey)
  const url = `${normalizePanelUrl(credentials.panelUrl)}/files?action=upload`

  // aaPanel 8.0.1 chunked upload: gửi từng mảnh ~2MB với f_start tăng dần.
  // Panel ghép lại phía server. Đây là cách UI aaPanel upload file lớn.
  const CHUNK_SIZE = 2 * 1024 * 1024 // 2MB
  const totalSize = buffer.length
  const totalChunks = Math.ceil(totalSize / CHUNK_SIZE)

  deployDebug("aapanel", `→ UPLOAD /files?action=upload (chunked)`, {
    url,
    dirPath,
    filename,
    sizeBytes: totalSize,
    chunks: totalChunks,
    chunkSize: CHUNK_SIZE,
  })

  let lastParsed: Record<string, unknown> = {}
  for (let i = 0; i < totalChunks; i += 1) {
    const start = i * CHUNK_SIZE
    const end = Math.min(start + CHUNK_SIZE, totalSize)
    const chunk = buffer.subarray(start, end)
    const blob = new Blob([new Uint8Array(chunk)], { type: "application/octet-stream" })

    const form = new FormData()
    form.set("request_time", auth.request_time)
    form.set("request_token", auth.request_token)
    form.set("path", dirPath)
    form.set("f_path", dirPath)
    form.set("f_name", filename)
    form.set("f_size", String(totalSize))
    form.set("f_start", String(start))
    form.set("blob", blob, filename)

    const startedAt = Date.now()
    try {
      const res = await axios.post(url, form, {
        timeout: 120_000,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        validateStatus: () => true,
        transformResponse: [(value) => value],
        httpsAgent: url.startsWith("https") ? insecureHttpsAgent : undefined,
      })
      lastParsed = parsePanelResponse(res.data)

      if (i === totalChunks - 1) {
        // Chunk cuối cùng — log kết quả.
        deployDebug("aapanel", `← UPLOAD chunked done`, {
          chunks: totalChunks,
          httpStatus: res.status,
          durationMs: Date.now() - startedAt,
          parsed: lastParsed,
        })
      }

      // aaPanel 8.0.1 bug: trả status -1 kèm error "dict_obj has no attribute 'f_size'"
      // NHƯNG file vẫn được lưu → không throw ở giữa, tiếp tục gửi chunk.
      // Chỉ throw nếu HTTP 4xx/5xx rõ ràng (panel chặn hoàn toàn).
      if (res.status >= 400 && res.status !== 404) {
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: `Upload chunk ${i + 1}/${totalChunks} lỗi HTTP ${res.status}: ${JSON.stringify(lastParsed).slice(0, 200)}`,
        })
      }
    } catch (error) {
      if (error instanceof TRPCError) throw error
      deployDebugError("aapanel", `upload chunk error`, error, {
        dirPath,
        filename,
        chunk: `${i + 1}/${totalChunks}`,
        offset: start,
      })
      throw new TRPCError({
        code: "BAD_GATEWAY",
        message: `Upload chunk ${i + 1}/${totalChunks} thất bại: ${error instanceof Error ? error.message : String(error)}`,
      })
    }
  }

  return { ...lastParsed, uploadMethod: "chunked", chunks: totalChunks }
}

export async function aaPanelDecompress(credentials: AaPanelCredentials, zipPath: string, toPath: string) {
  return post(credentials, "/files?action=UnZip", {
    sfile: zipPath,
    dfile: toPath,
    type: "zip",
    coding: "UTF-8",
  }, 900_000)
}

/**
 * Kiểm tra 1 file đã tồn tại trong thư mục trên aaPanel chưa (port remoteFileExists).
 * aaPanel trả về cấu trúc khác nhau giữa các phiên bản → quét nhiều key.
 */
export async function aaPanelRemoteFileExists(
  credentials: AaPanelCredentials,
  dirPath: string,
  filename: string
): Promise<boolean> {
  const base = filename.split("/").pop() || filename
  try {
    const res = (await post(credentials, "/files?action=GetDir", { path: dirPath })) as Record<string, unknown>
    for (const key of ["FILES", "FILE", "DIR", "R_DIR", "data", "list"]) {
      const arr = res[key]
      if (!Array.isArray(arr)) continue
      for (const item of arr) {
        // aaPanel có thể trả mảng string "name;size;..." hoặc object.
        if (typeof item === "string") {
          const name = item.split(";")[0]?.split("/").pop()
          if (name === base) return true
        } else if (item && typeof item === "object") {
          const obj = item as Record<string, unknown>
          for (const nameKey of ["name", "filename", "fileName"]) {
            const v = obj[nameKey]
            if (typeof v === "string" && (v.split("/").pop() === base)) return true
          }
        }
      }
    }
  } catch {
    return false
  }
  return false
}

/**
 * Đọc SIZE (bytes) của 1 file trên aaPanel qua GetDir. Trả -1 nếu không thấy.
 *
 * aaPanel trả FILES dạng "name;size;mtime;perm;owner;...". Dùng để verify file
 * ZIP đã upload ĐỦ byte (size khớp) trước khi giải nén — tránh giải nén file
 * còn ghi dở (nguyên nhân fail file lớn: poll thấy tên file nhưng chưa ghi xong).
 */
export async function aaPanelRemoteFileSize(
  credentials: AaPanelCredentials,
  dirPath: string,
  filename: string
): Promise<number> {
  const base = filename.split("/").pop() || filename
  try {
    const res = (await post(credentials, "/files?action=GetDir", { path: dirPath })) as Record<string, unknown>
    for (const key of ["FILES", "FILE"]) {
      const arr = res[key]
      if (!Array.isArray(arr)) continue
      for (const item of arr) {
        if (typeof item !== "string") continue
        const parts = item.split(";")
        const name = parts[0]?.split("/").pop()
        if (name === base) {
          const size = Number(parts[1])
          return Number.isFinite(size) ? size : -1
        }
      }
    }
  } catch {
    return -1
  }
  return -1
}

/**
 * Liệt kê TÊN FILE trong 1 thư mục trên aaPanel. Trả mảng tên (basename only).
 * Dùng để: (1) clean dir trước khi upload source, (2) verify đã giải nén xong
 * (file count tăng sau UnZip) thay vì xóa zip mù mờ.
 */
export async function aaPanelListDir(
  credentials: AaPanelCredentials,
  dirPath: string
): Promise<string[]> {
  const names: string[] = []
  try {
    const res = (await post(credentials, "/files?action=GetDir", { path: dirPath })) as Record<string, unknown>
    for (const key of ["FILES", "FILE"]) {
      const arr = res[key]
      if (!Array.isArray(arr)) continue
      for (const item of arr) {
        if (typeof item !== "string") continue
        const name = item.split(";")[0]?.split("/").pop()
        if (name) names.push(name)
      }
    }
    // aaPanel cũng trả thư mục con ở DIR — bỏ qua hay gồm? Gồm để đếm tổng.
    const dirArr = res.DIR
    if (Array.isArray(dirArr)) {
      for (const item of dirArr) {
        if (typeof item !== "string") continue
        const name = item.split(";")[0]?.split("/").pop()
        if (name) names.push(name)
      }
    }
  } catch {
    return names
  }
  return names
}
export async function aaPanelExecShell(credentials: AaPanelCredentials, shell: string) {
  return post(credentials, "/system?action=ExecShell", { shell }, 900_000)
}

/** Set ngày hết hạn website (port `setSiteExpiry`). Date format: YYYY-MM-DD hoặc 0000-00-00 = vĩnh viễn. */
export async function aaPanelSetSiteExpiry(
  credentials: AaPanelCredentials,
  siteId: number,
  edate: string
) {
  return post(credentials, "/site?action=SetEdate", { id: String(siteId), edate })
}

/** Tạo database riêng (khi addSite không tạo cùng). Port `createDatabase`. */
export async function aaPanelCreateDatabase(
  credentials: AaPanelCredentials,
  dbName: string,
  dbUser: string,
  dbPass: string,
  encoding = "utf8mb4"
) {
  return post(credentials, "/database?action=AddDatabase", {
    name: dbName,
    datauser: dbUser,
    password: dbPass,
    codeing: encoding,
    address: "%",
    ps: dbUser,
  })
}

/** Copy file/thư mục trên server (port `copyFile`). Dùng cho source_type=copy. */
export async function aaPanelCopyFile(
  credentials: AaPanelCredentials,
  sfile: string,
  dfile: string
) {
  return post(credentials, "/files?action=CopyFile", { sfile, dfile })
}


export async function aaPanelGetFile(credentials: AaPanelCredentials, path: string): Promise<{ data?: string; status?: boolean; raw?: unknown }> {
  return post(credentials, "/files?action=GetFileBody", { path })
}

export async function aaPanelSaveFile(credentials: AaPanelCredentials, path: string, content: string) {
  return post(credentials, "/files?action=SaveFileBody", { path, data: content, encoding: "utf-8" })
}

export async function aaPanelSetFilePermission(credentials: AaPanelCredentials, path: string, user = "www", permission = "755") {
  return post(credentials, "/files?action=SetFileAccess", { filename: path, user, access: permission })
}

/** Xoá file/thư mục trên server qua aaPanel (port deleteFile của source PHP cũ). */
export async function aaPanelDeleteFile(credentials: AaPanelCredentials, path: string) {
  return post(credentials, "/files?action=DeleteFile", { path })
}

export async function aaPanelImportSql(credentials: AaPanelCredentials, dbName: string, sqlPath: string) {
  return post(credentials, "/database?action=InputSql", { name: dbName, file: sqlPath }, 900_000)
}

export async function aaPanelStartSite(credentials: AaPanelCredentials, siteId: number, siteName: string) {
  return post(credentials, "/site?action=SiteStart", { id: String(siteId), name: siteName })
}

export async function aaPanelStopSite(credentials: AaPanelCredentials, siteId: number, siteName: string) {
  return post(credentials, "/site?action=SiteStop", { id: String(siteId), name: siteName })
}

/** Xóa website trên aaPanel (site + path + database/ftp nếu panel hỗ trợ). */
export async function aaPanelDeleteSite(credentials: AaPanelCredentials, siteId: number, siteName: string, path?: string | null) {
  return post(credentials, "/site?action=DeleteSite", {
    id: String(siteId),
    webname: siteName,
    ftp: "1",
    database: "1",
    path: "1",
    ...(path ? { sitepath: path } : {}),
  })
}

export async function aaPanelGetRealtimeStats(credentials: AaPanelCredentials): Promise<AaPanelRealtimeStats> {
  const [system, disks, sites, network, loadAverage] = await Promise.all([
    post<Record<string, unknown>>(credentials, "/system?action=GetSystemTotal", {}, 15_000),
    post<Array<Record<string, unknown>>>(credentials, "/system?action=GetDiskInfo", {}, 15_000).catch(() => []),
    post<Record<string, unknown>>(credentials, "/data?action=getData", { table: "sites", p: 1, limit: 1 }, 15_000).catch(() => ({})),
    post<Record<string, unknown>>(credentials, "/system?action=GetNetWork", {}, 15_000).catch(() => ({})),
    post<Record<string, unknown>>(credentials, "/system?action=GetLoadAverage", {}, 15_000).catch(() => ({})),
  ])

  const networkMemory = pickRecord(network, ["mem", "memory"])
  const memory = pickRecord(system, ["mem", "memory"]) ?? networkMemory
  const ramPercent = percentFromUsedTotal(system.memRealUsed ?? system.memUsed ?? memory?.memRealUsed ?? memory?.used, system.memTotal ?? memory?.memTotal ?? memory?.total)
    ?? percent(system.memPercent ?? system.memUsedPercent ?? memory?.percent)

  const networkStats = network as Record<string, unknown>
  let diskPercent = percent(system.diskPercent)
  const networkDisks = Array.isArray(networkStats.disk) ? networkStats.disk as Array<Record<string, unknown>> : []
  const diskList = Array.isArray(disks) && disks.length > 0 ? disks : networkDisks
  const root = diskList.find((d) => d.path === "/") ?? diskList[0]
  const size = root?.size
  if (diskPercent === 0 && Array.isArray(size)) diskPercent = percent(String(size[3] ?? "")) || percentFromUsedTotal(size[1], size[0]) || 0

  const networkCpu = Array.isArray(networkStats.cpu) ? networkStats.cpu : []
  const cpuPercent = percent(system.cpuRealUsed ?? system.cpuPercent ?? networkCpu[0] ?? system.cpu)
  const siteStats = sites as Record<string, unknown>
  const siteData = Array.isArray(siteStats.data) ? siteStats.data : []
  const siteTotal = Number(networkStats.site_total ?? system.siteCount ?? siteStats.count ?? siteStats.total ?? siteData.length ?? 0) || 0

  return {
    cpuPercent,
    ramPercent,
    diskPercent,
    websiteCount: siteTotal,
    loadAverage: pickLoadAverage(loadAverage, pickRecord(network, ["load"]) ?? {}, network, system),
    loadStatus: pickString(loadAverage, ["status", "loadStatus", "load_status", "loadStatusText", "load_status_text", "loadState"])
      ?? pickString(system, ["loadStatus", "load_status", "loadStatusText", "load_status_text", "loadState"]),
    uptime: pickString(network, ["time", "uptime", "runningTime"]) ?? pickString(system, ["time", "uptime", "runningTime"]),
    os: pickString(network, ["system", "os", "platform", "title"]) ?? pickString(system, ["system", "os", "platform", "title"]),
    panelVersion: pickString(network, ["version", "panelVersion"]) ?? pickString(system, ["version", "panelVersion"]),
    cpuInfo: stringOrNull(networkCpu[3]) ?? pickString(system, ["cpuInfo", "cpuModel", "cpuNum"]),
    memoryUsed: pickString(system, ["memRealUsed", "memUsed", "memUsedSize"]) ?? pickString(memory ?? {}, ["memRealUsed", "memUsed", "used"]),
    memoryTotal: pickString(system, ["memTotal", "memTotalSize"]) ?? pickString(memory ?? {}, ["memTotal", "memTotalSize", "total"]),
    diskUsed: Array.isArray(size) ? stringOrNull(size[1]) : pickString(system, ["diskUsed"]),
    diskTotal: Array.isArray(size) ? stringOrNull(size[0]) : pickString(system, ["diskTotal"]),
    networkUp: pickString(network, ["up", "upTotal", "sent", "send"]),
    networkDown: pickString(network, ["down", "downTotal", "received", "recv"]),
    raw: { system, disks, sites, network, loadAverage },
  }
}
