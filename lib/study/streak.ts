// Study streak (local-first): any learning action touches today.
// Consecutive-day count powers the dashboard 🔥 pill. Zero backend needed.
const KEY = "syaahi-days";

function dayStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function touchStudyDay(): void {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[];
    const today = dayStr(new Date());
    if (!raw.includes(today)) {
      localStorage.setItem(KEY, JSON.stringify([...raw.slice(-60), today]));
    }
  } catch {
    /* noop */
  }
}

export function getStreak(): number {
  try {
    const days = new Set<string>(JSON.parse(localStorage.getItem(KEY) ?? "[]"));
    let streak = 0;
    const d = new Date();
    if (!days.has(dayStr(d))) d.setDate(d.getDate() - 1); // streak alive if studied yesterday
    while (days.has(dayStr(d))) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  } catch {
    return 0;
  }
}
