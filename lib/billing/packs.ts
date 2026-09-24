// Storage uses integer page units. One token buys three generated sections.
export const PAGES_PER_TOKEN = 3;
export const tokenLabel = (pages: number) =>
  `${Number((pages / PAGES_PER_TOKEN).toFixed(2))} tokens`;
export const PACKS: Record<string, { credits: number; inr: number }> = {
  try: { credits: 3, inr: 9 },
  starter: { credits: 15, inr: 39 },
  popular: { credits: 36, inr: 79 },
  pro: { credits: 90, inr: 179 },
};
