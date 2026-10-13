/**
 * Catalog endpoint API agency — nguồn sự thật cho /document-api page.
 *
 * Mọi endpoint đều yêu cầu 2 headers: `api-key` + `auth-token`.
 * Đối tác trừ tiền trực tiếp từ số dư của tài khoản gắn với api-key.
 * Mọi giao dịch đều ghi vào log số dư + audit log API.
 */

export interface ApiParam {
  name: string
  type: "string" | "number" | "boolean" | "object" | "array"
  required?: boolean
  description?: string
  example?: string | number | boolean
}

export interface ApiEndpoint {
  /** Sluggified id, dùng làm anchor */
  id: string
  /** HTTP method */
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
  /** Path bắt đầu bằng /api/agency/... */
  path: string
  /** Tên hiển thị tiếng Việt */
  title: string
  /** Mô tả tiếng Việt */
  description?: string
  /** Scope yêu cầu (vd "websites:read"). null = chỉ cần auth */
  scope: string | null
  /** Phải có header api-key + auth-token? Mặc định true. False chỉ cho /get-token */
  requiresAuth?: boolean
  /** Path params */
  pathParams?: ApiParam[]
  /** Query params */
  queryParams?: ApiParam[]
  /** Body params */
  bodyParams?: ApiParam[]
  /** Mẫu body JSON */
  bodyExample?: unknown
  /** Mẫu response success */
  responseExample: unknown
}

export interface ApiSection {
  id: string
  title: string
  /** Optional intro */
  intro?: string
  endpoints: ApiEndpoint[]
}

const orderId = "65f1234567890abcdef12345"

export const API_DOCS_SECTIONS: ApiSection[] = [
  // ─── Auth ───────────────────────────────────────────────────────────────
  {
    id: "auth",
    title: "Xác thực",
    intro:
      "Mọi endpoint yêu cầu hai headers: `api-key` (cấp ở trang Hồ sơ) và `auth-token` (JWT). " +
      "Đổi `api-key` lấy `auth-token` qua endpoint `/get-token`. Token có hiệu lực 8 giờ.",
    endpoints: [
      {
        id: "get-token",
        method: "POST",
        path: "/api/agency/get-token",
        title: "Lấy auth-token",
        description:
          "Đổi api-key sang JWT có thời hạn 8 giờ. Idempotent: nếu token chưa hết hạn, trả lại token đang dùng. Giới hạn 10 request/phút theo IP.",
        scope: null,
        requiresAuth: false,
        responseExample: {
          error: 0,
          data: {
            "auth-token": "eyJhbGciOiJIUzI1NiIs...",
            "expires-in": 28800,
            "expires-at": "2026-05-30T20:14:32.000Z",
            "key-prefix": "abcd1234",
          },
          meta: {
            requestId: "req_8f3e2a1b...",
            timestamp: "2026-05-30T12:14:32.000Z",
          },
        },
      },
    ],
  },

  // ─── Account ────────────────────────────────────────────────────────────
  {
    id: "account",
    title: "Tài khoản",
    endpoints: [
      {
        id: "account-me",
        method: "GET",
        path: "/api/agency/account/me",
        title: "Thông tin tài khoản",
        description:
          "Trả thông tin cơ bản của đối tác: id, email, username, ngày tạo và quyền admin nếu có.",
        scope: "account:read",
        responseExample: {
          error: 0,
          data: {
            id: "65a1b2c3d4e5f6a7b8c9d0e1",
            username: "agency_acme",
            email: "agency@acme.com",
            balance: 5_000_000,
            admin: false,
            createdAt: "2025-01-15T10:00:00.000Z",
          },
        },
      },
      {
        id: "account-balance",
        method: "GET",
        path: "/api/agency/account/balance",
        title: "Số dư & lịch sử biến động",
        description:
          "Trả số dư hiện tại của tài khoản. Mọi giao dịch mua hàng qua API đều trừ trực tiếp vào số dư này. Kèm theo các giao dịch gần nhất.",
        scope: "account:read",
        queryParams: [
          { name: "limit", type: "number", description: "Số giao dịch trả về (1-100, mặc định 20)" },
        ],
        responseExample: {
          error: 0,
          data: {
            balance: 5_000_000,
            currency: "VND",
            recent: [
              {
                before: 5_100_000,
                change: -100_000,
                after: 5_000_000,
                content: "Mua mã nguồn: SourceCode WP",
                at: "2026-05-29T08:30:12.000Z",
              },
            ],
          },
        },
      },
    ],
  },

  // ─── Websites ───────────────────────────────────────────────────────────
  {
    id: "websites",
    title: "Website",
    intro:
      "Marketplace mẫu website thuê theo tháng. Đối tác có 4 thao tác: liệt kê catalog, xem chi tiết, đặt thuê và tra lịch sử đơn của mình.",
    endpoints: [
      {
        id: "websites-list",
        method: "GET",
        path: "/api/agency/websites",
        title: "Danh sách mẫu website",
        description:
          "Trả danh sách các mẫu website đang mở bán. Hỗ trợ phân trang, tìm kiếm theo tên và lọc theo danh mục.",
        scope: "websites:read",
        queryParams: [
          { name: "page", type: "number", description: "Trang hiện tại (mặc định 1)" },
          { name: "limit", type: "number", description: "Số bản ghi/trang (1-50, mặc định 20)" },
          { name: "search", type: "string", description: "Tìm theo tên mẫu" },
          { name: "categoryId", type: "string", description: "Lọc theo danh mục" },
        ],
        responseExample: {
          error: 0,
          data: {
            items: [
              {
                id: "65a1b2c3...",
                serviceName: "Mẫu Bán hàng Pro",
                slug: "shop-pro",
                image: "/upload/services/shop.jpg",
                description: "...",
                pricing: [{ durationMonths: 1, pricePerMonth: 100_000 }],
              },
            ],
            pagination: { page: 1, limit: 20, total: 42, totalPages: 3 },
          },
        },
      },
      {
        id: "websites-detail",
        method: "GET",
        path: "/api/agency/websites/{slug}",
        title: "Chi tiết mẫu website",
        scope: "websites:read",
        description:
          "Trả thông tin đầy đủ của một mẫu, kèm bảng giá thuê và gia hạn theo từng kỳ hạn.",
        pathParams: [{ name: "slug", type: "string", required: true, description: "Slug mẫu" }],
        responseExample: {
          error: 0,
          data: {
            id: "65a1b2c3...",
            serviceName: "Mẫu Bán hàng Pro",
            slug: "shop-pro",
            description: "...",
            featuresList: ["Trang chủ", "Sản phẩm", "Giỏ hàng"],
            pricing: [
              { durationMonths: 1, pricePerMonth: 100_000, priceExtendPerMonth: 80_000 },
              { durationMonths: 12, pricePerMonth: 80_000, priceExtendPerMonth: 60_000 },
            ],
          },
        },
      },
      {
        id: "websites-buy",
        method: "POST",
        path: "/api/agency/websites/buy",
        title: "Đặt thuê website",
        description:
          "Tạo đơn thuê mới và trừ tiền trực tiếp vào số dư của đối tác. Khi mẫu hỗ trợ tự động và `domainNew=true`, hệ thống sẽ tự đăng ký domain, tạo zone Cloudflare và deploy mã nguồn — đối tác có thể theo dõi tiến độ qua endpoint chi tiết đơn.",
        scope: "websites:write",
        bodyParams: [
          { name: "serviceId", type: "string", required: true, description: "ID mẫu website" },
          { name: "durationMonths", type: "number", required: true, description: "Số tháng thuê (1-36)" },
          { name: "domainName", type: "string", required: true, description: "Domain khách hàng dùng" },
          { name: "domainNew", type: "boolean", description: "true = mua domain tự động cùng đơn" },
          { name: "domainTldId", type: "string", description: "Bắt buộc nếu `domainNew=true`" },
          { name: "shopAccount", type: "string", description: "Tài khoản admin shop (nếu cần)" },
          { name: "shopPassword", type: "string", description: "Mật khẩu admin shop" },
          { name: "couponCode", type: "string", description: "Mã giảm giá (nếu có)" },
        ],
        bodyExample: {
          serviceId: "65a1b2c3d4e5f6a7b8c9d0e1",
          durationMonths: 12,
          domainName: "myshop.com",
          domainNew: false,
          shopAccount: "admin",
          shopPassword: "secret123",
        },
        responseExample: {
          error: 0,
          message: "Đặt thuê website thành công",
          data: {
            orderId,
            serviceName: "Mẫu Bán hàng Pro",
            domainName: "myshop.com",
            domainTldName: null,
            couponCode: null,
            total: 960_000,
          },
        },
      },
      {
        id: "websites-orders",
        method: "GET",
        path: "/api/agency/websites/orders",
        title: "Lịch sử đơn website",
        description:
          "Trả các đơn website đã đặt qua API key này, kèm thông tin đăng nhập đã giải mã và trạng thái triển khai chi tiết.",
        scope: "websites:read",
        queryParams: [
          { name: "page", type: "number", description: "Trang hiện tại (mặc định 1)" },
          { name: "limit", type: "number", description: "Số bản ghi/trang (1-100, mặc định 20)" },
          { name: "status", type: "string", description: "Lọc theo trạng thái: ns_pending, active, expired..." },
        ],
        responseExample: {
          error: 0,
          data: {
            items: [
              {
                id: orderId,
                serviceName: "Mẫu Bán hàng Pro",
                domainName: "myshop.com",
                status: "ns_pending",
                provisioning: {
                  nameServers: ["ns1.cloudflare.com", "ns2.cloudflare.com"],
                  zoneId: "abc123",
                },
              },
            ],
            pagination: { page: 1, limit: 20, total: 5, totalPages: 1 },
          },
        },
      },
      {
        id: "websites-order-detail",
        method: "GET",
        path: "/api/agency/websites/orders/{id}",
        title: "Chi tiết đơn website",
        scope: "websites:read",
        description:
          "Trả thông tin đầy đủ của một đơn: thông tin đăng nhập admin, các bước triển khai và trạng thái phân giải DNS.",
        pathParams: [{ name: "id", type: "string", required: true, description: "Order ID" }],
        responseExample: {
          error: 0,
          data: {
            id: orderId,
            domainName: "myshop.com",
            status: "ns_pending",
            shopAccount: "admin",
            shopPassword: "secret123",
            provisioning: {
              nameServers: ["ns1.cloudflare.com", "ns2.cloudflare.com"],
              stepLog: [
                { step: "cloudflare_zone", status: "ok", at: "..." },
                { step: "ns_propagation", status: "pending", at: "..." },
              ],
            },
          },
        },
      },
      {
        id: "websites-check-ns",
        method: "POST",
        path: "/api/agency/websites/orders/{id}/check-ns",
        title: "Kích hoạt deploy sau khi trỏ NS",
        description:
          "Sau khi khách hàng đã trỏ name server, gọi endpoint này để hệ thống xác minh và tự động deploy mã nguồn. Có thể gọi nhiều lần — endpoint idempotent.",
        scope: "websites:write",
        pathParams: [{ name: "id", type: "string", required: true, description: "Order ID" }],
        responseExample: {
          error: 0,
          data: {
            status: "deploying",
            domain: "myshop.com",
            nameServers: ["ns1.cloudflare.com", "ns2.cloudflare.com"],
            message: "Hệ thống đã ghi nhận NS hợp lệ và bắt đầu deploy",
          },
        },
      },
    ],
  },

  // ─── Domains ────────────────────────────────────────────────────────────
  {
    id: "domains",
    title: "Tên miền",
    intro: "Đăng ký tên miền tự động và theo dõi tiến độ phân giải.",
    endpoints: [
      {
        id: "domains-tlds",
        method: "GET",
        path: "/api/agency/domains/tlds",
        title: "Bảng giá TLD",
        scope: "domains:read",
        description:
          "Trả danh sách các đuôi tên miền đang mở bán, kèm giá đăng ký và giá gia hạn áp dụng cho đối tác.",
        responseExample: {
          error: 0,
          data: {
            items: [{ id: "...", tld: "com", priceSold: 250_000, renewSold: 280_000 }],
            pagination: { page: 1, limit: 50, total: 30, totalPages: 1 },
          },
        },
      },
      {
        id: "domains-buy",
        method: "POST",
        path: "/api/agency/domains/buy",
        title: "Đăng ký tên miền",
        scope: "domains:write",
        description:
          "Đăng ký tên miền mới cho đối tác. Khi TLD ở chế độ tự động, response có `status=processing` và hệ thống đăng ký ngầm — đối tác poll endpoint chi tiết đơn để biết khi nào hoàn tất.",
        bodyParams: [
          { name: "domain", type: "string", required: true, example: "myshop.com", description: "Tên miền đầy đủ" },
          { name: "tldId", type: "string", required: true, description: "ID TLD lấy từ bảng giá" },
          { name: "couponCode", type: "string", description: "Mã giảm giá (nếu có)" },
        ],
        bodyExample: { domain: "myshop.com", tldId: "65a1b2c3..." },
        responseExample: {
          error: 0,
          message: "Đã khởi tạo đăng ký tên miền",
          data: {
            orderId,
            domainName: "myshop.com",
            totalAmount: 250_000,
            provider: "spaceship",
            status: "processing",
          },
        },
      },
      {
        id: "domains-orders",
        method: "GET",
        path: "/api/agency/domains/orders",
        title: "Lịch sử đơn tên miền",
        scope: "domains:read",
        description:
          "Trả danh sách các tên miền đã đăng ký qua API key này, kèm trạng thái và ngày hết hạn.",
        responseExample: {
          error: 0,
          data: {
            items: [
              {
                id: orderId,
                domainName: "myshop.com",
                status: "completed",
                providerStatus: "completed",
                expiredAt: "2027-05-30T...",
              },
            ],
            pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
          },
        },
      },
      {
        id: "domains-order-detail",
        method: "GET",
        path: "/api/agency/domains/orders/{id}",
        title: "Chi tiết đơn tên miền",
        scope: "domains:read",
        description:
          "Trả thông tin đầy đủ của một đơn tên miền, bao gồm name servers hiện tại và mã giao dịch nội bộ.",
        pathParams: [{ name: "id", type: "string", required: true }],
        responseExample: {
          error: 0,
          data: {
            id: orderId,
            domainName: "myshop.com",
            status: "completed",
            nameservers: ["ns1.cloudflare.com", "ns2.cloudflare.com"],
            spaceshipOperationId: "op_xxx",
          },
        },
      },
    ],
  },

  // ─── Cronjobs ──────────────────────────────────────────────────────────
  {
    id: "cronjobs",
    title: "Cronjob",
    intro: "Tạo lịch ping URL theo chu kỳ định kỳ trên server giám sát của hệ thống.",
    endpoints: [
      {
        id: "cronjobs-buy",
        method: "POST",
        path: "/api/agency/cronjobs/buy",
        title: "Tạo cronjob",
        scope: "cronjobs:write",
        description:
          "Tạo cronjob mới và thuê slot trong số tháng chỉ định. Tiền được trừ trực tiếp vào số dư đối tác. Hệ thống chỉ hỗ trợ GET và POST, chu kỳ tối thiểu 30 giây.",
        bodyParams: [
          { name: "serverId", type: "string", required: true, description: "ID server giám sát" },
          { name: "url", type: "string", required: true, description: "URL cần gọi định kỳ" },
          { name: "method", type: "string", description: "GET hoặc POST (mặc định GET)" },
          { name: "intervalSeconds", type: "number", required: true, description: "Chu kỳ chạy (30-31536000 giây)" },
          { name: "month", type: "number", required: true, description: "Số tháng thuê (1-24)" },
          { name: "headers", type: "string", description: "Headers dạng JSON encoded («8KB)" },
          { name: "body", type: "string", description: "Body request («16KB) — chỉ dùng với POST" },
        ],
        bodyExample: {
          serverId: "65a1b2c3...",
          url: "https://api.example.com/cron",
          method: "POST",
          intervalSeconds: 300,
          month: 1,
        },
        responseExample: {
          error: 0,
          message: "Tạo cronjob thành công",
          data: { jobId: "...", url: "https://api.example.com/cron", payment: 50_000 },
        },
      },
      {
        id: "cronjobs-list",
        method: "GET",
        path: "/api/agency/cronjobs",
        title: "Danh sách cronjob",
        scope: "cronjobs:read",
        description: "Trả danh sách các cronjob đối tác đã tạo qua API.",
        responseExample: {
          error: 0,
          data: {
            items: [{ id: "...", url: "...", intervalSeconds: 300, status: "active" }],
            pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
          },
        },
      },
      {
        id: "cronjobs-detail",
        method: "GET",
        path: "/api/agency/cronjobs/{id}",
        title: "Chi tiết cronjob",
        scope: "cronjobs:read",
        pathParams: [{ name: "id", type: "string", required: true }],
        description:
          "Trả thông tin chi tiết của một cronjob, kèm thời điểm chạy gần nhất và mã trạng thái HTTP gần nhất.",
        responseExample: {
          error: 0,
          data: { id: "...", url: "...", lastRun: "...", lastStatus: 200 },
        },
      },
    ],
  },

  // ─── Logos ──────────────────────────────────────────────────────────────
  {
    id: "logos",
    title: "Logo",
    intro: "Đặt logo theo gói có sẵn — designer hệ thống thiết kế và bàn giao file.",
    endpoints: [
      {
        id: "logos-list",
        method: "GET",
        path: "/api/agency/logos",
        title: "Danh sách gói logo",
        scope: "logos:read",
        description: "Trả danh sách các gói logo đang mở bán, có thể lọc theo danh mục.",
        responseExample: {
          error: 0,
          data: {
            items: [{ id: "...", title: "Logo Pro", price: 500_000 }],
            pagination: { page: 1, limit: 20, total: 5, totalPages: 1 },
          },
        },
      },
      {
        id: "logos-detail",
        method: "GET",
        path: "/api/agency/logos/{slug}",
        title: "Chi tiết gói logo",
        scope: "logos:read",
        description: "Trả thông tin chi tiết của một gói logo, bao gồm mô tả và giá.",
        pathParams: [{ name: "slug", type: "string", required: true }],
        responseExample: {
          error: 0,
          data: { id: "...", title: "Logo Pro", description: "...", price: 500_000 },
        },
      },
      {
        id: "logos-buy",
        method: "POST",
        path: "/api/agency/logos/buy",
        title: "Đặt logo",
        scope: "logos:write",
        description:
          "Tạo đơn đặt logo cho khách hàng cuối của đối tác. Tiền được trừ vào số dư đối tác. Đơn ở trạng thái `pending` cho đến khi designer hoàn tất.",
        bodyParams: [
          { name: "logoId", type: "string", required: true, description: "ID gói logo" },
          { name: "shopName", type: "string", required: true, description: "Tên shop khách hàng cuối (2-200 ký tự)" },
          { name: "customNote", type: "string", description: "Ghi chú thiết kế tùy chỉnh («1000 ký tự)" },
        ],
        bodyExample: { logoId: "65a1b2c3...", shopName: "Shop ABC" },
        responseExample: {
          error: 0,
          message: "Đặt logo thành công",
          data: { orderId, logoTitle: "Logo Pro", shopName: "Shop ABC", price: 500_000 },
        },
      },
      {
        id: "logos-orders",
        method: "GET",
        path: "/api/agency/logos/orders",
        title: "Lịch sử đơn logo",
        scope: "logos:read",
        description:
          "Trả danh sách đơn logo đã đặt qua API key này. Đơn đã hoàn tất có kèm link tải file thiết kế.",
        responseExample: {
          error: 0,
          data: {
            items: [
              { id: orderId, title: "Logo Pro", status: "completed", fileUrl: "https://..." },
            ],
            pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
          },
        },
      },
      {
        id: "logos-order-detail",
        method: "GET",
        path: "/api/agency/logos/orders/{id}",
        title: "Chi tiết đơn logo",
        scope: "logos:read",
        description: "Trả thông tin chi tiết của một đơn logo, kèm link tải file khi đã hoàn tất.",
        pathParams: [{ name: "id", type: "string", required: true }],
        responseExample: {
          error: 0,
          data: { id: orderId, status: "completed", fileUrl: "https://..." },
        },
      },
    ],
  },

  // ─── Products (mã nguồn) ────────────────────────────────────────────────
  {
    id: "products",
    title: "Mã nguồn",
    intro:
      "Marketplace mã nguồn để đối tác bán lại cho khách hàng cuối. " +
      "Sau khi mua, link tải nằm trong endpoint chi tiết đơn — đối tác lưu lại để gửi cho khách.",
    endpoints: [
      {
        id: "products-list",
        method: "GET",
        path: "/api/agency/products",
        title: "Danh sách mã nguồn",
        scope: "products:read",
        description: "Trả danh sách các mã nguồn đang mở bán, hỗ trợ tìm kiếm và lọc danh mục.",
        queryParams: [
          { name: "page", type: "number", description: "Trang hiện tại (mặc định 1)" },
          { name: "limit", type: "number", description: "Số bản ghi/trang (1-50, mặc định 20)" },
          { name: "search", type: "string", description: "Tìm theo tên mã nguồn" },
          { name: "categoryId", type: "string", description: "Lọc theo danh mục" },
        ],
        responseExample: {
          error: 0,
          data: {
            items: [
              {
                id: "...",
                title: "Source WordPress Theme",
                slug: "wp-theme-pro",
                price: 1_000_000,
                salePrice: 800_000,
              },
            ],
            pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
          },
        },
      },
      {
        id: "products-detail",
        method: "GET",
        path: "/api/agency/products/{slug}",
        title: "Chi tiết mã nguồn",
        scope: "products:read",
        description:
          "Trả thông tin đầy đủ của một mã nguồn cùng các sản phẩm liên quan để đối tác cross-sell.",
        pathParams: [{ name: "slug", type: "string", required: true }],
        responseExample: {
          error: 0,
          data: {
            id: "...",
            title: "Source WordPress Theme",
            description: "...",
            price: 1_000_000,
            related: [{ id: "...", title: "Source Y", slug: "source-y" }],
          },
        },
      },
      {
        id: "products-buy",
        method: "POST",
        path: "/api/agency/products/buy",
        title: "Mua mã nguồn",
        scope: "products:write",
        description:
          "Mua mã nguồn ngay lập tức. Tiền được trừ vào số dư đối tác và link tải có sẵn trong endpoint chi tiết đơn.",
        bodyParams: [
          { name: "productId", type: "string", required: true, description: "ID mã nguồn" },
          { name: "couponCode", type: "string", description: "Mã giảm giá (nếu có)" },
        ],
        bodyExample: { productId: "65a1b2c3..." },
        responseExample: {
          error: 0,
          message: "Mua mã nguồn thành công",
          data: { orderId, totalPrice: 800_000, productTitle: "Source WP" },
        },
      },
      {
        id: "products-orders",
        method: "GET",
        path: "/api/agency/products/orders",
        title: "Lịch sử mua mã nguồn",
        scope: "products:read",
        description:
          "Trả danh sách các mã nguồn đã mua kèm link tải. Đối tác sử dụng `downloadUrl` để giao file cho khách hàng cuối.",
        responseExample: {
          error: 0,
          data: {
            items: [
              {
                id: orderId,
                productTitle: "Source WordPress Theme",
                productSlug: "wp-theme-pro",
                totalPrice: 800_000,
                downloadUrl: "https://cdn.vankhanh.com/files/wp-theme.zip",
                orderDate: "2026-05-29T...",
              },
            ],
            pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
          },
        },
      },
      {
        id: "products-order-detail",
        method: "GET",
        path: "/api/agency/products/orders/{id}",
        title: "Chi tiết đơn mã nguồn",
        scope: "products:read",
        description: "Trả thông tin chi tiết một đơn mã nguồn, kèm link tải file.",
        pathParams: [{ name: "id", type: "string", required: true }],
        responseExample: {
          error: 0,
          data: {
            id: orderId,
            product: { title: "Source WP", slug: "wp-theme-pro" },
            downloadUrl: "https://cdn.vankhanh.com/files/wp-theme.zip",
          },
        },
      },
    ],
  },
]

/** Flatten all endpoints kèm sectionId — dùng cho search Cmd+K */
export interface FlatEndpoint extends ApiEndpoint {
  sectionId: string
  sectionTitle: string
}

export function getAllEndpoints(): FlatEndpoint[] {
  const flat: FlatEndpoint[] = []
  for (const section of API_DOCS_SECTIONS) {
    for (const ep of section.endpoints) {
      flat.push({ ...ep, sectionId: section.id, sectionTitle: section.title })
    }
  }
  return flat
}
