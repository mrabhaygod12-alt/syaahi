import { doiStrings } from "./sections";
export interface ScholarlyRecord {
  doi: string;
  status: "found" | "not-found" | "unavailable";
  title?: string;
  year?: number;
  publisher?: string;
  scopus: "not-configured" | "indexed" | "not-found" | "unavailable";
}
export interface ScholarlyTrace {
  enabled: boolean;
  provider: "Crossref";
  records: ScholarlyRecord[];
  totalDois: number;
  limited: boolean;
  message: string;
}
const cache = new Map<string, { until: number; value: ScholarlyRecord }>();
export const scopusConfigured = () =>
  !!process.env.SCOPUS_API_KEY &&
  process.env.SCOPUS_COMMERCIAL_LICENSED === "true";
async function boundedJson(r: Response) {
  const reader = r.body?.getReader();
  if (!reader) throw Error("Empty metadata");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const p = await reader.read();
      if (p.done) break;
      size += p.value.length;
      if (size > 256000) throw Error("Metadata too large");
      chunks.push(p.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
async function lookup(
  doi: string,
  signal: AbortSignal,
): Promise<ScholarlyRecord> {
  const key = doi + ":" + scopusConfigured(),
    cached = cache.get(key);
  if (cached && cached.until > Date.now()) return cached.value;
  const out: ScholarlyRecord = {
    doi,
    status: "unavailable",
    scopus: scopusConfigured() ? "unavailable" : "not-configured",
  };
  try {
    const r = await fetch(
      `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "Syaahii-AI-Ink/1.0 (+https://www.syaahii.in/ai-ink)",
        },
        signal,
        redirect: "error",
        cache: "no-store",
      },
    );
    if (r.status === 404) {
      out.status = "not-found";
      await r.body?.cancel();
    } else if (r.ok) {
      const m = (await boundedJson(r)).message;
      if (typeof m?.DOI === "string" && m.DOI.toLowerCase() === doi) {
        out.status = "found";
        out.title = String(m.title?.[0] || "")
          .replace(/<[^<>]*>/g, "")
          .slice(0, 300);
        out.publisher = String(m.publisher || "").slice(0, 160);
        const year = m.published?.["date-parts"]?.[0]?.[0];
        if (Number.isInteger(year)) out.year = year;
      }
    } else await r.body?.cancel();
  } catch {
    /* An outage is never a fabricated-reference verdict. */
  }
  if (scopusConfigured())
    try {
      const r = await fetch(
        `https://api.elsevier.com/content/abstract/doi/${encodeURIComponent(doi)}`,
        {
          headers: {
            Accept: "application/json",
            "X-ELS-APIKey": process.env.SCOPUS_API_KEY!,
          },
          signal,
          redirect: "error",
          cache: "no-store",
        },
      );
      if (r.status === 404) {
        out.scopus = "not-found";
        await r.body?.cancel();
      } else if (r.ok) {
        const data = await boundedJson(r),
          core = data["abstracts-retrieval-response"]?.coredata;
        const returned = String(core?.["prism:doi"] || "").toLowerCase();
        out.scopus = returned === doi && core?.eid ? "indexed" : "unavailable";
      } else await r.body?.cancel();
    } catch {
      out.scopus = "unavailable";
    }
  if (cache.size >= 200) cache.delete(cache.keys().next().value!);
  cache.set(key, {
    until:
      Date.now() +
      (out.status === "unavailable" || out.scopus === "unavailable"
        ? 60000
        : 86400000),
    value: out,
  });
  return out;
}
/** Explicit opt-in sends DOI identifiers only, never the submitted paper. */
export async function verifyDois(
  text: string,
  enabled: boolean,
): Promise<ScholarlyTrace> {
  const dois = doiStrings(text);
  if (!enabled)
    return {
      enabled: false,
      provider: "Crossref",
      records: [],
      totalDois: dois.length,
      limited: false,
      message: "External DOI verification was not requested.",
    };
  const records: ScholarlyRecord[] = [];
  const signal = AbortSignal.timeout(8000),
    selected = dois.slice(0, 8);
  for (let i = 0; i < selected.length; i += 2)
    records.push(
      ...(await Promise.all(
        selected.slice(i, i + 2).map((d) => lookup(d, signal)),
      )),
    );
  return {
    enabled: true,
    provider: "Crossref",
    records,
    totalDois: dois.length,
    limited: dois.length > 8,
    message:
      "DOI metadata is not full-text comparison or proof that a citation supports a claim. Only up to eight DOI identifiers are checked per report.",
  };
}
