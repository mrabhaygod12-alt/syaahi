import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { NextRequest } from "next/server";

Object.assign(process.env, {
  DATA_DIR: mkdtempSync(join(tmpdir(), "syaahi-public-index-")),
  DATA_BACKEND: "sqlite",
  MONGODB_URI: "",
  APP_ROLE: "all",
  NEXT_PUBLIC_APP_URL: "https://www.syaahii.in",
});
delete process.env.BACKEND_URL;
delete process.env.VERCEL;

async function main() {
  let replica: any;
  if (process.argv.includes("--mongo")) {
    replica = await (
      await import("mongodb-memory-server")
    ).MongoMemoryReplSet.create({ replSet: { count: 1 } });
    process.env.MONGODB_URI = replica.getUri();
    process.env.DATA_BACKEND = "mongo";
  }
  try {
    const auth = await import("../lib/auth/server");
    const owner = await auth.register(
      "Index writer",
      "index@example.test",
      "long-safe-fixture-password",
    );
    const { db } = await import("../lib/db");
    const { collection, useMongo, mongo } =
      await import("../lib/storage/mongo");
    const index = await import("../lib/writing/public-index");
    const { default: sitemap } = await import("../app/sitemap");
    const publishedAt = "2026-10-01T06:00:00.000Z",
      updatedAt = "2026-10-10T06:00:00.000Z";
    const fixture = (id: string, extra: Record<string, unknown> = {}) => ({
      id,
      user: owner.id,
      creatorSlug: "index-writer",
      slug: "post-" + id,
      status: "published",
      createdAt: "2026-09-01T06:00:00.000Z",
      publishedAt,
      updatedAt,
      body: "PRIVATE STORAGE BODY",
      versions: [{ body: "PRIVATE REVISION BODY" }],
      reviewNote: "PRIVATE MODERATOR NOTE",
      authorName: "Index writer",
      ...extra,
    });
    async function insert(row: ReturnType<typeof fixture>) {
      if (useMongo())
        await (await collection("stories")).insertOne({ _id: row.id, ...row });
      else
        db()
          .prepare(
            "INSERT INTO stories(id,user_id,status,updated_at,payload) VALUES(?,?,?,?,?)",
          )
          .run(
            row.id,
            owner.id,
            String(row.status),
            String(row.updatedAt),
            JSON.stringify(row),
          );
    }
    // An entire first scan page is cross-posted; an empty output page must
    // retain its continuation cursor rather than hiding later original posts.
    for (let n = 0; n < 461; n++)
      await insert(
        fixture(
          "index-" + String(n).padStart(4, "0"),
          n < 201
            ? { canonicalUrl: "https://publisher.example.test/original-" + n }
            : n === 201
              ? {
                  canonicalUrl: "https://www.syaahii.in/guides/post-index-0201",
                }
              : {},
        ),
      );
    const hidden = [
      "draft",
      "submitted",
      "changes_requested",
      "removed",
      "scheduled",
      "unpublished",
      "archived",
    ];
    for (const status of hidden)
      await insert(
        fixture("private-" + status.replaceAll("_", "-"), { status }),
      );
    await insert(fixture("private-revision", { revisionOf: "index-0201" }));
    await insert(
      fixture("malformed-canonical", { canonicalUrl: "javascript:bad" }),
    );
    await insert(fixture("malformed-slug", { slug: "../private" }));
    const first = await index.listPublicationIndex();
    assert.equal(first.entries.length, 0);
    assert(first.nextCursor);
    const pages = new Map<string, any>([["", first]]);
    let cursor: string | null = first.nextCursor;
    while (cursor) {
      const next = await index.listPublicationIndex(cursor);
      assert(next.entries.length <= 200);
      pages.set(cursor, next);
      cursor = next.nextCursor;
    }
    const all = await index.allPublicationIndex();
    assert.equal(
      all.length,
      260,
      "All original published posts appear, beyond the latest 48",
    );
    assert.equal(new Set(all.map((e) => e.slug)).size, all.length);
    assert(all.some((e) => e.slug === "post-index-0460"));
    for (const row of all) {
      assert.deepEqual(Object.keys(row).sort(), [
        "creatorSlug",
        "publishedAt",
        "slug",
        "updatedAt",
      ]);
      assert.equal(row.publishedAt, publishedAt);
      assert.equal(row.updatedAt, updatedAt);
    }
    const map = await sitemap(),
      urls = map.map((e) => e.url);
    assert.equal(urls.filter((url) => url.includes("/guides/")).length, 260);
    assert.equal(urls.filter((url) => url.includes("/creators/")).length, 1);
    assert.equal(
      map.find((e) => e.url.endsWith("/guides/post-index-0460"))?.lastModified,
      updatedAt,
    );
    assert(
      !urls.some((url) =>
        /\/(write|writer|signup|dashboard|refer|payments)(\/|\?|$)/.test(url),
      ),
    );
    const { GET } = await import("../app/api/publications/index/route");
    const response = await GET(
      new NextRequest(
        "http://localhost/api/publications/index?cursor=" + first.nextCursor,
      ),
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    const dto = await response.text();
    for (const secret of [
      owner.id,
      "PRIVATE",
      "reviewNote",
      "versions",
      "body",
      "user",
    ])
      assert(!dto.includes(secret), "Public index must not expose " + secret);
    assert.equal(
      (
        await GET(
          new NextRequest(
            "http://localhost/api/publications/index?cursor=bad!",
          ),
        )
      ).status,
      400,
    );
    await assert.rejects(() => index.listPublicationIndex("eG95Lg"), /Invalid/);

    // A frontend uses the authenticated backend for each bounded page. Never
    // fall back to its empty local database or silently lose posts on outage.
    process.env.APP_ROLE = "frontend";
    process.env.BACKEND_URL = "https://backend.example.test";
    process.env.BACKEND_PROXY_SECRET = "index-fixture-secret";
    const original = globalThis.fetch;
    let fetches = 0;
    globalThis.fetch = async (input, options) => {
      const url = new URL(String(input));
      fetches++;
      assert.equal(url.origin, "https://backend.example.test");
      assert.equal(url.pathname, "/api/publications/index");
      assert.equal(
        new Headers(options?.headers).get("x-syaahi-proxy"),
        "index-fixture-secret",
      );
      assert.equal(options?.cache, "no-store");
      return Response.json(pages.get(url.searchParams.get("cursor") || ""));
    };
    try {
      assert.deepEqual(await index.allPublicationIndex(), all);
      assert(fetches >= 3);
      globalThis.fetch = async () => new Response("outage", { status: 503 });
      await assert.rejects(() => sitemap(), /temporarily unavailable/);
      globalThis.fetch = async () => Response.json(first);
      await assert.rejects(
        () => index.allPublicationIndex(),
        /did not advance/,
      );
    } finally {
      globalThis.fetch = original;
      process.env.APP_ROLE = "all";
      delete process.env.BACKEND_URL;
    }
    if (useMongo()) {
      await (
        await collection("stories")
      ).updateOne({ id: "index-0201" }, { $set: { status: "unpublished" } });
      await (
        await collection("stories")
      ).updateOne(
        { id: "index-0202" },
        { $set: { publishedAt: null, updatedAt: "invalid" } },
      );
    } else {
      db()
        .prepare(
          "UPDATE stories SET status='unpublished' WHERE id='index-0201'",
        )
        .run();
      db()
        .prepare(
          "UPDATE stories SET payload=json_set(payload,'$.publishedAt',NULL,'$.updatedAt','invalid') WHERE id='index-0202'",
        )
        .run();
    }
    const remaining = await index.allPublicationIndex();
    assert.equal(remaining.length, 259);
    assert(!remaining.some((row) => row.slug === "post-index-0201"));
    assert.equal(
      remaining.find((row) => row.slug === "post-index-0202")?.updatedAt,
      "2026-09-01T06:00:00.000Z",
    );
    // Metadata is evaluated directly here; CSS rendering is covered by the
    // browser suite. Node's module loader cannot parse stylesheet imports.
    const require = createRequire(join(process.cwd(), "package.json"));
    require.extensions[".css"] = () => {};
    const [
      { metadata: blogMeta },
      { generateMetadata: articleMeta },
      { metadata: signup },
      { metadata: write },
      { metadata: dashboard },
      { metadata: payments },
      { metadata: refer },
    ] = await Promise.all([
      import("../app/blog/page"),
      import("../app/blog/[slug]/page"),
      import("../app/signup/page"),
      import("../app/write/page"),
      import("../app/dashboard/page"),
      import("../app/payments/layout"),
      import("../app/refer/layout"),
    ]);
    assert.deepEqual(blogMeta.robots, { index: true, follow: true });
    const { BLOG_POSTS } = await import("../lib/blog-data");
    for (const post of BLOG_POSTS) {
      const meta = await articleMeta({
        params: Promise.resolve({ slug: post.slug }),
      });
      assert.deepEqual(meta.robots, { index: true, follow: true });
      assert.equal(
        meta.alternates?.canonical,
        "https://www.syaahii.in/blog/" + post.slug,
      );
    }
    assert.deepEqual(
      (await articleMeta({ params: Promise.resolve({ slug: "missing-post" }) }))
        .robots,
      { index: false, follow: false },
    );
    for (const privateMeta of [signup, write, dashboard, payments, refer])
      assert.equal((privateMeta.robots as any)?.index, false);
    if (useMongo()) await (await mongo()).client.close();
    console.log(
      `PASS (${useMongo() ? "MongoDB" : "SQLite"}): 260 original posts across bounded pages, no private/body fields, foreign canonicals excluded, sitemap dates/coverage, takedowns, authenticated frontend and visible outages, indexable blogs/private noindex boundaries.`,
    );
  } finally {
    if (replica) await replica.stop();
  }
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
