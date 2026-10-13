import crypto from "node:crypto"
import mongoose from "mongoose"

const MONGODB_URI = process.env.MONGODB_URI
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY
if (!MONGODB_URI) throw new Error("MONGODB_URI is not defined")
if (!ENCRYPTION_KEY) throw new Error("ENCRYPTION_KEY is not defined")

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

function headers(account, key) {
  if ((account.authMode ?? "globalKey") === "globalKey") return { "X-Auth-Email": account.authEmail, "X-Auth-Key": key, "Content-Type": "application/json" }
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }
}

async function cfRest(path, account, key) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, { headers: headers(account, key) })
  const json = await res.json().catch(() => null)
  return { path, status: res.status, json }
}

async function cfGraphql(query, variables, account, key) {
  const res = await fetch("https://api.cloudflare.com/client/v4/graphql", { method: "POST", headers: headers(account, key), body: JSON.stringify({ query, variables }) })
  const json = await res.json().catch(() => null)
  return { status: res.status, json }
}

const schema = new mongoose.Schema({}, { strict: false, collection: "cloudflareaccounts" })
const CloudflareAccount = mongoose.models.CloudflareAccount || mongoose.model("CloudflareAccount", schema)
await mongoose.connect(MONGODB_URI)
const idArg = process.argv[2]
const account = idArg ? await CloudflareAccount.findById(idArg).lean() : await CloudflareAccount.findOne({ status: "active" }).lean()
if (!account) throw new Error("No Cloudflare account found")
const key = decryptValue(account.apiTokenEnc)
const zonesRes = await cfRest("/zones?per_page=5&order=name&direction=asc", account, key)
const zones = Array.isArray(zonesRes.json?.result) ? zonesRes.json.result : []
const zoneIds = zones.map((zone) => zone.id).filter(Boolean)
const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
const until = new Date().toISOString()
const queries = [
  { name: "count_sum_basic", query: `query Q($zoneIds: [String!], $since: Time!, $until: Time!) { viewer { zones(filter: { zoneTag_in: $zoneIds }) { totals: httpRequestsAdaptiveGroups(limit: 1, filter: { datetime_geq: $since, datetime_leq: $until, requestSource: "eyeball" }) { count sum { visits edgeResponseBytes } } series: httpRequestsAdaptiveGroups(limit: 3, filter: { datetime_geq: $since, datetime_leq: $until, requestSource: "eyeball" }, orderBy: [datetimeHour_ASC]) { count dimensions { datetimeHour } sum { visits edgeResponseBytes } } } } }` },
  { name: "cache_status", query: `query Q($zoneIds: [String!], $since: Time!, $until: Time!) { viewer { zones(filter: { zoneTag_in: $zoneIds }) { cache: httpRequestsAdaptiveGroups(limit: 20, filter: { datetime_geq: $since, datetime_leq: $until, requestSource: "eyeball" }) { count dimensions { cacheStatus } sum { edgeResponseBytes } } } } }` },
]
const graphql = []
for (const item of queries) graphql.push({ name: item.name, ...(await cfGraphql(item.query, { zoneIds, since, until }, account, key)) })
console.log(JSON.stringify({ account: { id: String(account._id), name: account.name, authMode: account.authMode, authEmail: account.authEmail, accountId: account.accountId }, zones: zonesRes, graphql }, null, 2))
await mongoose.disconnect()
