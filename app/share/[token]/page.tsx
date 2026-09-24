import SharedLesson from "@/components/SharedLesson";
export const metadata = {
  title: "Shared lesson | Syaahi",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return <SharedLesson token={(await params).token} />;
}
