import { redirect } from "next/navigation";
import LegacyUpiCheckout from "@/components/payments/LegacyUpiCheckout";
export default function Page() {
  if (process.env.LEGACY_CREDIT_PACK_CHECKOUT !== "1") redirect("/pricing");
  return <LegacyUpiCheckout />;
}
