// 20 Curated Anime Character Avatars for Syaahi
export interface AnimeAvatar {
  id: string;
  name: string;
  anime: string;
  tagline: string;
  bg: string;
  accent: string;
  emoji: string;
}

export const ANIME_AVATARS: AnimeAvatar[] = [
  {
    id: "anime-1",
    name: "Tanjiro",
    anime: "Demon Slayer",
    tagline: "Water Breathing & Sun",
    bg: "#214b40",
    accent: "#34d399",
    emoji: "🌊",
  },
  {
    id: "anime-2",
    name: "Nezuko",
    anime: "Demon Slayer",
    tagline: "Demon Blood Art",
    bg: "#214b40",
    accent: "#f472b6",
    emoji: "🌸",
  },
  {
    id: "anime-3",
    name: "Satoru Gojo",
    anime: "Jujutsu Kaisen",
    tagline: "Limitless & Six Eyes",
    bg: "#214b40",
    accent: "#60a5fa",
    emoji: "👁️",
  },
  {
    id: "anime-4",
    name: "Luffy",
    anime: "One Piece",
    tagline: "King of the Pirates",
    bg: "#214b40",
    accent: "#f87171",
    emoji: "👒",
  },
  {
    id: "anime-5",
    name: "Zoro",
    anime: "One Piece",
    tagline: "Three-Sword Style",
    bg: "#214b40",
    accent: "#4ade80",
    emoji: "⚔️",
  },
  {
    id: "anime-6",
    name: "Naruto",
    anime: "Naruto Shippuden",
    tagline: "Nine-Tails Sage",
    bg: "#214b40",
    accent: "#fb923c",
    emoji: "🍥",
  },
  {
    id: "anime-7",
    name: "Kakashi",
    anime: "Naruto Shippuden",
    tagline: "Copy Ninja Hatake",
    bg: "#214b40",
    accent: "#94a3b8",
    emoji: "⚡",
  },
  {
    id: "anime-8",
    name: "Itachi",
    anime: "Naruto Shippuden",
    tagline: "Mangekyo Sharingan",
    bg: "#214b40",
    accent: "#ef4444",
    emoji: "🦅",
  },
  {
    id: "anime-9",
    name: "Goku",
    anime: "Dragon Ball Z",
    tagline: "Super Saiyan Ultra Instinct",
    bg: "#214b40",
    accent: "#fde047",
    emoji: "🔥",
  },
  {
    id: "anime-10",
    name: "Levi",
    anime: "Attack on Titan",
    tagline: "Humanity's Strongest",
    bg: "#214b40",
    accent: "#38bdf8",
    emoji: "🗡️",
  },
  {
    id: "anime-11",
    name: "Eren",
    anime: "Attack on Titan",
    tagline: "Attack & Founding Titan",
    bg: "#214b40",
    accent: "#a3e635",
    emoji: "🕊️",
  },
  {
    id: "anime-12",
    name: "Mikasa",
    anime: "Attack on Titan",
    tagline: "Ackerman Prodigy",
    bg: "#214b40",
    accent: "#f87171",
    emoji: "🧣",
  },
  {
    id: "anime-13",
    name: "Deku",
    anime: "My Hero Academia",
    tagline: "One For All 9th",
    bg: "#214b40",
    accent: "#6ee7b7",
    emoji: "🥦",
  },
  {
    id: "anime-14",
    name: "Killua",
    anime: "Hunter x Hunter",
    tagline: "Godspeed Assassin",
    bg: "#214b40",
    accent: "#a5b4fc",
    emoji: "⚡",
  },
  {
    id: "anime-15",
    name: "Saitama",
    anime: "One Punch Man",
    tagline: "Hero for Fun",
    bg: "#214b40",
    accent: "#fef08a",
    emoji: "👊",
  },
  {
    id: "anime-16",
    name: "Shinobu",
    anime: "Demon Slayer",
    tagline: "Insect Hashira",
    bg: "#214b40",
    accent: "#c4b5fd",
    emoji: "🦋",
  },
  {
    id: "anime-17",
    name: "Hinata",
    anime: "Naruto Shippuden",
    tagline: "Byakugan Princess",
    bg: "#214b40",
    accent: "#e9d5ff",
    emoji: "✨",
  },
  {
    id: "anime-18",
    name: "Anya",
    anime: "Spy x Family",
    tagline: "Telepathic Starlight",
    bg: "#214b40",
    accent: "#fda4af",
    emoji: "🥜",
  },
  {
    id: "anime-19",
    name: "Violet",
    anime: "Violet Evergarden",
    tagline: "Auto Memory Doll",
    bg: "#214b40",
    accent: "#7dd3fc",
    emoji: "✉️",
  },
  {
    id: "anime-20",
    name: "Rem",
    anime: "Re:Zero",
    tagline: "Demon Maid of Roswaal",
    bg: "#214b40",
    accent: "#bae6fd",
    emoji: "⭐",
  },
];

/**
 * Returns an anime avatar by ID, or deterministically picks one based on a string seed (user.id / email)
 */
export function getAnimeAvatar(idOrSeed?: string | null): AnimeAvatar {
  if (!idOrSeed) return ANIME_AVATARS[0];
  const exact = ANIME_AVATARS.find((a) => a.id === idOrSeed);
  if (exact) return exact;

  let hash = 0;
  for (let i = 0; i < idOrSeed.length; i++) {
    hash = (hash << 5) - hash + idOrSeed.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % ANIME_AVATARS.length;
  return ANIME_AVATARS[index];
}
