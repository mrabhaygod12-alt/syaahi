import nextEnv from "@next/env";
import { readFileSync } from "node:fs";
nextEnv.loadEnvConfig(process.cwd());
async function main() {
  const { db, transaction } = await import("../lib/db");
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email)
    throw new Error(
      "Usage: npx tsx scripts/import-legacy.ts ACCOUNT_EMAIL [--apply]",
    );
  const user = db().prepare("SELECT id FROM users WHERE email=?").get(email);
  if (!user) throw new Error("Create the destination account first.");
  const records = Object.values(
    JSON.parse(readFileSync("data/jobs.json", "utf8")),
  ) as any[];
  const jobs = records.filter(
    (j) =>
      j.id &&
      Array.isArray(j.pages) &&
      !db().prepare("SELECT id FROM jobs WHERE id=?").get(j.id),
  );
  console.log(
    `${jobs.length} legacy lessons can be assigned to the specified account. Existing lessons and wallet balance remain unchanged.`,
  );
  if (!process.argv.includes("--apply")) {
    console.log(
      "Dry run. Add --apply after verifying this account owns the legacy material.",
    );
    return;
  }
  transaction(() => {
    for (const old of jobs) {
      const total = Number(old.total) || old.topics?.length || old.pages.length;
      const done = old.pages.length >= total;
      const job = {
        ...old,
        user: String(user.id),
        total,
        plannedTotal: old.plannedTotal || total,
        status: done ? "done" : "error",
        error: done
          ? null
          : "Imported partial lesson. Resume requires credits for missing sections.",
        finishedAt: old.finishedAt || new Date().toISOString(),
        progress: old.progress || { completed: [] },
        pdfTemplate: old.pdfTemplate || "classic",
        practice: old.practice || null,
      };
      db()
        .prepare(
          "INSERT INTO jobs (id,user_id,status,payload) VALUES (?,?,?,?)",
        )
        .run(job.id, job.user, job.status, JSON.stringify(job));
    }
  });
  console.log(
    `Imported ${jobs.length} lessons. Original JSON files preserved.`,
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
