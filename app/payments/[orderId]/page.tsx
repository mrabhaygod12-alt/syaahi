import PaymentStatus from "@/components/payments/PaymentStatus";
import { notFound } from "next/navigation";
export default async function Page({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  if (!/^order_[a-zA-Z0-9]+$/.test(orderId)) notFound();
  return <PaymentStatus orderId={orderId} />;
}
