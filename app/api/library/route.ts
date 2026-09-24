import { apiHandler } from "@/lib/api-handler";
import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

async function load() {
  try {
    const raw = await readFile(
      join(process.cwd(), "data", "library.json"),
      "utf8",
    );
    return JSON.parse(raw);
  } catch {
    return { packs: [], seeded: false };
  }
}

// GET /api/library → list · GET /api/library?slug=x → pack + free preview (page 1)
async function handleGET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  const lib = await load();
  if (slug) {
    const pack = lib.packs.find((p: any) => p.slug === slug);
    if (!pack)
      return NextResponse.json({ error: "unknown pack" }, { status: 404 });
    return NextResponse.json(
      {
        slug: pack.slug,
        title: pack.title,
        category: pack.category,
        pages: pack.pages,
        preview: pack.preview,
        note: "Public sample. Create a private lesson to explore this topic.",
      },
      {
        headers: {
          "Cache-Control":
            "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800",
        },
      },
    );
  }
  return NextResponse.json(
    {
      packs: lib.packs.map((p: any) => ({
        slug: p.slug,
        title: p.title,
        category: p.category,
        pages: p.pages,
        updatedAt: p.updatedAt,
      })),
    },
    {
      headers: {
        "Cache-Control":
          "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
}

export const GET = apiHandler(handleGET);
