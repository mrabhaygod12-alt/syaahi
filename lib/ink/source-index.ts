import { createHash, randomUUID } from "node:crypto";
import { readState, mutateState } from "@/lib/study/state";
import { tokens, normalise } from "./text";
import type { SourceDocument } from "./match";
import { InputValidationError } from "@/lib/security/validation";
const KEY = "ink-private-index-v1",
  MAX_SOURCES = 20,
  MAX_WORDS = 12000;
interface IndexedSource {
  id: string;
  title: string;
  text: string;
  digest: string;
  fingerprints: string[];
  words: number;
  createdAt: string;
}
interface IndexState {
  sources: IndexedSource[];
}
function fingerprints(text: string) {
  const words = tokens(normalise(text));
  if (words.length > MAX_WORDS)
    throw new InputValidationError(
      "Split sources larger than 12,000 words into chapters.",
    );
  const hashes = new Set<string>();
  for (let i = 0; i + 8 <= words.length; i++)
    hashes.add(
      createHash("sha256")
        .update(words.slice(i, i + 8).join(" "))
        .digest("hex")
        .slice(0, 16),
    );
  return { hashes: [...hashes], words: words.length };
}
const read = (owner: string) =>
  readState<IndexState>(owner, KEY, { sources: [] });
export async function indexSummary(owner: string) {
  return (await read(owner)).sources.map(({ id, title, words, createdAt }) => ({
    id,
    title,
    words,
    createdAt,
  }));
}
export async function addIndexSource(
  owner: string,
  title: string,
  text: string,
) {
  if (text.trim().length < 200 || text.length > 60000)
    throw new InputValidationError(
      "Use 200–60,000 characters per comparison source.",
    );
  const clean = text.trim(),
    digest = createHash("sha256").update(clean).digest("hex"),
    fp = fingerprints(clean);
  let id = "";
  await mutateState<IndexState>(owner, KEY, { sources: [] }, (old) => {
    const duplicate = old.sources.find((s) => s.digest === digest);
    if (duplicate) {
      id = duplicate.id;
      return old;
    }
    if (old.sources.length >= MAX_SOURCES)
      throw new InputValidationError(
        "Your private index holds up to 20 sources. Remove an old source before adding another.",
      );
    id = `ink-source-${randomUUID()}`;
    return {
      sources: [
        ...old.sources,
        {
          id,
          title: title.trim().slice(0, 160) || "Untitled source",
          text: clean,
          digest,
          fingerprints: fp.hashes,
          words: fp.words,
          createdAt: new Date().toISOString(),
        },
      ],
    };
  });
  return { id };
}
export async function deleteIndexSource(owner: string, id: string) {
  await mutateState<IndexState>(owner, KEY, { sources: [] }, (old) => {
    if (!old.sources.some((s) => s.id === id))
      throw new InputValidationError("Unknown private source.");
    return { sources: old.sources.filter((s) => s.id !== id) };
  });
}
export async function querySourceIndex(
  owner: string,
  text: string,
  limit = 10,
) {
  // Query fingerprints are bounded by the submission character budget. Full
  // exact matching confirms candidates; hash collisions never count as evidence.
  const words = tokens(normalise(text)),
    query = new Set<string>();
  for (let i = 0; i + 8 <= words.length; i++)
    query.add(
      createHash("sha256")
        .update(words.slice(i, i + 8).join(" "))
        .digest("hex")
        .slice(0, 16),
    );
  const index = await read(owner),
    ranked = index.sources
      .map((s) => ({
        source: s,
        hits: s.fingerprints.reduce((n, h) => n + (query.has(h) ? 1 : 0), 0),
      }))
      .filter((s) => s.hits > 0)
      .sort((a, b) => b.hits - a.hits);
  const selected = ranked.slice(0, Math.max(0, Math.min(10, limit)));
  return {
    sources: selected.map(({ source: s }): SourceDocument => ({
      id: s.id,
      title: s.title,
      text: s.text,
      kind: "corpus",
      retrievedAt: s.createdAt,
    })),
    trace: {
      indexed: index.sources.length,
      candidates: ranked.length,
      compared: selected.length,
      limited: ranked.length > selected.length,
    },
  };
}
