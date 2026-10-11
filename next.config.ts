import type { NextConfig } from "next";
const config: NextConfig = {
  distDir: process.env.BRILLIANCY_E2E === "true" ? ".next-e2e" : ".next",
  output: "standalone",
  poweredByHeader: false,
  devIndicators: false,
  cacheMaxMemorySize: 0,
  serverExternalPackages: ["@electric-sql/pglite", "pg", "pdf-parse", "sharp"],
  experimental: { serverActions: { bodySizeLimit: "1mb" } },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          ...(process.env.DEPLOYMENT_MODE === "demo"
            ? [{ key: "X-Robots-Tag", value: "noindex, nofollow" }]
            : []),
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          ...(process.env.NODE_ENV === "production"
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=31536000; includeSubDomains",
                },
              ]
            : []),
        ],
      },
    ];
  },
};
export default config;
