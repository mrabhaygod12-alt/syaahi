import { createHash, randomUUID } from "node:crypto";
import { mutateState, readState } from "@/lib/study/state";
export class VoiceSessionError extends Error {}

export interface VoiceTurn {
  speaker: "learner" | "coach";
  text: string;
}
export interface VoiceReport {
  summary: string;
  rubric: Array<{
    criterion: "structure" | "relevance" | "clarity" | "evidence";
    score: number | null;
    reason: string;
  }>;
  strengths: string[];
  nextSteps: string[];
  followUps: string[];
}
export interface VoiceSession {
  id: string;
  role: string;
  createdAt: string;
  turns: VoiceTurn[];
  report?: VoiceReport;
  reviewedAt?: string;
  fingerprint: string;
  reviewLease?: { token: string; until: number };
}
type State = { sessions: VoiceSession[] };
const key = "voice-interviews",
  fresh = (): State => ({ sessions: [] });
export const publicSession = ({
  fingerprint: _fingerprint,
  reviewLease: _lease,
  ...session
}: VoiceSession) => session;
export async function voiceSessions(owner: string) {
  return (await readState(owner, key, fresh())).sessions;
}
export async function voiceSession(owner: string, id: string) {
  return (await voiceSessions(owner)).find((s) => s.id === id) || null;
}
export async function saveVoiceSession(owner: string, body: unknown) {
  if (!body || typeof body !== "object")
    throw new VoiceSessionError("Provide a voice transcript.");
  const value = body as Record<string, unknown>;
  if (value.consent !== true)
    throw new VoiceSessionError(
      "Confirm that you want to save this transcript.",
    );
  if (
    typeof value.id !== "string" ||
    !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value.id)
  )
    throw new VoiceSessionError("Invalid session identifier.");
  if (
    typeof value.role !== "string" ||
    !value.role.trim() ||
    value.role.length > 120
  )
    throw new VoiceSessionError(
      "Provide a target role of up to 120 characters.",
    );
  if (
    !Array.isArray(value.turns) ||
    value.turns.length < 1 ||
    value.turns.length > 300
  )
    throw new VoiceSessionError("Provide between 1 and 300 transcript turns.");
  const turns: VoiceTurn[] = value.turns.map((turn) => {
    if (
      !turn ||
      !["learner", "coach"].includes(turn.speaker) ||
      typeof turn.text !== "string" ||
      !turn.text.trim() ||
      turn.text.length > 10000
    )
      throw new VoiceSessionError("Invalid transcript turn.");
    return { speaker: turn.speaker, text: turn.text.trim() };
  });
  if (turns.reduce((total, turn) => total + turn.text.length, 0) > 40000)
    throw new VoiceSessionError(
      "Transcript exceeds 40,000 characters. Start a shorter practice session.",
    );
  const role = value.role.trim();
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ role, turns }))
    .digest("hex");
  const saved: VoiceSession = {
    id: value.id,
    role,
    turns,
    fingerprint,
    createdAt: new Date().toISOString(),
  };
  const state = await mutateState(owner, key, fresh(), (state) => {
    const existing = state.sessions.find((item) => item.id === saved.id);
    if (existing) {
      if (existing.fingerprint !== fingerprint)
        throw new VoiceSessionError(
          "This saved session cannot be overwritten. Start a new practice session.",
        );
      return state;
    }
    if (state.sessions.length >= 20)
      throw new VoiceSessionError(
        "You have 20 saved voice sessions. Delete an older session before saving another.",
      );
    return { sessions: [saved, ...state.sessions] };
  });
  return state.sessions.find((item) => item.id === saved.id)!;
}
export async function deleteVoiceSession(owner: string, id: string) {
  await mutateState(owner, key, fresh(), (state) => ({
    sessions: state.sessions.filter((item) => item.id !== id),
  }));
}
export async function claimVoiceReview(owner: string, id: string) {
  const token = randomUUID();
  const state = await mutateState(owner, key, fresh(), (state) => {
    const session = state.sessions.find((item) => item.id === id);
    if (!session) throw new VoiceSessionError("Voice session not found.");
    if (session.report) return state;
    if (session.reviewLease && session.reviewLease.until > Date.now())
      throw new VoiceSessionError(
        "Coaching is already being prepared. Please reopen this session shortly.",
      );
    if (
      session.turns
        .filter((turn) => turn.speaker === "learner")
        .reduce((n, turn) => n + turn.text.length, 0) < 80
    )
      throw new VoiceSessionError(
        "Speak a longer answer before requesting coaching.",
      );
    session.reviewLease = { token, until: Date.now() + 180000 };
    return state;
  });
  return { session: state.sessions.find((item) => item.id === id)!, token };
}
export async function finishVoiceReview(
  owner: string,
  id: string,
  token: string,
  report?: VoiceReport,
) {
  const state = await mutateState(owner, key, fresh(), (state) => {
    const session = state.sessions.find((item) => item.id === id);
    if (!session || session.reviewLease?.token !== token) return state;
    delete session.reviewLease;
    if (report) {
      session.report = report;
      session.reviewedAt = new Date().toISOString();
    }
    return state;
  });
  return state.sessions.find((item) => item.id === id) || null;
}
