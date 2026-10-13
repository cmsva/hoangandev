import mongoose from "mongoose"
import { logger } from "./logger"

interface MongooseCache {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
  listenersAttached: boolean
}

declare global {
  // eslint-disable-next-line no-var
  var _mongooseCache: MongooseCache | undefined
}

const cached: MongooseCache = global._mongooseCache ?? {
  conn: null,
  promise: null,
  listenersAttached: false,
}

if (!global._mongooseCache) {
  global._mongooseCache = cached
}

// ─── Listeners — chỉ register 1 lần TUYỆT ĐỐI (không bị HMR duplicate) ────────
if (!cached.listenersAttached) {
  cached.listenersAttached = true
  mongoose.connection.on("connected", () => {
    logger.info("MongoDB connected (event)", { module: "db" })
  })
  mongoose.connection.on("disconnected", () => {
    logger.warn("MongoDB disconnected", { module: "db" })
    cached.conn = null
  })
  mongoose.connection.on("error", (err) => {
    logger.error("MongoDB error", err, { module: "db" })
  })
}

export async function connectDB(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error("MONGODB_URI is not defined in environment variables")
  }

  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn
  }

  if (!cached.promise) {
    // Long-running Next.js server (OLTP workload) — theo MongoDB skill
    cached.promise = mongoose
      .connect(uri, {
        // Pool sizing
        maxPoolSize: 50,
        minPoolSize: 10,
        maxIdleTimeMS: 10 * 60_000,
        // Timeouts
        serverSelectionTimeoutMS: 5_000,
        connectTimeoutMS: 10_000,
        socketTimeoutMS: 30_000,
        waitQueueTimeoutMS: 5_000,
        // Auto retry
        retryWrites: true,
        retryReads: true,
        heartbeatFrequencyMS: 10_000,
      })
      .then((m) => {
        logger.info("MongoDB connected", {
          module: "db",
          host: m.connection.host,
          db: m.connection.name,
        })
        return m
      })
      .catch((err) => {
        // Reset promise so next call can retry
        cached.promise = null
        logger.error("MongoDB connection failed", err, { module: "db" })
        throw err
      })
  }

  cached.conn = await cached.promise
  return cached.conn
}
