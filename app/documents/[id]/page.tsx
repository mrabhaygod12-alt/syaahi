import DocumentReader from "@/components/DocumentReader";
export const metadata = {
  title: "Private textbook | Syaahi",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <DocumentReader id={(await params).id} />;
}
