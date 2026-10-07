export const TICKET_STATUSES = [
  "open",
  "in_progress",
  "waiting",
  "resolved",
  "closed",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export interface SupportTicket {
  id: string;
  user: string;
  subject: string;
  category: string;
  status: TicketStatus;
  createdAt: string;
  workspace: "student" | "writer";
  messages: { by: "learner" | "support"; text: string; at: string }[];
  revision?: number;
  priority?: "normal" | "high" | "urgent";
  assignedTo?: string | null;
  internalNotes?: { actor: string; text: string; at: string }[];
  updatedAt?: string;
}
export interface TicketIndex {
  id: string;
  user: string;
  subject: string;
  category: string;
  status: string;
  createdAt: string;
  workspace?: "student" | "writer";
  priority?: SupportTicket["priority"];
  assignedTo?: string | null;
  updatedAt?: string;
}
