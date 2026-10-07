import { SUBJECTS } from "@/lib/study/subjects";
import { DEPARTMENTS } from "./samples";
export interface LearningPreferences {
  exam: "cbse" | "jee" | "neet" | "university" | "other";
  subject: string;
  level: "ug" | "pg";
  department: string;
  language: "english" | "hindi";
  dailyGoal: number;
  readyNotifications: boolean;
  savedAt: string;
}
export const DEFAULT_LEARNING: LearningPreferences = {
  exam: "university",
  subject: "computer-science",
  level: "ug",
  department: "CSE",
  language: "english",
  dailyGoal: 15,
  readyNotifications: true,
  savedAt: "",
};
export function learningPreferences(input: unknown): LearningPreferences {
  const v = input as LearningPreferences;
  if (
    !v ||
    !["cbse", "jee", "neet", "university", "other"].includes(v.exam) ||
    !SUBJECTS.some((s) => s.slug === v.subject) ||
    !["ug", "pg"].includes(v.level) ||
    !DEPARTMENTS.includes(v.department) ||
    !["english", "hindi"].includes(v.language) ||
    !Number.isInteger(v.dailyGoal) ||
    v.dailyGoal < 5 ||
    v.dailyGoal > 120 ||
    typeof v.readyNotifications !== "boolean"
  )
    throw new Error(
      "Choose a study level, department, subject, language and a daily goal of 5–120 minutes.",
    );
  return {
    exam: v.exam,
    subject: v.subject,
    level: v.level,
    department: v.department,
    language: v.language,
    dailyGoal: v.dailyGoal,
    readyNotifications: v.readyNotifications,
    savedAt: new Date().toISOString(),
  };
}
