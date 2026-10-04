"use client";
import { useAccount } from "../WorkspaceProvider";
export default function WriterStartLink() {
  const { user } = useAccount();
  return (
    <a
      className="btn dark"
      href={
        user?.workspace === "writer"
          ? "/writer/welcome"
          : "/signup?workspace=writer"
      }
    >
      {user?.workspace === "writer"
        ? "Open your writing space"
        : "Start your writing journey"}{" "}
      ↗
    </a>
  );
}
