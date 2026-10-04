import { loadEnvConfig } from "@next/env";
import { diagnoseRazorpay } from "../lib/billing/diagnostics";

async function main() {
  const at = process.argv.indexOf("--env-file");
  if (at >= 0) {
    if (!process.argv[at + 1]) throw new Error("Missing environment file.");
    process.loadEnvFile(process.argv[at + 1]);
  } else loadEnvConfig(process.cwd());
  const report = await diagnoseRazorpay();
  console.log(JSON.stringify(report, null, 2));
  console.log(
    "Read-only GET requests only. No orders, subscriptions, charges or configuration changes.",
  );
  if (
    report.authentication !== "accepted" ||
    !report.webhookConfigured ||
    Object.values(report.plans).some((plan) => plan.status !== "verified")
  )
    process.exitCode = 1;
}
main().catch((error) => {
  console.error(
    "Could not load payment configuration. No credentials are printed.",
    {
      kind: error instanceof Error ? error.name : "unknown",
    },
  );
  process.exitCode = 1;
});
