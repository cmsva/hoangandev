/**
 * Order controller — business logic cho mua mã nguồn (Product orders).
 *
 * Phân biệt với service.controller (thuê website) và logo.router (thuê logo).
 */
import { TRPCError } from "@trpc/server"
import { Types } from "mongoose"
import { Order } from "@/models/order-product.model"
import { Product } from "@/models/product.model"
import { logger } from "@/lib/logger"
import { escapeRegex } from "@/lib/sanitize"
import { commitCouponUsage, validateCouponForUser } from "@/services/coupon.service"
import {
  deductBalanceAtomic,
  ensureUserHasBalance,
  logBalanceChange,
  refundBalance,
} from "@/services/balance.service"

// ─── Repository ─────────────────────────────────────────────────────────────

export async function findActiveProductForPurchase(productId: string | Types.ObjectId) {
  const product = (await Product.findById(productId)
    .select("title status approved isFree price salePrice")
    .lean()) as any
  if (!product || product.status !== 1 || !product.approved) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Sản phẩm không tồn tại" })
  }
  return product
}

export async function findProductFile(productId: string | Types.ObjectId) {
  const product = (await Product.findById(productId).select("fileUrl title").lean()) as any
  if (!product?.fileUrl) {
    throw new TRPCError({ code: "NOT_FOUND", message: "File không khả dụng" })
  }
  return product
}

export async function findUserOrderById(
  userId: Types.ObjectId | string,
  orderId: string | Types.ObjectId
) {
  const order = (await Order.findOne({ _id: orderId, userId })
    .select("productId")
    .lean()) as any
  if (!order) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy đơn hàng" })
  }
  return order
}

export async function checkUserHasPurchased(
  userId: Types.ObjectId | string,
  productId: string | Types.ObjectId
) {
  const order = await Order.findOne({ userId, productId }).select("_id").lean()
  return {
    purchased: !!order,
    orderId: (order as any)?._id?.toString() || null,
  }
}

// ─── Pricing ────────────────────────────────────────────────────────────────

/**
 * Tính giá gốc của product (chưa áp coupon).
 */
export function calcBasePrice(product: { isFree: boolean; price: number; salePrice: number }) {
  return product.isFree ? 0 : product.salePrice || product.price
}

// ─── Order create + rollback ────────────────────────────────────────────────

export interface CreateOrderInput {
  userId: Types.ObjectId | string
  productId: Types.ObjectId | string
  totalPrice: number
}

/**
 * Tạo Order với unique index {userId, productId} chặn double-buy.
 * Throw BAD_REQUEST nếu đã mua, INTERNAL_SERVER_ERROR cho lỗi khác.
 */
export async function createOrder(input: CreateOrderInput) {
  try {
    return await Order.create({
      userId: input.userId,
      productId: input.productId,
      totalPrice: input.totalPrice,
      orderDate: new Date(),
    })
  } catch (err: any) {
    if (err?.code === 11000) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Bạn đã mua sản phẩm này rồi" })
    }
    logger.error("Order.create failed", err, {
      module: "order.createOrder",
      userId: String(input.userId),
    })
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tạo đơn hàng thất bại" })
  }
}

export async function deleteOrderSafe(orderId: Types.ObjectId | string) {
  await Order.deleteOne({ _id: orderId }).catch((err) =>
    logger.error("Order rollback failed", err, {
      module: "order.deleteOrderSafe",
      orderId: String(orderId),
    })
  )
}

// ─── Side-effects ───────────────────────────────────────────────────────────

export function incProductSales(productId: Types.ObjectId | string) {
  Product.updateOne({ _id: productId }, { $inc: { salesCount: 1 } })
    .exec()
    .catch((err) =>
      logger.warn("salesCount update failed", {
        module: "order.incProductSales",
        error: (err as Error).message,
      })
    )
}

export interface PurchaseSourceCodeInput {
  userId: Types.ObjectId | string
  productId: string
  couponCode?: string
}

export interface PurchaseSourceCodeResult {
  orderId: string
  productTitle: string
  totalPrice: number
  couponCode: string | null
}

export async function purchaseSourceCode(input: PurchaseSourceCodeInput): Promise<PurchaseSourceCodeResult> {
  const product = await findActiveProductForPurchase(input.productId)
  const basePrice = calcBasePrice(product)
  let finalPrice = basePrice
  let couponId: string | null = null
  let couponCode: string | null = null

  if (input.couponCode && basePrice > 0) {
    const coupon = await validateCouponForUser(input.userId, input.couponCode, basePrice, "source-code")
    finalPrice = coupon.finalAmount
    couponId = coupon.couponId
    couponCode = coupon.code
  }

  await ensureUserHasBalance(input.userId, finalPrice)

  const newOrder = await createOrder({
    userId: input.userId,
    productId: product._id,
    totalPrice: finalPrice,
  })

  if (finalPrice > 0) {
    const balance = await deductBalanceAtomic(input.userId, finalPrice)
    if (!balance) {
      await deleteOrderSafe(newOrder._id as Types.ObjectId)
      throw new TRPCError({ code: "BAD_REQUEST", message: "Số dư không đủ" })
    }
    logBalanceChange({
      userId: input.userId,
      moneyBefore: balance.moneyBefore,
      moneyAfter: balance.moneyAfter,
      moneyChange: -finalPrice,
      content: `Mua mã nguồn: ${product.title}`,
      module: "order.purchase",
      orderId: String(newOrder._id),
    })
    void import("@/services/rewards.service").then((m) =>
      m.awardRewardForPurchase({
        userId: input.userId,
        vndAmount: finalPrice,
        context: `mã nguồn ${product.title}`,
        refOrderId: newOrder._id as any,
        refOrderType: "product",
      })
    )
  }

  if (couponId) {
    try {
      await commitCouponUsage(couponId, input.userId, String(newOrder._id))
    } catch (err) {
      await deleteOrderSafe(newOrder._id as Types.ObjectId)
      if (finalPrice > 0) {
        const refund = await refundBalance(input.userId, finalPrice)
        if (refund) {
          logBalanceChange({
            userId: input.userId,
            moneyBefore: refund.moneyBefore,
            moneyAfter: refund.moneyAfter,
            moneyChange: finalPrice,
            content: `Hoàn tiền lỗi mã giảm giá: ${product.title}`,
            module: "order.purchase.couponRollback",
            orderId: String(newOrder._id),
          })
        }
      }
      throw err
    }
  }

  incProductSales(product._id)

  // Notify: mail order_website + tele admin + tele user — best-effort
  void import("@/services/notify.service").then((m) =>
    m.notifyOrderWebsite({
      userId: input.userId,
      productName: product.title,
      total: finalPrice,
    })
  )

  return {
    orderId: String(newOrder._id),
    productTitle: product.title,
    totalPrice: finalPrice,
    couponCode,
  }
}

// ─── Aggregation pipeline cho myOrders ──────────────────────────────────────

export interface MyOrdersInput {
  userId: Types.ObjectId | string
  page: number
  limit: number
  search: string | undefined
  sortField: "productTitle" | "totalPrice" | "orderDate"
  sortDir: "asc" | "desc"
}

/**
 * Build aggregation pipeline cho list user's orders với JOIN product
 * (search + sort theo productTitle).
 */
export function buildMyOrdersPipeline(input: MyOrdersInput) {
  const skip = (input.page - 1) * input.limit
  const sortMul = input.sortDir === "asc" ? 1 : -1

  // QUAN TRỌNG: aggregation KHÔNG auto-cast string → ObjectId (khác query thường).
  // ctx.user._id có thể là string khi lấy từ cache Redis (JSON serialize mất kiểu
  // ObjectId). Nếu match bằng string trong khi DB lưu ObjectId → 0 kết quả →
  // lịch sử rỗng dù admin vẫn thấy đơn. Ép về ObjectId để match đúng mọi nguồn.
  const userObjectId =
    input.userId instanceof Types.ObjectId
      ? input.userId
      : new Types.ObjectId(String(input.userId))

  const pipeline: any[] = [
    { $match: { userId: userObjectId } },
    {
      $lookup: {
        from: "products",
        localField: "productId",
        foreignField: "_id",
        as: "product",
        pipeline: [{ $project: { title: 1, slug: 1, thumbnail: 1, price: 1, salePrice: 1 } }],
      },
    },
    { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
  ]

  if (input.search) {
    pipeline.push({
      $match: {
        "product.title": { $regex: escapeRegex(input.search), $options: "i" },
      },
    })
  }

  const sortKey =
    input.sortField === "productTitle"
      ? { "product.title": sortMul }
      : input.sortField === "totalPrice"
      ? { totalPrice: sortMul }
      : { orderDate: sortMul }

  pipeline.push({
    $facet: {
      data: [
        { $sort: sortKey },
        { $skip: skip },
        { $limit: input.limit },
        {
          $project: {
            _id: 1,
            productId: 1,
            totalPrice: 1,
            orderDate: 1,
            "product.title": 1,
            "product.slug": 1,
            "product.thumbnail": 1,
          },
        },
      ],
      totalCount: [{ $count: "count" }],
    },
  })

  return pipeline
}

export async function listMyOrders(input: MyOrdersInput) {
  const pipeline = buildMyOrdersPipeline(input)
  const [result] = await Order.aggregate(pipeline).exec()
  const docs = result?.data ?? []
  const total = result?.totalCount?.[0]?.count ?? 0

  return {
    items: docs.map((order: any) => ({
      id: order._id.toString(),
      productId: order.productId.toString(),
      productTitle: order.product?.title || "Sản phẩm đã xóa",
      productSlug: order.product?.slug || "",
      productThumbnail: order.product?.thumbnail || null,
      totalPrice: order.totalPrice,
      orderDate: order.orderDate,
    })),
    total,
  }
}
