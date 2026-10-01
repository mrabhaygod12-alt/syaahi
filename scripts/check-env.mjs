// Print variable names and configuration errors only, never secret values.
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
const errors = [];
for (const [name, value] of Object.entries(process.env)) {
  if (
    value &&
    name.startsWith("NEXT_PUBLIC_") &&
    /SECRET|PRIVATE|SERVICE_ROLE|DATABASE|MONGODB|RESEND|OPENAI|GEMINI|GROQ|PROXY/.test(
      name,
    )
  )
    errors.push(`${name}: server credential must not be public`);
  if (
    value &&
    name.startsWith("NEXT_PUBLIC_") &&
    /API_KEY|TOKEN/.test(name) &&
    !/^NEXT_PUBLIC_SUPABASE_(?:ANON|PUBLISHABLE)_KEY$/.test(name)
  )
    errors.push(`${name}: API credential must not be public`);
  if (
    value &&
    name.startsWith("NEXT_PUBLIC_SUPABASE_") &&
    value.startsWith("eyJ")
  ) {
    try {
      if (
        JSON.parse(Buffer.from(value.split(".")[1], "base64url").toString())
          .role === "service_role"
      )
        errors.push(
          `${name}: service-role credentials must remain server-only`,
        );
    } catch {
      /* Non-JWT publishable keys are supported. */
    }
  }
}
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0")
  errors.push("NODE_TLS_REJECT_UNAUTHORIZED: TLS verification is disabled");
if (process.env.ENABLE_DIAGNOSTICS === "true")
  errors.push("ENABLE_DIAGNOSTICS: disable on production services");
if (
  process.env.APP_ROLE === "frontend" &&
  (!process.env.BACKEND_URL || !process.env.BACKEND_PROXY_SECRET)
)
  errors.push("Frontend needs BACKEND_URL and BACKEND_PROXY_SECRET");
if (process.env.APP_ROLE === "backend" && !process.env.BACKEND_PROXY_SECRET)
  errors.push("Backend needs BACKEND_PROXY_SECRET");
if (process.env.RAZORPAY_KEY_ID && !process.env.RAZORPAY_KEY_SECRET)
  errors.push("Razorpay key pair is incomplete");
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    "Environment safety checks passed. Provider validity and hosted settings require separate verification.",
  );
