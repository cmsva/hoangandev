/** @type {import('next').NextConfig} */
const nextConfig = {
  // Bảo mật
  poweredByHeader: false,
  reactStrictMode: true,
  compress: true,

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },

  // Bundle optimization — tree-shake heavy packages
  experimental: {
    optimizePackageImports: ["@/components/icons", "recharts"],
    // Next 16 chặn body upload 10MB mặc định ở lớp proxy. Nâng lên 210MB để
    // route /api/admin/upload-source nhận được file ZIP source tới 200MB.
    proxyClientMaxBodySize: "210mb",
  },

  // Security headers — defense in depth
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          // Strict-Transport-Security: chỉ apply khi prod (HTTPS)
          ...(process.env.NODE_ENV === "production"
            ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
            : []),
        ],
      },
      {
        // tRPC API — không cache
        source: "/api/trpc/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
        ],
      },
    ]
  },
}

export default nextConfig
