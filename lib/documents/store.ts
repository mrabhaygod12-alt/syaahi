import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { collection, useMongo } from "@/lib/storage/mongo";
import {
  chunkPages,
  evidenceBundle,
  rankChunks,
  type DocumentChunk,
} from "./retrieval";
import { semanticChunks, vectorEnabled } from "./vectors";

export interface StudyDocument {
  id: string;
  owner: string;
  name: string;
  pageCount: number;
  createdAt: string;
  chunks: DocumentChunk[];
  vectorReady?: boolean;
  vectorModel?: string;
  vectorOffset?: number;
}
export async function listDocuments(owner: string) {
  let documents: StudyDocument[];
  if (useMongo())
    documents = (await (
      await collection("study_documents")
    )
      .find(
        { owner, deletedAt: { $exists: false } },
        { projection: { chunks: 0 } },
      )
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray()) as StudyDocument[];
  else {
    setup();
    documents = db()
      .prepare(
        "SELECT payload FROM study_documents WHERE owner=? ORDER BY json_extract(payload,'$.createdAt') DESC LIMIT 100",
      )
      .all(owner)
      .map((row) => JSON.parse(String(row.payload)));
  }
  return documents.map(
    ({ id, name, pageCount, vectorReady, vectorOffset }) => ({
      id,
      name,
      pageCount,
      vectorReady: !!vectorReady,
      indexedChunks: vectorOffset || 0,
    }),
  );
}
function setup() {
  db().exec(
    "CREATE TABLE IF NOT EXISTS study_documents (id TEXT PRIMARY KEY, owner TEXT NOT NULL, payload TEXT NOT NULL); CREATE INDEX IF NOT EXISTS study_documents_owner ON study_documents(owner)",
  );
}
export async function saveDocument(
  owner: string,
  name: string,
  pageCount: number,
  pages: Array<{ num: number; text: string }>,
) {
  const chunks = chunkPages(pages);
  if (!chunks.length)
    throw new Error(
      "This PDF has no readable text. Upload an OCR-processed PDF or a screenshot.",
    );
  const document: StudyDocument = {
    id: randomUUID(),
    owner,
    name: name.slice(0, 160),
    pageCount,
    createdAt: new Date().toISOString(),
    chunks,
  };
  if (useMongo())
    await (
      await collection("study_documents")
    ).insertOne({ _id: document.id, ...document });
  else {
    setup();
    db()
      .prepare("INSERT INTO study_documents VALUES (?,?,?)")
      .run(document.id, owner, JSON.stringify(document));
  }
  return document;
}
export async function getDocument(
  owner: string,
  id: string,
): Promise<StudyDocument | null> {
  if (useMongo())
    return (await (
      await collection("study_documents")
    ).findOne({
      _id: id,
      owner,
      deletedAt: { $exists: false },
    })) as StudyDocument | null;
  setup();
  const row = db()
    .prepare("SELECT payload FROM study_documents WHERE id=? AND owner=?")
    .get(id, owner);
  return row ? JSON.parse(String(row.payload)) : null;
}
export async function deleteDocument(owner: string, id: string) {
  if (useMongo()) {
    const docs = await collection("study_documents");
    // Revoke access immediately. Keep a tombstone until vector cleanup succeeds.
    return (
      (
        await docs.updateOne(
          { _id: id, owner, deletedAt: { $exists: false } },
          { $set: { deletedAt: Date.now(), chunks: [] } },
        )
      ).modifiedCount > 0
    );
  }
  setup();
  return (
    db()
      .prepare("DELETE FROM study_documents WHERE id=? AND owner=?")
      .run(id, owner).changes > 0
  );
}
export async function documentEvidence(
  owner: string,
  id: string,
  query: string,
  range?: { from: number; to: number },
) {
  const document = await getDocument(owner, id);
  if (!document)
    throw new Error("Textbook was removed or is unavailable to this account.");
  const chunks = range
    ? document.chunks.filter(
        (chunk) => chunk.page >= range.from && chunk.page <= range.to,
      )
    : document.chunks;
  const lexical = rankChunks(chunks, query, 12);
  let matches: DocumentChunk[] = lexical.slice(0, 8),
    method = "BM25";
  if (
    document.vectorReady &&
    vectorEnabled() &&
    document.vectorModel ===
      (process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001")
  ) {
    try {
      const semantic = await semanticChunks(owner, id, query, range);
      const scores = new Map<string, number>();
      for (const ids of [lexical.map((chunk) => chunk.id), semantic])
        ids.forEach((chunkId, rank) =>
          scores.set(chunkId, (scores.get(chunkId) || 0) + 1 / (60 + rank + 1)),
        );
      matches = chunks
        .filter((chunk) => scores.has(chunk.id))
        .sort((a, b) => scores.get(b.id)! - scores.get(a.id)!)
        .slice(0, 8);
      method = "BM25 + semantic retrieval";
    } catch {
      /* Lexical retrieval remains available during provider outages. */
    }
  }
  return { document, matches, context: evidenceBundle(matches), method };
}
