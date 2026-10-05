import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { createHash } from "node:crypto";
import ipaddr from "ipaddr.js";
import { load } from "cheerio";
export function publicResearchUrl(value: string): URL {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    url.href.length > 2000 ||
    url.hostname.endsWith(".local") ||
    url.hostname === "localhost"
  )
    throw new Error(
      "Use a public HTTPS article URL without credentials or a custom port.",
    );
  if (
    [...url.searchParams.keys()].some((k) =>
      /^(token|secret|password|api[_-]?key|signature|access[_-]?token)$/i.test(
        k,
      ),
    )
  )
    throw new Error(
      "Do not import URLs containing private access credentials.",
    );
  url.hash = "";
  return url;
}
export function isPublicAddress(address: string) {
  try {
    const parsed = ipaddr.process(address);
    return parsed.range() === "unicast";
  } catch {
    return false;
  }
}
async function resolvePublic(url: URL) {
  let timer: ReturnType<typeof setTimeout>;
  const rows = await Promise.race([
    lookup(url.hostname, { all: true, verbatim: true }),
    new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error("Source DNS lookup timed out.")),
        5000,
      );
    }),
  ]).finally(() => clearTimeout(timer!));
  if (!rows.length || rows.some((row) => !isPublicAddress(row.address)))
    throw new Error(
      "Private, local and reserved network addresses cannot be imported.",
    );
  return rows[0];
}
/** Pin the validated address into TLS lookup; redirects repeat validation. */
export async function publicPage(
  value: string,
  maxBytes = 2_000_000,
  redirects = 0,
  beforeFetch?: (url: URL) => Promise<void>,
): Promise<{ url: string; type: string; body: string; status: number }> {
  const url = publicResearchUrl(value);
  await beforeFetch?.(url);
  const address = await resolvePublic(url);
  const response = await new Promise<{
    status: number;
    headers: import("node:http").IncomingHttpHeaders;
    body: string;
  }>((resolve, reject) => {
    const req = request(
      url,
      {
        method: "GET",
        headers: {
          "User-Agent": "SyaahiResearch/1.0 (+https://www.syaahii.in/about)",
          Accept: "text/html,text/plain;q=0.9",
          "Accept-Encoding": "identity",
        },
        lookup: ((_host: any, options: any, callback: any) =>
          options?.all
            ? callback(null, [address])
            : callback(null, address.address, address.family)) as any,
      },
      (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode || 0)) {
          res.resume();
          resolve({ status: res.statusCode!, headers: res.headers, body: "" });
          return;
        }
        let bytes = 0;
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > maxBytes) {
            res.destroy(
              new Error("Source is too large. Upload a document instead."),
            );
          } else chunks.push(chunk);
        });
        res.on("end", () =>
          resolve({
            status: res.statusCode || 500,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
        res.on("error", reject);
      },
    );
    const timer = setTimeout(
      () => req.destroy(new Error("Source download timed out.")),
      10000,
    );
    req.on("close", () => clearTimeout(timer));
    req.on("error", reject);
    req.end();
  });
  if (
    [301, 302, 303, 307, 308].includes(response.status) &&
    response.headers.location
  ) {
    if (redirects >= 3) throw new Error("Too many source redirects.");
    return publicPage(
      new URL(response.headers.location, url).href,
      maxBytes,
      redirects + 1,
      beforeFetch,
    );
  }
  return {
    url: url.href,
    type: String(response.headers["content-type"] || ""),
    body: response.body,
    status: response.status,
  };
}
export function robotsAllows(robots: string, path: string) {
  const groups: {
    agents: string[];
    rules: { allow: boolean; pattern: string }[];
  }[] = [];
  let group: (typeof groups)[number] | null = null;
  for (const row of robots.split(/\r?\n/)) {
    const [key, ...rest] = row.replace(/#.*$/, "").split(":");
    const value = rest.join(":").trim();
    if (key.trim().toLowerCase() === "user-agent") {
      if (!group || group.rules.length) {
        group = { agents: [], rules: [] };
        groups.push(group);
      }
      group.agents.push(value.toLowerCase());
    } else if (group && /^(allow|disallow)$/i.test(key.trim()) && value)
      group.rules.push({
        allow: key.trim().toLowerCase() === "allow",
        pattern: value,
      });
  }
  const specific = groups.filter((g) =>
      g.agents.some((a) => a !== "*" && "syaahiresearch".startsWith(a)),
    ),
    selected = specific.length
      ? specific
      : groups.filter((g) => g.agents.includes("*"));
  const rules = selected
    .flatMap((g) => g.rules)
    .filter((r) =>
      new RegExp(
        "^" +
          r.pattern
            .split("*")
            .map((s) => s.replace(/[.+?^{}()|[\]\\]/g, "\\$&"))
            .join(".*")
            .replace(/\\\$$/, "$"),
      ).test(path),
    )
    .sort(
      (a, b) =>
        b.pattern.length - a.pattern.length ||
        Number(b.allow) - Number(a.allow),
    );
  return !rules.length || rules[0].allow;
}
export function extractPublicText(html: string, type: string) {
  if (/text\/plain/i.test(type))
    return { name: "Web reference", text: html.trim().slice(0, 24000) };
  if (!/text\/html|application\/xhtml/i.test(type))
    throw new Error(
      "Import an HTML article or plain text. Upload PDFs through your document library.",
    );
  const $ = load(html);
  $(
    "script,style,nav,header,footer,form,iframe,noscript,svg,button,aside,[hidden]",
  ).remove();
  const name =
    $("title").first().text().trim().slice(0, 100) ||
    $("h1").first().text().trim().slice(0, 100) ||
    "Web reference";
  const root = $("article").first().length
    ? $("article").first()
    : $("main").first().length
      ? $("main").first()
      : $("body");
  root.find("br").replaceWith("\n");
  root.find("p,h1,h2,h3,h4,li,tr,blockquote").each((_, el) => {
    $(el).append("\n");
  });
  return {
    name,
    text: root
      .text()
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s*\n/g, "\n")
      .trim()
      .slice(0, 24000),
  };
}
export async function researchLink(value: string) {
  const url = publicResearchUrl(value);
  const policies = new Map<string, Awaited<ReturnType<typeof publicPage>>>();
  const checkPolicy = async (target: URL) => {
    if (/(^|\.)(geeksforgeeks\.org|w3schools\.com)$/.test(target.hostname))
      throw new Error(
        "This site's published terms restrict automated extraction. Paste material you can use instead.",
      );
    let policy = policies.get(target.origin);
    if (!policy) {
      policy = await publicPage(new URL("/robots.txt", target).href, 256000);
      policies.set(target.origin, policy);
    }
    if (
      policy.status !== 404 &&
      (policy.status !== 200 ||
        !robotsAllows(policy.body, target.pathname + target.search))
    )
      throw new Error(
        "This site does not permit article extraction. Supply your own reference text instead.",
      );
  };
  // Check the destination policy before following every article redirect.
  const result = await publicPage(url.href, 2_000_000, 0, checkPolicy);
  if (result.status !== 200)
    throw new Error(
      `The source returned ${result.status}. It may require sign-in or block automated access.`,
    );
  const final = publicResearchUrl(result.url);
  const content = extractPublicText(result.body, result.type);
  if (content.text.length < 150)
    throw new Error(
      "This page did not expose enough readable article text. Paste a reference or upload a document.",
    );
  return {
    id: `web-${createHash("sha256").update(final.href).digest("hex").slice(0, 24)}`,
    kind: "web" as const,
    ...content,
    locator: final.href,
    retrievedAt: new Date().toISOString(),
    truncated: content.text.length >= 24000,
  };
}
