export interface SearchMetadata {
  title: string;
  description: string;
  approvedAt: string;
}
export interface DiscoverySuggestions {
  title: string;
  description: string;
  topics: string[];
  questions: { question: string; evidence: string }[];
  improvements: string[];
}
export interface DiscoveryCheck {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}
export interface DiscoveryReport {
  id: string;
  owner: string;
  kind: "writer-discovery";
  updatedAt: string;
  storyId: string;
  storyUpdatedAt: string;
  fingerprint: string;
  suggestions: DiscoverySuggestions;
  checks: DiscoveryCheck[];
  provider: string;
  model: string;
}
