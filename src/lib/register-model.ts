/**
 * Helper register Mongoose model với HMR-safety cho dev.
 *
 * Trong dev (Next.js HMR), file model được re-import nhiều lần.
 * `mongoose.models.X` cache schema cũ → cần force delete để dùng schema mới.
 *
 * Trong production: chỉ load 1 lần khi cold-start, không re-register
 * (an toàn vì Vercel/serverless start fresh process).
 *
 * Usage:
 *   export const Foo = registerModel<IFoo>("Foo", fooSchema)
 */
import mongoose, { type Model, type Schema } from "mongoose"

export function registerModel<T>(name: string, schema: Schema<T>): Model<T> {
  if (process.env.NODE_ENV !== "production" && mongoose.models[name]) {
    delete mongoose.models[name]
  }
  return (
    (mongoose.models[name] as Model<T>) ||
    mongoose.model<T>(name, schema)
  )
}
