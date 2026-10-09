/** Server-only origin may be set at runtime independently of public build variables. */
export function authOrigin() {
  const value = process.env.APP_ORIGIN?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.syaahii.in";
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash ||
      (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))))
    throw new Error("Configure a valid authentication origin.");
  return url.origin;
}
