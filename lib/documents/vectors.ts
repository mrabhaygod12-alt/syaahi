import { createHash } from "node:crypto";
import { collection, useMongo } from "@/lib/storage/mongo";
import type { DocumentChunk } from "./retrieval";

export const vectorEnabled = () =>
  Boolean(process.env.QDRANT_URL && process.env.GEMINI_EMBEDDING_API_KEY);
const model = () =>
  process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
const indexName = () =>
  `syaahi_textbooks_${createHash("sha256").update(model()).digest("hex").slice(0, 12)}_768`;
async function qdrant(path: string, method: string, body?: unknown) {
  const base = new URL(process.env.QDRANT_URL!);
  if (
    base.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(base.hostname)
  )
    throw new Error("Qdrant requires HTTPS.");
  const response = await fetch(new URL(path, base), {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(process.env.QDRANT_API_KEY
        ? { "api-key": process.env.QDRANT_API_KEY }
        : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok)
    throw new Error(`Vector service failed (${response.status}).`);
  return response.json();
}
let prepared: Promise<void> | undefined;
async function ensureIndex() {
  prepared ||= (async () => {
    try {
      await qdrant(`/collections/${indexName()}`, "GET");
    } catch {
      try {
        await qdrant(`/collections/${indexName()}`, "PUT", {
          vectors: { size: 768, distance: "Cosine" },
        });
      } catch {
        await qdrant(`/collections/${indexName()}`, "GET");
      }
    }
    for (const field of ["owner", "documentId"])
      await qdrant(`/collections/${indexName()}/index?wait=true`, "PUT", {
        field_name: field,
        field_schema: "keyword",
      });
    await qdrant(`/collections/${indexName()}/index?wait=true`, "PUT", {
      field_name: "page",
      field_schema: "integer",
    });
  })().catch((error) => {
    prepared = undefined;
    throw error;
  });
  await prepared;
}
async function embed(texts: string[], query = false): Promise<number[][]> {
  if (!/^[a-zA-Z0-9.-]+$/.test(model()))
    throw new Error("Invalid embedding model.");
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model()}:batchEmbedContents`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_EMBEDDING_API_KEY!,
      },
      body: JSON.stringify({
        requests: texts.map((text) => ({
          model: `models/${model()}`,
          content: { parts: [{ text }] },
          taskType: query ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT",
          outputDimensionality: 768,
        })),
      }),
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!response.ok)
    throw new Error(`Embedding service failed (${response.status}).`);
  const data = await response.json();
  const vectors = data.embeddings?.map(
    (item: { values: number[] }) => item.values,
  );
  if (
    !Array.isArray(vectors) ||
    vectors.length !== texts.length ||
    vectors.some(
      (v) =>
        !Array.isArray(v) ||
        v.length !== 768 ||
        v.some((n) => !Number.isFinite(n)),
    )
  )
    throw new Error("Invalid embedding response.");
  return vectors;
}
const filter = (
  owner: string,
  documentId: string,
  range?: { from: number; to: number },
) => ({
  must: [
    { key: "owner", match: { value: owner } },
    { key: "documentId", match: { value: documentId } },
    ...(range
      ? [{ key: "page", range: { gte: range.from, lte: range.to } }]
      : []),
  ],
});
export async function semanticChunks(
  owner: string,
  documentId: string,
  query: string,
  range?: { from: number; to: number },
): Promise<string[]> {
  if (!vectorEnabled()) return [];
  const [vector] = await embed([query], true);
  const data = await qdrant(
    `/collections/${indexName()}/points/query`,
    "POST",
    {
      query: vector,
      filter: filter(owner, documentId, range),
      limit: 12,
      with_payload: true,
    },
  );
  return (data.result?.points || [])
    .map((point: { payload?: { chunkId?: string } }) => point.payload?.chunkId)
    .filter((id: unknown): id is string => typeof id === "string");
}

/** One bounded batch per tick, with a durable cursor and crash-recoverable lease. */
export async function indexDocumentBatch() {
  if (!useMongo() || !vectorEnabled()) return;
  const docs = await collection("study_documents"),
    now = Date.now();
  const removed = await docs.findOne({
    deletedAt: { $lt: now - 120000 },
    $or: [{ vectorLease: { $exists: false } }, { vectorLease: { $lt: now } }],
  });
  if (removed) {
    await ensureIndex();
    await qdrant(
      `/collections/${indexName()}/points/delete?wait=true`,
      "POST",
      { filter: filter(removed.owner, removed.id) },
    );
    await docs.deleteOne({ _id: removed._id, deletedAt: removed.deletedAt });
    return;
  }
  const doc = await docs.findOneAndUpdate(
    {
      deletedAt: { $exists: false },
      vectorReady: { $ne: true },
      $and: [
        {
          $or: [
            { vectorLease: { $exists: false } },
            { vectorLease: { $lt: now } },
          ],
        },
        {
          $or: [
            { vectorRetryAt: { $exists: false } },
            { vectorRetryAt: { $lt: now } },
          ],
        },
      ],
    },
    { $set: { vectorLease: now + 300000 } },
    { returnDocument: "after", sort: { createdAt: 1 } },
  );
  if (!doc) return;
  try {
    await ensureIndex();
    const offset = Number(doc.vectorOffset || 0),
      chunks = (doc.chunks as DocumentChunk[]).slice(offset, offset + 16);
    const vectors = chunks.length
      ? await embed(chunks.map((chunk) => chunk.text))
      : [];
    if (chunks.length)
      await qdrant(`/collections/${indexName()}/points?wait=true`, "PUT", {
        points: chunks.map((chunk, i) => {
          const hash = createHash("sha256")
            .update(`${doc.id}:${chunk.id}`)
            .digest("hex")
            .slice(0, 32);
          const id = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20)}`;
          return {
            id,
            vector: vectors[i],
            payload: {
              owner: doc.owner,
              documentId: doc.id,
              chunkId: chunk.id,
              page: chunk.page,
            },
          };
        }),
      });
    await docs.updateOne(
      {
        _id: doc._id,
        vectorLease: now + 300000,
        deletedAt: { $exists: false },
      },
      {
        $set: {
          vectorOffset: offset + chunks.length,
          vectorReady: offset + chunks.length >= doc.chunks.length,
          vectorModel: model(),
          vectorLease: 0,
          vectorFailures: 0,
        },
        $unset: { vectorRetryAt: "" },
      },
    );
  } catch {
    const failures = Number(doc.vectorFailures || 0) + 1;
    await docs.updateOne(
      { _id: doc._id, vectorLease: now + 300000 },
      {
        $set: {
          vectorLease: 0,
          vectorFailures: failures,
          vectorRetryAt: now + Math.min(3600000, failures * 60000),
        },
      },
    );
    console.warn(
      "Textbook vector indexing delayed; lexical retrieval remains available.",
    );
  }
}
