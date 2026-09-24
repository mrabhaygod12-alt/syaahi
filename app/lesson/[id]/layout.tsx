import LessonWorkspace from "@/components/workspace/LessonWorkspace";

export const metadata = {
  title: "Lesson workspace | Syaahi",
  robots: { index: false },
};

// Lesson ids are runtime data (file store) — never prerender. This also stops
// dev from attempting static-path generation for /lesson/[id]/* rooms.
export const dynamic = "force-dynamic";

export default async function LessonLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  return <LessonWorkspace id={(await params).id}>{children}</LessonWorkspace>;
}
