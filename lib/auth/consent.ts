import { mutateState } from "@/lib/study/state";
export const TERMS_VERSION = "2026-09-24";
export const hasConsent = (body: {
  acceptTerms?: unknown;
  termsVersion?: unknown;
}) => body.acceptTerms === true && body.termsVersion === TERMS_VERSION;
export async function recordConsent(user: string) {
  await mutateState(
    user,
    "terms-consent",
    { version: "", acceptedAt: "" },
    () => ({ version: TERMS_VERSION, acceptedAt: new Date().toISOString() }),
  );
}
