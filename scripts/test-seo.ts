import assert from "node:assert/strict";
import { NextRequest } from "next/server";

async function main() {
  process.env.NEXT_PUBLIC_APP_URL = "https://www.syaahii.in";
  const { middleware } = await import("../middleware");
  for (const host of ["https://syaahii.in", "https://syaahii.vercel.app"]) {
    const response = middleware(
      new NextRequest(`${host}/subjects/physics?utm_source=old-domain`),
    );
    assert.equal(response.status, 308);
    assert.equal(
      response.headers.get("location"),
      "https://www.syaahii.in/subjects/physics?utm_source=old-domain",
    );
  }

  const [{ default: sitemap }, { GET: llms }] = await Promise.all([
    import("../app/sitemap"),
    import("../app/llms.txt/route"),
  ]);
  const entries = await sitemap();
  const urls = entries.map((entry) => entry.url);
  assert(urls.includes("https://www.syaahii.in/"));
  assert(urls.includes("https://www.syaahii.in/subjects/physics"));
  assert(urls.includes("https://www.syaahii.in/writing"));
  for (const path of [
    "syaahi",
    "writing/features",
    "writing/pricing",
    "writing/medium-comparison",
    "ai-presentations",
  ])
    assert(urls.includes("https://www.syaahii.in/" + path));
  assert(
    !urls.some((u) => u.endsWith("/presentations")),
    "Private studio is not a public discovery page",
  );
  assert(
    !urls.some((url) =>
      /\/(writer|write|dashboard|subscribe|account)(\/|$)/.test(url),
    ),
  );
  assert(!urls.some((url) => /\/(login|signup|forgot-password)$/.test(url)));

  const facts = await (await llms()).text();
  assert(facts.includes("19 welcome credits after email verification"));
  assert(facts.includes("[How it works](https://www.syaahii.in/how-it-works)"));
  assert(!facts.includes("/dashboard"));
  const { default: robots } = await import("../app/robots");
  const rules = robots().rules as Array<{
    allow: string[];
    disallow: string[];
  }>;
  assert(rules[0].allow.includes("/api/writing/images/"));
  assert(rules[0].disallow.includes("/api/"));
  assert(facts.includes("students, teachers, professionals and writers"));
  assert(facts.includes("Try ₹9"));
  assert(facts.includes("Popular ₹79"));
  assert(facts.includes("exactly Free and Max ₹399"));
  assert(facts.includes("public plain-text responses"));
  const { GET: publicFacts } = await import("../app/product-facts.json/route");
  const product = await publicFacts().json();
  assert.equal(product.workspaces.length, 3);
  assert.equal(product.pricing.writer.length, 2);
  assert.deepEqual(
    product.pricing.student.map((p: any) => p.inr),
    [399],
  );
  const { publicationFeed } = await import("../lib/writing/feed");
  const feed = publicationFeed([
    {
      slug: "safe-story",
      title: "A <source> & story",
      summary: "<script>bad</script>",
      body: "PUBLIC BODY",
      authorName: "Writer & name",
      creatorSlug: "writer",
      tags: [],
      createdAt: "2026-10-05T00:00:00Z",
      updatedAt: "2026-10-05T00:00:00Z",
      publishedAt: "2026-10-05T00:00:00Z",
    },
  ]);
  assert(feed.includes("A &lt;source&gt; &amp; story"));
  assert(!feed.includes("<script>"));
  assert(!feed.includes("PUBLIC BODY"));
  assert(feed.includes("/guides/safe-story"));
  assert(
    facts.includes("[Writing and publishing](https://www.syaahii.in/writing)"),
  );
  console.log(
    "PASS: apex and Vercel aliases permanently redirect; sitemap stays canonical and excludes noindex auth pages; llms.txt lists public pages and current credit facts.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
