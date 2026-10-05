import PresentationPlan from "@/components/presentations/PresentationPlan";
export const metadata = {
  title: "Review your presentation plan",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <PresentationPlan id={(await params).id} />;
}
