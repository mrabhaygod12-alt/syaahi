"use client";
import LessonProvider from "@/components/workspace/LessonProvider";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";

export default function LessonWorkspace({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  return (
    <LessonProvider id={id}>
      <WorkspaceShell>{children}</WorkspaceShell>
    </LessonProvider>
  );
}
