import CreatorProfile from "@/components/writer/CreatorProfile";
import { notFound } from "next/navigation";
import { publicGuides } from "@/lib/writing/public";
import { publicCreator } from "@/lib/writing/public-profile";
import { pageMeta } from "@/lib/seo";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [profile, stories] = await Promise.all([
    publicCreator(slug),
    publicGuides("creator", slug),
  ]);
  const name = profile?.name || stories[0]?.authorName;
  return pageMeta({
    title: name ? `${name} | Syaahi Author` : "Creator not found",
    description: profile?.bio || `Read reviewed stories on Syaahi.`,
    path: `/creators/${slug}`,
    noindex: !name,
  });
}
export default async function CreatorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [profile, stories] = await Promise.all([
    publicCreator(slug),
    publicGuides("creator", slug),
  ]);
  if (!profile && !stories.length) notFound();
  const name = profile?.name || stories[0].authorName;
  return (
    <CreatorProfile profile={profile || { slug, name }} stories={stories} />
  );
}
