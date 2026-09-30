import VoiceSessionHistory from "@/components/VoiceSessionHistory";
export const metadata = {
  title: "Private voice practice report | Syaahi",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <VoiceSessionHistory id={(await params).id} />;
}
