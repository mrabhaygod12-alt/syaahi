let active = 0;
/** Per-process load shedding. Horizontal balancing is the hosting ingress's job. */
export function admitRequest(req: Request): (() => void) | null {
  if (new URL(req.url).pathname === "/api/health") return () => {};
  const configured = Number(process.env.API_MAX_IN_FLIGHT || 32);
  const max =
    Number.isInteger(configured) && configured >= 4 && configured <= 256
      ? configured
      : 32;
  if (active >= max) return null;
  active++;
  let released = false;
  return () => {
    if (!released) {
      released = true;
      active--;
    }
  };
}
