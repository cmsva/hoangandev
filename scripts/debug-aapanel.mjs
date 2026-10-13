import crypto from "node:crypto"
import https from "node:https"
import axios from "axios"
import mongoose from "mongoose"

const MONGODB_URI = process.env.MONGODB_URI
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY

if (!MONGODB_URI) throw new Error("MONGODB_URI is not defined")
if (!ENCRYPTION_KEY) throw new Error("ENCRYPTION_KEY is not defined")

function md5(value) {
  return crypto.createHash("md5").update(value).digest("hex")
}

function getKey() {
  if (/^[a-f0-9]{64}$/i.test(ENCRYPTION_KEY)) return Buffer.from(ENCRYPTION_KEY, "hex")
  if (/^[A-Za-z0-9+/=]{40,48}$/.test(ENCRYPTION_KEY)) return Buffer.from(ENCRYPTION_KEY, "base64")
  return Buffer.from(ENCRYPTION_KEY, "utf8")
}

function decryptValue(encrypted) {
  const [ivHex, tagHex, dataHex] = String(encrypted ?? "").split(":")
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivHex, "hex"))
  decipher.setAuthTag(Buffer.from(tagHex, "hex"))
  return Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]).toString("utf8")
}

function normalizePanelUrl(panelUrl) {
  return panelUrl.trim().replace(/\/+$/, "")
}

function signedBody(apiKey, extra = {}) {
  const requestTime = Math.floor(Date.now() / 1000).toString()
  const body = new URLSearchParams({
    request_time: requestTime,
    request_token: md5(requestTime + md5(apiKey)),
  })
  for (const [key, value] of Object.entries(extra)) body.set(key, String(value))
  return body
}

const httpsAgent = new https.Agent({ rejectUnauthorized: false })

async function post(panelUrl, apiKey, uri, extra = {}) {
  const url = `${normalizePanelUrl(panelUrl)}${uri}`
  const res = await axios.post(url, signedBody(apiKey, extra).toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    timeout: 15_000,
    validateStatus: () => true,
    transformResponse: [(value) => value],
    httpsAgent: url.startsWith("https") ? httpsAgent : undefined,
  })
  let parsed = null
  try {
    parsed = JSON.parse(res.data)
  } catch {
    parsed = res.data
  }
  return { uri, status: res.status, parsed }
}

const schema = new mongoose.Schema({}, { strict: false, collection: "aapanelservers" })
const AaPanelServer = mongoose.models.AaPanelServer || mongoose.model("AaPanelServer", schema)

await mongoose.connect(MONGODB_URI)
const idArg = process.argv[2]
const server = idArg
  ? await AaPanelServer.findById(idArg).lean()
  : await AaPanelServer.findOne({ status: "active" }).sort({ priority: 1, createdAt: -1 }).lean()

if (!server) throw new Error("No aaPanel server found. Pass server id as: node scripts/debug-aapanel.mjs <id>")
const apiKey = decryptValue(server.apiKeyEnc)

const endpoints = [
  ["/system?action=GetSystemTotal", {}],
  ["/system?action=GetNetWork", {}],
  ["/system?action=GetDiskInfo", {}],
  ["/ajax?action=GetLoadAverage", {}],
  ["/system?action=GetLoadAverage", {}],
  ["/system?action=GetLoadAvg", {}],
  ["/data?action=getData", { table: "sites", p: 1, limit: 1 }],
]

const results = []
for (const [uri, extra] of endpoints) {
  try {
    results.push(await post(server.panelUrl, apiKey, uri, extra))
  } catch (error) {
    results.push({ uri, error: error instanceof Error ? error.message : String(error) })
  }
}

console.log(JSON.stringify({ server: { id: String(server._id), name: server.name, panelUrl: server.panelUrl }, results }, null, 2))
await mongoose.disconnect()
