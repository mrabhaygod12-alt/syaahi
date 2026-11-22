import type { Metadata } from "next";
import AssignmentStudio from "@/components/AssignmentStudio";

export const metadata: Metadata = {
  title: "Assignment Studio",
  description:
    "Plan, research, revise, and export university assignment drafts in handwritten-style A4 layouts.",
  robots: { index: false, follow: false },
};

export default function AssignmentPage() {
  return <AssignmentStudio />;
}
