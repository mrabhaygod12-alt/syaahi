"use client";
import LessonProvider from "@/components/workspace/LessonProvider";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";
import { ToastHost } from "@/components/Toasts";
import CmdK from "@/components/CmdK";

export default function LessonWorkspace({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  return (
    <ToastHost>
      <CmdK />
      <LessonProvider id={id}>
        <WorkspaceShell>{children}</WorkspaceShell>
      </LessonProvider>
    </ToastHost>
  );
}
