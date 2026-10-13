/**
 * Landing Service — fetch live stats từ DB cho landing page.
 *
 * Cache 60s để giảm tải DB cho public landing.
 * Khi DB rỗng (vừa setup) → trả 0.
 */
import { connectDB } from "@/lib/db"
import { User } from "@/models/user.model"
import { Order } from "@/models/order-product.model"
import { OrderDomain } from "@/models/domain.model"
import { LogoOrder } from "@/models/logo.model"
import { OrderService } from "@/models/service.model"
import { Product } from "@/models/product.model"
import { cached } from "@/lib/cache"

export interface LandingStats {
  customers: number
  orders: number
  products: number
}

async function loadStatsFromDB(): Promise<LandingStats> {
  await connectDB()
  const [customers, productOrders, domainOrders, logoOrders, serviceOrders, products] =
    await Promise.all([
      User.countDocuments({ banned: 0 }).catch(() => 0),
      Order.countDocuments({}).catch(() => 0),
      OrderDomain.countDocuments({}).catch(() => 0),
      LogoOrder.countDocuments({}).catch(() => 0),
      OrderService.countDocuments({}).catch(() => 0),
      Product.countDocuments({ status: 1 }).catch(() => 0),
    ])

  return {
    customers,
    orders: productOrders + domainOrders + logoOrders + serviceOrders,
    products,
  }
}

/** Lấy stats landing — Redis cache 60s. */
export async function getLandingStats(): Promise<LandingStats> {
  return await cached("landing:stats", 60, loadStatsFromDB)
}
