// Real YouTube intake — no mocks, ever.
// Strategy chain (first success wins):
//   1. oEmbed → real video title + author (proves the link resolves; always attempted)
//   2. youtube-transcript lib → caption text (works when captions exist — verified live)
//   3. watch-page captionTracks scrape → same captions via different path (when lib is blocked)
// If 2+3 both fail, we return an HONEST error (video has no captions / is private /
// age-restricted) — never fake notes generated from the URL string.

export interface YTResult {
  videoId: string;
  title: string | null;
  author: string | null;
  durationSeconds: number | null;
  durationSource: "watch-page" | "piped-api" | "unknown";
  transcript: string;
  transcriptChars: number;
  transcriptSource: "youtube-transcript" | "watch-page-captions" | "none";
  debug: string[];
}

export const MAX_SECONDS = 3600; // 60-minute limit: longer videos are rejected with an alert

export function fmtDur(sec: number): string {
  const h = Math.floor(sec / 3600),
    m = Math.floor((sec % 3600) / 60),
    s = sec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

export function videoId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{6,20})/,
  );
  return m?.[1] ?? null;
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

async function oembed(id: string, debug: string[]) {
  try {
    const r = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`,
      { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) },
    );
    if (!r.ok) {
      debug.push(`oembed:http-${r.status}`);
      return { title: null, author: null };
    }
    const j = await r.json();
    return {
      title: String(j.title ?? ""),
      author: String(j.author_name ?? ""),
    };
  } catch (e: any) {
    debug.push(`oembed:${String(e?.message).slice(0, 80)}`);
    return { title: null, author: null };
  }
}

async function fetchWatchHtml(id: string, debug: string[]): Promise<string> {
  try {
    const r = await fetch(`https://www.youtube.com/watch?v=${id}&hl=en`, {
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) {
      debug.push(`watch:http-${r.status}`);
      return "";
    }
    return await r.text();
  } catch (e: any) {
    debug.push(`watch:${String(e?.message).slice(0, 100)}`);
    return "";
  }
}

function parseDuration(html: string): number | null {
  const m =
    html.match(/"lengthSeconds":"?(\d+)"?/) ??
    html.match(/"approxDurationMs":"?(\d+)"?/);
  if (!m) return null;
  const v = Number(m[1]);
  if (m[0].includes("approxDurationMs")) return Math.round(v / 1000);
  return v;
}

export async function getDuration(
  id: string,
  debug: string[],
): Promise<{
  seconds: number | null;
  source: YTResult["durationSource"];
  title: string | null;
}> {
  const html = await fetchWatchHtml(id, debug);
  if (html) {
    const d = parseDuration(html);
    if (d !== null && d > 0)
      return { seconds: d, source: "watch-page", title: null };
    if (/\\"isLive\\?":true|"isLiveContent":true|"isUpcoming"/.test(html))
      return { seconds: 0, source: "watch-page", title: null };
    debug.push("watch:no-lengthSeconds");
  }
  return { seconds: null, source: "unknown", title: null };
}
async function viaLibrary(id: string, debug: string[]): Promise<string> {
  try {
    const mod: any = await import("youtube-transcript");
    const YT = mod.YoutubeTranscript ?? mod.default ?? mod;
    // Prefer English captions explicitly — default track can be another language.
    let items: Array<{ text: string }>;
    try {
      items = await YT.fetchTranscript(id, { lang: "en" });
    } catch {
      items = await YT.fetchTranscript(id);
    }
    return items
      .map((i) => i.text)
      .join(" ")
      .slice(0, 100000);
  } catch (e: any) {
    debug.push(`lib:${String(e?.message).slice(0, 100)}`);
    return "";
  }
}

function stripVtt(s: string): string {
  return s
    .replace(/WEBVTT[\s\S]*?\n\n/, "")
    .replace(/\d{2}:\d{2}:\d{2}\.\d{3} --> [\d:. ]+/g, " ")
    .replace(/<\/?[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100000);
}

async function viaWatchPage(id: string, debug: string[]): Promise<string> {
  try {
    const r = await fetch(`https://www.youtube.com/watch?v=${id}&hl=en`, {
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) {
      debug.push(`watch:http-${r.status}`);
      return "";
    }
    const html = await r.text();
    const m = html.match(/"captionTracks":(\[.*?\])/);
    if (!m) {
      debug.push("watch:no-captionTracks");
      return "";
    }
    const tracks = JSON.parse(m[1]);
    const track =
      tracks.find((t: any) => t.languageCode === "en") ??
      tracks.find((t: any) => String(t.languageCode).startsWith("en")) ??
      tracks[0];
    if (!track?.baseUrl) {
      debug.push("watch:no-baseUrl");
      return "";
    }
    const captionUrl = new URL(track.baseUrl);
    if (
      captionUrl.protocol !== "https:" ||
      !["www.youtube.com", "youtube.com"].includes(captionUrl.hostname)
    )
      return "";
    const t2 = await fetch(captionUrl.href + "&fmt=vtt", {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(20000),
    });
    if (!t2.ok) {
      debug.push(`watch:cap-http-${t2.status}`);
      return "";
    }
    return stripVtt(await t2.text());
  } catch (e: any) {
    debug.push(`watch:${String(e?.message).slice(0, 100)}`);
    return "";
  }
}

export async function fetchYouTube(url: string): Promise<YTResult> {
  const id = videoId(url);
  if (!id)
    throw new Error("Not a YouTube watch / shorts / live / youtu.be URL.");
  const debug: string[] = [];

  // Duration guard FIRST — reject over-long videos before any heavy work.
  const dur = await getDuration(id, debug);
  if (dur.seconds !== null && dur.seconds <= 0) {
    throw new Error(
      "Live streams and upcoming premieres are not supported — please provide a published video between 0 to 60 minutes.",
    );
  }
  if (dur.seconds !== null && dur.seconds > MAX_SECONDS) {
    throw new Error(
      `Please provide a video between 0 to 60 minutes — this video is ${fmtDur(dur.seconds)} long ` +
        `(${Math.round(dur.seconds / 60)} minutes). Videos longer than 60 minutes are not supported.`,
    );
  }

  const [{ title, author }, libText] = await Promise.all([
    oembed(id, debug),
    viaLibrary(id, debug),
  ]);
  const realTitle = title ?? dur.title;

  if (libText.trim().length > 200) {
    return {
      videoId: id,
      title: realTitle,
      author,
      durationSeconds: dur.seconds,
      durationSource: dur.source,
      transcript: libText,
      transcriptChars: libText.length,
      transcriptSource: "youtube-transcript",
      debug,
    };
  }
  debug.push(`lib:too-short(${libText.length})`);

  const watchText = await viaWatchPage(id, debug);
  if (watchText.trim().length > 200) {
    return {
      videoId: id,
      title: realTitle,
      author,
      durationSeconds: dur.seconds,
      durationSource: dur.source,
      transcript: watchText,
      transcriptChars: watchText.length,
      transcriptSource: "watch-page-captions",
      debug,
    };
  }

  if (!realTitle)
    throw new Error(
      `Video ${id} is unreachable (private, deleted, or region-blocked). Debug: ${debug.join(" | ")}`,
    );
  throw new Error(
    `“${realTitle}” has no readable captions, so there is nothing to summarize. ` +
      `Tip: use a lecture with subtitles enabled, or generate from the title as a manual topic. Debug: ${debug.join(" | ")}`,
  );
}
