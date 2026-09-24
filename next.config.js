/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  distDir: process.env.NODE_ENV === "production" ? ".next-production" : ".next",
  devIndicators: false,
  serverExternalPackages: ["playwright", "playwright-core", "pdf-parse"],
  webpack(config, { isServer }) {
    if (isServer)
      config.externals.push({ "node:sqlite": "commonjs node:sqlite" });
    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(self), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value:
              "object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'",
          },
        ],
      },
    ];
  },
};
