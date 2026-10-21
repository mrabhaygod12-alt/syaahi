import InkReportLoader from "./InkReportLoader";
export default async function InkReportPage({ params }: { params: Promise<{ id: string }> }) { return <InkReportLoader id={(await params).id} />; }
