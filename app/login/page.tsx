import { pageMeta } from "@/lib/seo";
import AuthForm from "@/components/AuthForm";

export const metadata = pageMeta({
  title: "Log in",
  description:
    "Log in to Syaahi to access your credits, generation history and unlocked library packs.",
  path: "/login",
  noindex: true,
});

export default function Login() {
  return <AuthForm mode="login" />;
}
