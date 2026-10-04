import PresentationStudio from "@/components/PresentationStudio";
export const metadata = {
  title: "Your presentation",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="container">
      <PresentationStudio id={(await params).id} />
    </div>
  );
}
