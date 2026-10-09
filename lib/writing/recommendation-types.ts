import type { WorkspaceRecord } from "@/lib/workspace-records";
export interface ReadingPreferences extends WorkspaceRecord {
  kind: "writer-reading-preferences";
  topics: string[];
  mutedTopics: string[];
  mutedCreators: string[];
  useReadingHistory: boolean;
}
export const suggestedInterests = [
  "computer science",
  "databases",
  "software engineering",
  "data science",
  "cybersecurity",
  "research",
  "career",
  "design",
  "writing",
  "technology",
];
