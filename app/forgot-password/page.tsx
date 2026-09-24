import { pageMeta } from "@/lib/seo";
import ForgotClient from "./ForgotClient";

export const metadata = pageMeta({
  title: "Forgot password",
  description: "Reset your Syaahi password via email link.",
  path: "/forgot-password",
  noindex: true,
});

export default function Forgot() {
  return <ForgotClient />;
}
