import RewriteDesk from "./RewriteDesk";
export default async function InkRewritePage({ searchParams }: { searchParams: Promise<{ report?: string }> }) { return <RewriteDesk initialText="" reportId={(await searchParams).report} />; }
