import RewriteDesk from "./RewriteDesk";
export default async function InkRewritePage({
  searchParams,
}: {
  searchParams: Promise<{ report?: string; start?: string; end?: string }>;
}) {
  const p = await searchParams;
  return (
    <RewriteDesk
      initialText=""
      reportId={p.report}
      start={p.start === undefined ? undefined : Number(p.start)}
      end={p.end === undefined ? undefined : Number(p.end)}
    />
  );
}
