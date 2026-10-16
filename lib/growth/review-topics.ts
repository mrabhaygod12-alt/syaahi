export const REVIEW_TOPICS = {
  general: "Overall experience",
  explanation: "Explanation accuracy",
  readability: "Note readability",
  export: "PDF or download",
  interface: "Workspace interface",
} as const;
export type ReviewTopic = keyof typeof REVIEW_TOPICS;
