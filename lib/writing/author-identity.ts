import { db } from "@/lib/db";
import { collection, useMongo } from "@/lib/storage/mongo";
import { writerBySlug, publicWriterProfile } from "./profile";

/** A public author identity is not writer enrollment or permission to edit. */
export async function publicAuthorIdentity(slug: string) {
  if (!/^[a-z0-9][a-z0-9-]{0,119}$/.test(slug)) return null;
  const profile = await writerBySlug(slug);
  if (profile)
    return { owner: profile.owner, profile: publicWriterProfile(profile) };

  // Old reviewed publications predate explicit writer enrollment. Resolve the
  // owner from approved records only; never trust a client-supplied author ID.
  // Group all owners before limiting so a reused/ambiguous slug cannot bind a
  // follow relationship to an arbitrary first story.
  const rows = useMongo()
    ? await (
        await collection("stories")
      )
        .aggregate([
          { $match: { status: "published", creatorSlug: slug } },
          { $sort: { publishedAt: -1 } },
          {
            $group: {
              _id: "$user",
              name: { $first: "$authorName" },
              joinedAt: { $min: "$publishedAt" },
            },
          },
          { $limit: 2 },
        ])
        .toArray()
    : db()
        .prepare(
          "SELECT user_id owner,json_extract(payload,'$.authorName') name,MIN(json_extract(payload,'$.publishedAt')) joinedAt FROM stories WHERE status='published' AND json_extract(payload,'$.creatorSlug')=? GROUP BY user_id LIMIT 2",
        )
        .all(slug)
        .map((row) => ({
          _id: row.owner,
          name: row.name,
          joinedAt: row.joinedAt,
        }));
  if (
    rows.length !== 1 ||
    typeof rows[0]._id !== "string" ||
    !rows[0]._id ||
    typeof rows[0].name !== "string"
  )
    return null;
  return {
    owner: rows[0]._id,
    profile: {
      slug,
      name: rows[0].name,
      joinedAt: String(rows[0].joinedAt || ""),
      bio: "",
      about: "",
      pronouns: [] as string[],
      avatar: "",
      website: "",
      accent: "forest",
      showConnections: false,
    },
  };
}
