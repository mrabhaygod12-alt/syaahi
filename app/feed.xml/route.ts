import { publicGuides } from "@/lib/writing/public";
import { publicationFeed } from "@/lib/writing/feed";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return new Response(publicationFeed(await publicGuides()), {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    });
  } catch {
    return Response.json(
      { error: "The public story feed is temporarily unavailable." },
      { status: 503, headers: { "Retry-After": "60" } },
    );
  }
}
