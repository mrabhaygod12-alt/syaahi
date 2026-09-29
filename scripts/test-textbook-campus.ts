import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";

function pdfFixture(count: number) {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Count ${count} /Kids [${Array.from({ length: count }, (_, i) => `${4 + i * 2} 0 R`).join(" ")}] >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  for (let i = 0; i < count; i++) {
    const content = `BT /F1 12 Tf 40 700 Td (Physical page ${i + 1} Dijkstra shortest path) Tj ET`;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`,
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    );
  }
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((n) => `${String(n).padStart(10, "0")} 00000 n \n`)
    .join(
      "",
    )}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "syaahi-textbook-test-"));
process.env.DATA_BACKEND = "sqlite";
delete process.env.MONGODB_URI;
delete process.env.QDRANT_URL;

async function main() {
  const { chunkPages, rankChunks, evidenceBundle } =
    await import("../lib/documents/retrieval");
  const docs = await import("../lib/documents/store");
  const campus = await import("../lib/campus/applications");
  const pages = Array.from({ length: 500 }, (_, i) => ({
    num: i + 1,
    text:
      i === 376
        ? "Dijkstra shortest path algorithm uses a priority queue."
        : `Chapter ${i + 1}: introduction to general study methods.`,
  }));
  const chunks = chunkPages(pages);
  assert.equal(chunks.length, 500);
  const ranked = rankChunks(chunks, "Dijkstra priority queue");
  assert.equal(ranked[0].page, 377);
  assert.match(evidenceBundle(ranked), /\[P377C1\].*physical PDF page 377/);
  assert.equal(rankChunks(chunks, "nonexistentterm").length, 0);
  const doc = await docs.saveDocument("alice", "Textbook.pdf", 500, pages);
  assert.equal(await docs.getDocument("bob", doc.id), null);
  assert.equal(await docs.deleteDocument("bob", doc.id), false);
  assert.equal(
    (
      await docs.documentEvidence("alice", doc.id, "Dijkstra", {
        from: 1,
        to: 100,
      })
    ).matches.length,
    0,
  );
  assert.equal(
    (
      await docs.documentEvidence("alice", doc.id, "Dijkstra", {
        from: 370,
        to: 380,
      })
    ).matches[0].page,
    377,
  );
  await assert.rejects(() => docs.documentEvidence("bob", doc.id, "Dijkstra"));
  assert.equal(await docs.deleteDocument("alice", doc.id), true);
  await assert.rejects(() =>
    docs.documentEvidence("alice", doc.id, "Dijkstra"),
  );
  const user = { id: "alice", name: "Alice", email: "alice@example.test" };
  const input = {
    kind: "ambassador",
    institution: "Example University",
    programme: "Computer Science",
    message:
      "I would like to coordinate a study group pilot for my classmates.",
    consent: true,
  };
  await assert.rejects(() => campus.apply(user, { ...input, consent: false }));
  const application = await campus.apply(user, input);
  await assert.rejects(() => campus.apply(user, input));
  assert.equal((await campus.applications("bob")).length, 0);
  assert.equal((await campus.applications("alice")).length, 1);
  const reviewed = await campus.reviewApplication(
    "admin",
    application.id,
    "reviewing",
    "Checking pilot details with the applicant.",
  );
  assert.equal(reviewed.status, "reviewing");
  assert.equal(reviewed.history.at(-1)?.actor, "admin");
  await assert.rejects(() =>
    campus.reviewApplication("admin", application.id, "accepted", ""),
  );
  const auth = await import("../lib/auth/server");
  const { markEmailVerified } = await import("../lib/billing/rewards");
  const account = await auth.register(
    "PDF Learner",
    "pdf@example.test",
    "long-test-password",
  );
  await markEmailVerified(account.id);
  const session = await auth.startSession(
    account,
    new Request("http://localhost"),
  );
  const cookie = session.headers.get("set-cookie")!.split(";")[0];
  const upload = await import("../app/api/documents/route");
  const form = new FormData();
  form.set(
    "file",
    new File([pdfFixture(500)], "test.pdf", { type: "application/pdf" }),
  );
  const response = await upload.POST(
    new NextRequest("http://localhost/api/documents", {
      method: "POST",
      headers: { cookie, origin: "http://localhost" },
      body: form,
    }),
  );
  const uploaded = await response.json();
  assert.equal(response.status, 201, JSON.stringify(uploaded));
  assert.equal(uploaded.pageCount, 500);
  assert.equal(
    (await docs.getDocument(account.id, uploaded.id))?.chunks.at(-1)?.page,
    500,
  );
  assert.equal((await docs.listDocuments("bob")).length, 0);
  assert.equal((await docs.listDocuments(account.id)).length, 1);
  const read = await import("../app/api/documents/[id]/route");
  assert.equal(
    (
      await read.GET(
        new NextRequest(
          `http://localhost/api/documents/${uploaded.id}?page=501`,
          { headers: { cookie } },
        ),
        { params: Promise.resolve({ id: uploaded.id }) },
      )
    ).status,
    400,
  );
  console.log(
    "PASS: 500-page retrieval, physical citations, account isolation, page ranges, deletion, campus consent, duplicate prevention and review history.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
