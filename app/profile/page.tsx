import { pageMeta } from "@/lib/seo";
import ProfileView from "@/components/ProfileView";

export const metadata = pageMeta({
  title: "Profile & Settings",
  description: "Manage your Syaahi profile, anime avatars, custom photo, and study tokens.",
  path: "/profile",
  noindex: true,
});

export default function ProfilePage() {
  return <ProfileView />;
}
