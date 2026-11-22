import type { AssignmentSource } from "./types";

type CrossrefWork = {
  DOI?: string;
  title?: string[];
  author?: Array<{ given?: string; family?: string; name?: string }>;
  published?: { "date-parts"?: number[][] };
  issued?: { "date-parts"?: number[][] };
  "container-title"?: string[];
  URL?: string;
  abstract?: string;
};

function clean(value: unknown, max = 600): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function yearFrom(work: CrossrefWork): number | null {
  const raw =
    work.published?.["date-parts"]?.[0]?.[0] ??
    work.issued?.["date-parts"]?.[0]?.[0];
  return typeof raw === "number" &&
    Number.isInteger(raw) &&
    raw >= 1000 &&
    raw <= 2200
    ? raw
    : null;
}

function asSource(
  work: CrossrefWork,
  indexedBy: AssignmentSource["indexedBy"],
): AssignmentSource | null {
  const doi = clean(work.DOI, 180).toLowerCase();
  if (!/^10\.\d{4,9}\/[-._;()/:a-z0-9]+$/i.test(doi)) return null;
  const title = clean(work.title?.[0], 300);
  if (!title) return null;
  const authors = (work.author || [])
    .slice(0, 8)
    .map((a) =>
      clean(a.name || [a.given, a.family].filter(Boolean).join(" "), 100),
    )
    .filter(Boolean);
  return {
    doi,
    title,
    authors,
    year: yearFrom(work),
    venue: clean(work["container-title"]?.[0], 200),
    url: `https://doi.org/${encodeURIComponent(doi).replace(/%2F/gi, "/")}`,
    abstract: clean(work.abstract, 900),
    indexedBy,
  };
}

function crossrefHeaders() {
  return {
    "User-Agent":
      "Syaahi Assignment Studio/1.0 (https://www.syaahii.in; educational metadata lookup)",
    Accept: "application/json",
  };
}

async function searchCrossref(query: string): Promise<AssignmentSource[]> {
  const url = new URL("https://api.crossref.org/works");
  url.search = new URLSearchParams({
    "query.bibliographic": query,
    rows: "8",
    select: "DOI,title,author,published,issued,container-title,URL,abstract",
  }).toString();
  const response = await fetch(url, {
    headers: crossrefHeaders(),
    signal: AbortSignal.timeout(7000),
    redirect: "error",
  });
  if (!response.ok) return [];
  const data = await response.json();
  return (data?.message?.items || []).flatMap((work: CrossrefWork) => {
    const source = asSource(work, ["Crossref"]);
    return source ? [source] : [];
  });
}

function openAlexAbstract(index: unknown): string {
  if (!index || typeof index !== "object") return "";
  const words: Array<[number, string]> = [];
  for (const [word, positions] of Object.entries(index)) {
    if (!Array.isArray(positions)) continue;
    for (const position of positions)
      if (Number.isSafeInteger(position)) words.push([position, word]);
  }
  return words
    .sort((a, b) => a[0] - b[0])
    .map(([, word]) => word)
    .join(" ")
    .slice(0, 900);
}

async function searchOpenAlex(query: string): Promise<AssignmentSource[]> {
  const url = new URL("https://api.openalex.org/works");
  url.search = new URLSearchParams({
    search: query,
    per_page: "8",
    select:
      "doi,title,publication_year,authorships,primary_location,abstract_inverted_index",
  }).toString();
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(7000),
    redirect: "error",
  });
  if (!response.ok) return [];
  const data = await response.json();
  return (data?.results || []).flatMap((work: any) => {
    const doiValue =
      typeof work.doi === "string"
        ? work.doi.replace(/^https?:\/\/doi\.org\//i, "")
        : "";
    if (!/^10\.\d{4,9}\/[-._;()/:a-z0-9]+$/i.test(doiValue)) return [];
    const authors = (work.authorships || [])
      .slice(0, 8)
      .map((a: any) => clean(a?.author?.display_name, 100))
      .filter(Boolean);
    const title = clean(work.title, 300);
    if (!title) return [];
    return [
      {
        doi: doiValue.toLowerCase(),
        title,
        authors,
        year: Number.isInteger(work.publication_year)
          ? work.publication_year
          : null,
        venue: clean(work.primary_location?.source?.display_name, 200),
        url: `https://doi.org/${encodeURIComponent(doiValue).replace(/%2F/gi, "/")}`,
        abstract: openAlexAbstract(work.abstract_inverted_index),
        indexedBy: ["OpenAlex" as const],
      },
    ];
  });
}

export async function searchAssignmentSources(
  query: string,
): Promise<AssignmentSource[]> {
  const [crossref, openAlex] = await Promise.allSettled([
    searchCrossref(query),
    searchOpenAlex(query),
  ]);
  const merged = new Map<string, AssignmentSource>();
  for (const result of [crossref, openAlex]) {
    if (result.status !== "fulfilled") continue;
    for (const source of result.value) {
      const old = merged.get(source.doi);
      merged.set(
        source.doi,
        old
          ? {
              ...old,
              abstract: old.abstract || source.abstract,
              venue: old.venue || source.venue,
              authors: old.authors.length ? old.authors : source.authors,
              indexedBy: Array.from(
                new Set([...old.indexedBy, ...source.indexedBy]),
              ),
            }
          : source,
      );
    }
  }
  return [...merged.values()].slice(0, 12);
}

export async function resolveAssignmentSources(
  dois: unknown,
): Promise<AssignmentSource[]> {
  if (!Array.isArray(dois)) return [];
  const values = [
    ...new Set(
      dois
        .filter((item): item is string => typeof item === "string")
        .map((doi) =>
          doi
            .trim()
            .replace(/^https?:\/\/doi\.org\//i, "")
            .toLowerCase(),
        ),
    ),
  ].slice(0, 8);
  const resolved = await Promise.all(
    values.map(async (doi) => {
      if (!/^10\.\d{4,9}\/[-._;()/:a-z0-9]+$/i.test(doi)) return null;
      try {
        const response = await fetch(
          `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
          {
            headers: crossrefHeaders(),
            signal: AbortSignal.timeout(6500),
            redirect: "error",
          },
        );
        if (response.ok) {
          const data = await response.json();
          const source = asSource(data?.message as CrossrefWork, ["Crossref"]);
          if (source) return source;
        }
      } catch {
        // Fall through to the second scholarly index.
      }
      try {
        const matches = await searchOpenAlex(doi);
        return matches
          .find((source) => source.doi === doi)
          ?.indexedBy.includes("OpenAlex")
          ? matches.find((source) => source.doi === doi)!
          : null;
      } catch {
        return null;
      }
    }),
  );
  return resolved.filter((source): source is AssignmentSource =>
    Boolean(source),
  );
}

export function formatReference(
  source: AssignmentSource,
  style: string,
): string {
  const apaNames = source.authors.map((name) => {
    const bits = name.split(/\s+/).filter(Boolean);
    const family = bits.pop() || name;
    const initials = bits
      .map((part) => `${part[0]?.toUpperCase() || ""}.`)
      .join(" ");
    return initials ? `${family}, ${initials}` : family;
  });
  const ieeeNames = source.authors.map((name) => {
    const bits = name.split(/\s+/).filter(Boolean);
    const family = bits.pop() || name;
    return `${bits.map((part) => `${part[0]?.toUpperCase() || ""}.`).join(" ")} ${family}`.trim();
  });
  const names = source.authors.length
    ? source.authors.join(", ")
    : "Author not listed";
  const year = source.year ? ` (${source.year})` : " (n.d.)";
  const title = source.title;
  const venue = source.venue ? ` ${source.venue}.` : "";
  if (style === "IEEE")
    return `${ieeeNames.join(", ") || "Author not listed"}, “${title},”${venue}${source.year ? ` ${source.year}.` : ""} https://doi.org/${source.doi}`;
  if (style === "MLA 9")
    return `${names}. “${title}.”${venue}${source.year ? ` ${source.year}.` : ""} https://doi.org/${source.doi}.`;
  return `${apaNames.join(", ") || "Author not listed"}${year}. ${title}.${venue} https://doi.org/${source.doi}`;
}
