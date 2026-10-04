"use client";
import DashboardClient from "./DashboardClient";
export default function DashboardRouter() {
  // WorkspaceProvider verifies the session before mounting this student view.
  return <DashboardClient />;
}
