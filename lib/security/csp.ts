/** Per-response policy. Never accept a caller-provided nonce or policy. */
export function contentSecurityPolicy(nonce: string, development = false) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval' https://checkout.razorpay.com${development ? " 'unsafe-eval'" : ""}`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.googleusercontent.com https://images.unsplash.com https://images.pexels.com https://upload.wikimedia.org https://avatars.githubusercontent.com https://*.supabase.co https://*.razorpay.com",
    "font-src 'self' data:",
    `connect-src 'self' https://*.razorpay.com https://razorpay.com https://vitals.vercel-insights.com wss://generativelanguage.googleapis.com${development ? " ws://localhost:* ws://127.0.0.1:*" : ""}`,
    "media-src 'self' blob: data:",
    "frame-src 'self' blob: https://*.razorpay.com https://www.youtube-nocookie.com https://player.vimeo.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'self'",
    "form-action 'self'",
  ].join("; ");
}
