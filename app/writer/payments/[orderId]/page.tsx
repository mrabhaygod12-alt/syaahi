import WriterServices from "@/components/writer/WriterServices";
export default async function Page({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  return <WriterServices view="payments" orderId={(await params).orderId} />;
}
