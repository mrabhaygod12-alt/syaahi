import { pageMeta } from "@/lib/seo";
import AuthForm from "@/components/AuthForm";

export const metadata = pageMeta({
  title: "Sign up",
  description:
    "Create a free Syaahi account: 5 credits, no card. Generate handwritten exam notes in a minute.",
  path: "/signup",
  noindex: true,
});

export default function Signup() {
  return <AuthForm mode="signup" />;
}
