export interface SectionGoal {
  id: string;
  title: string;
  objective: string;
  prerequisite: string;
}
export function sectionKey(title: string) {
  let hash = 2166136261;
  for (const c of title.trim())
    hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  return `section-${(hash >>> 0).toString(16)}`;
}
export function sectionGoals(topics: string[], value: unknown): SectionGoal[] {
  const values = Array.isArray(value) ? value.slice(0, 24) : [];
  return topics.slice(0, 24).map((title) => {
    const v = values.find((v) => v && v.title === title);
    return {
      id: sectionKey(title),
      title,
      objective:
        typeof v?.objective === "string"
          ? v.objective.trim().slice(0, 400)
          : "",
      prerequisite:
        typeof v?.prerequisite === "string"
          ? v.prerequisite.trim().slice(0, 400)
          : "",
    };
  });
}
