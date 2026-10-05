import SharedDeck from "@/components/presentations/SharedDeck";
export const metadata = {
  title: "Shared presentation",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <div className="container">
      <SharedDeck token={(await params).token} />
    </div>
  );
}
