import { publicWriterProfile, writerBySlug } from "./profile";
export async function publicCreator(slug: string) {
  const backend = process.env.BACKEND_URL?.trim();
  const remote =
    process.env.APP_ROLE === "frontend" ||
    process.env.VERCEL === "1" ||
    (!!backend && !["backend", "worker"].includes(process.env.APP_ROLE || ""));
  if (!remote) {
    const profile = await writerBySlug(slug);
    return profile ? publicWriterProfile(profile) : null;
  }
  if (!backend || !process.env.BACKEND_PROXY_SECRET)
    throw new Error("Creator service is unavailable.");
  const url = new URL(`/api/creators/${encodeURIComponent(slug)}`, backend);
  if (
    url.username ||
    url.password ||
    (url.protocol !== "https:" &&
      !["localhost", "127.0.0.1"].includes(url.hostname))
  )
    throw new Error("Invalid creator service configuration.");
  const res = await fetch(url, {
    headers: { "x-syaahi-proxy": process.env.BACKEND_PROXY_SECRET },
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Creator service is temporarily unavailable.");
  return (await res.json()).creator as ReturnType<typeof publicWriterProfile>;
}
