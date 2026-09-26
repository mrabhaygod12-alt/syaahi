import { pageMeta } from "@/lib/seo";
import AuthForm from "@/components/AuthForm";

export const metadata = pageMeta({
  title: "Sign up",
  description:
    "Create a free Syaahi account with 19 welcome credits. Generate handwritten-style exam notes, lessons, quizzes and flashcards.",
  path: "/signup",
  noindex: true,
});

export default function Signup() {
  return <AuthForm mode="signup" />;
}
