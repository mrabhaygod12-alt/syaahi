"use client";
import { useState } from "react";
import { requestJson } from "@/lib/http-client";
export default function WorkspaceSwitch({
  current,
}: {
  current: "student" | "writer";
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div>
      <button
        className="btn light"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const { response, data } = await requestJson("/api/user/profile", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                workspace: current === "student" ? "writer" : "student",
              }),
            });
            if (data.code === "WRITER_ENROLLMENT_REQUIRED") {
              window.location.assign("/signup?workspace=writer&next=/writer");
              return;
            }
            if (!response.ok) throw new Error(data.error);
            window.location.assign(
              current === "student" ? "/writer" : "/dashboard?view=student",
            );
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "Could not switch workspace.",
            );
            setBusy(false);
          }
        }}
      >
        {busy
          ? "Switching…"
          : current === "writer"
            ? "Open learning workspace"
            : "Open writer dashboard"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
