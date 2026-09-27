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
    bg: "linear-gradient(135deg, #059669 0%, #064e3b 100%)",
    accent: "#34d399",
    emoji: "🌊",
  },
  {
    id: "anime-2",
    name: "Nezuko",
    anime: "Demon Slayer",
    tagline: "Demon Blood Art",
    bg: "linear-gradient(135deg, #db2777 0%, #831843 100%)",
    accent: "#f472b6",
    emoji: "🌸",
  },
  {
    id: "anime-3",
    name: "Satoru Gojo",
    anime: "Jujutsu Kaisen",
    tagline: "Limitless & Six Eyes",
    bg: "linear-gradient(135deg, #2563eb 0%, #1e1b4b 100%)",
    accent: "#60a5fa",
    emoji: "👁️",
  },
  {
    id: "anime-4",
    name: "Luffy",
    anime: "One Piece",
    tagline: "King of the Pirates",
    bg: "linear-gradient(135deg, #dc2626 0%, #7f1d1d 100%)",
    accent: "#f87171",
    emoji: "👒",
  },
  {
    id: "anime-5",
    name: "Zoro",
    anime: "One Piece",
    tagline: "Three-Sword Style",
    bg: "linear-gradient(135deg, #16a34a 0%, #14532d 100%)",
    accent: "#4ade80",
    emoji: "⚔️",
  },
  {
    id: "anime-6",
    name: "Naruto",
    anime: "Naruto Shippuden",
    tagline: "Nine-Tails Sage",
    bg: "linear-gradient(135deg, #ea580c 0%, #7c2d12 100%)",
    accent: "#fb923c",
    emoji: "🍥",
  },
  {
    id: "anime-7",
    name: "Kakashi",
    anime: "Naruto Shippuden",
    tagline: "Copy Ninja Hatake",
    bg: "linear-gradient(135deg, #475569 0%, #0f172a 100%)",
    accent: "#94a3b8",
    emoji: "⚡",
  },
  {
    id: "anime-8",
    name: "Itachi",
    anime: "Naruto Shippuden",
    tagline: "Mangekyo Sharingan",
    bg: "linear-gradient(135deg, #991b1b 0%, #18181b 100%)",
    accent: "#ef4444",
    emoji: "🦅",
  },
  {
    id: "anime-9",
    name: "Goku",
    anime: "Dragon Ball Z",
    tagline: "Super Saiyan Ultra Instinct",
    bg: "linear-gradient(135deg, #f59e0b 0%, #b45309 100%)",
    accent: "#fde047",
    emoji: "🔥",
  },
  {
    id: "anime-10",
    name: "Levi",
    anime: "Attack on Titan",
    tagline: "Humanity's Strongest",
    bg: "linear-gradient(135deg, #0284c7 0%, #0c4a6e 100%)",
    accent: "#38bdf8",
    emoji: "🗡️",
  },
  {
    id: "anime-11",
    name: "Eren",
    anime: "Attack on Titan",
    tagline: "Attack & Founding Titan",
    bg: "linear-gradient(135deg, #4d7c0f 0%, #1a2e05 100%)",
    accent: "#a3e635",
    emoji: "🕊️",
  },
  {
    id: "anime-12",
    name: "Mikasa",
    anime: "Attack on Titan",
    tagline: "Ackerman Prodigy",
    bg: "linear-gradient(135deg, #b91c1c 0%, #27272a 100%)",
    accent: "#f87171",
    emoji: "🧣",
  },
  {
    id: "anime-13",
    name: "Deku",
    anime: "My Hero Academia",
    tagline: "One For All 9th",
    bg: "linear-gradient(135deg, #10b981 0%, #064e3b 100%)",
    accent: "#6ee7b7",
    emoji: "🥦",
  },
  {
    id: "anime-14",
    name: "Killua",
    anime: "Hunter x Hunter",
    tagline: "Godspeed Assassin",
    bg: "linear-gradient(135deg, #6366f1 0%, #312e81 100%)",
    accent: "#a5b4fc",
    emoji: "⚡",
  },
  {
    id: "anime-15",
    name: "Saitama",
    anime: "One Punch Man",
    tagline: "Hero for Fun",
    bg: "linear-gradient(135deg, #eab308 0%, #713f12 100%)",
    accent: "#fef08a",
    emoji: "👊",
  },
  {
    id: "anime-16",
    name: "Shinobu",
    anime: "Demon Slayer",
    tagline: "Insect Hashira",
    bg: "linear-gradient(135deg, #8b5cf6 0%, #4c1d95 100%)",
    accent: "#c4b5fd",
    emoji: "🦋",
  },
  {
    id: "anime-17",
    name: "Hinata",
    anime: "Naruto Shippuden",
    tagline: "Byakugan Princess",
    bg: "linear-gradient(135deg, #c084fc 0%, #581c87 100%)",
    accent: "#e9d5ff",
    emoji: "✨",
  },
  {
    id: "anime-18",
    name: "Anya",
    anime: "Spy x Family",
    tagline: "Telepathic Starlight",
    bg: "linear-gradient(135deg, #f43f5e 0%, #881337 100%)",
    accent: "#fda4af",
    emoji: "🥜",
  },
  {
    id: "anime-19",
    name: "Violet",
    anime: "Violet Evergarden",
    tagline: "Auto Memory Doll",
    bg: "linear-gradient(135deg, #0ea5e9 0%, #1e3a8a 100%)",
    accent: "#7dd3fc",
    emoji: "✉️",
  },
  {
    id: "anime-20",
    name: "Rem",
    anime: "Re:Zero",
    tagline: "Demon Maid of Roswaal",
    bg: "linear-gradient(135deg, #38bdf8 0%, #1e40af 100%)",
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
