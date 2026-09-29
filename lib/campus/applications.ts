import { randomUUID } from "node:crypto";
import { mutateState, readState } from "@/lib/study/state";
export type ApplicationStatus =
  "submitted" | "reviewing" | "accepted" | "declined";
export interface CampusApplication {
  id: string;
  owner: string;
  name: string;
  email: string;
  kind: "ambassador" | "institution";
  institution: string;
  programme: string;
  message: string;
  seats: number;
  createdAt: string;
  status: ApplicationStatus;
  history: Array<{
    at: string;
    actor: string;
    status: ApplicationStatus;
    note: string;
  }>;
}
type State = { applications: CampusApplication[] };
const scope = "campus-program",
  key = "applications";
export async function applications(owner?: string) {
  const state = await readState<State>(scope, key, { applications: [] });
  return state.applications.filter((item) => !owner || item.owner === owner);
}
export async function apply(
  user: { id: string; name: string; email: string },
  body: Record<string, unknown>,
) {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new Error("Enter valid application details.");
  if (body.consent !== true)
    throw new Error("Agree to being contacted about your application.");
  if (body.kind !== "ambassador" && body.kind !== "institution")
    throw new Error("Choose an application type.");
  const institution = String(body.institution || "")
    .trim()
    .slice(0, 160);
  const programme = String(body.programme || "")
    .trim()
    .slice(0, 160);
  const message = String(body.message || "")
    .trim()
    .slice(0, 2000);
  const seats = body.kind === "institution" ? Number(body.seats) : 1;
  if (institution.length < 3 || message.length < 30)
    throw new Error(
      "Add your institution and at least 30 characters describing your proposal.",
    );
  if (!Number.isInteger(seats) || seats < 1 || seats > 10000)
    throw new Error("Choose between 1 and 10,000 pilot seats.");
  const now = new Date().toISOString();
  const item: CampusApplication = {
    id: randomUUID(),
    owner: user.id,
    name: user.name,
    email: user.email,
    kind: body.kind,
    institution,
    programme,
    message,
    seats,
    createdAt: now,
    status: "submitted",
    history: [
      {
        at: now,
        actor: user.id,
        status: "submitted",
        note: "Applicant consented to application-related contact.",
      },
    ],
  };
  await mutateState<State>(scope, key, { applications: [] }, (state) => {
    if (
      state.applications.some(
        (old) =>
          old.owner === user.id &&
          old.kind === item.kind &&
          ["submitted", "reviewing", "accepted"].includes(old.status),
      )
    )
      throw new Error(
        "An application of this type is already active. You can view its status below.",
      );
    if (state.applications.length >= 1000)
      throw new Error(
        "Applications are temporarily at capacity. Please contact support.",
      );
    return { applications: [item, ...state.applications] };
  });
  return item;
}
export async function reviewApplication(
  actor: string,
  id: string,
  status: ApplicationStatus,
  note: string,
) {
  if (
    !["reviewing", "accepted", "declined"].includes(status) ||
    note.trim().length < 12
  )
    throw new Error(
      "Choose a review decision and add a clear note of at least 12 characters.",
    );
  const result = await mutateState<State>(
    scope,
    key,
    { applications: [] },
    (state) => {
      const item = state.applications.find((item) => item.id === id);
      if (!item) throw new Error("Application not found.");
      item.status = status;
      item.history = [
        ...item.history,
        {
          actor,
          at: new Date().toISOString(),
          status,
          note: note.trim().slice(0, 1200),
        },
      ].slice(-50);
      return state;
    },
  );
  return result.applications.find((item) => item.id === id)!;
}
