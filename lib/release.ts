/** Public commit identity only. Reject arbitrary environment text and secrets. */
export function releaseRevision(value: string | undefined): string | null {
  return value && /^[a-f0-9]{40}$/i.test(value.trim())
    ? value.trim().toLowerCase()
    : null;
}
