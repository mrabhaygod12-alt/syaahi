import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
const developmentKey = randomBytes(32).toString("hex");
const key = () =>
  process.env.GROWTH_SIGNING_SECRET ||
  process.env.BACKEND_PROXY_SECRET ||
  (process.env.NODE_ENV !== "production" ? developmentKey : "");
export function measurementProof(visitor: string, at = Date.now()) {
  const secret = key();
  return secret
    ? `${at}.${createHmac("sha256", secret).update(`${visitor}:${at}`).digest("hex")}`
    : "";
}
export function validMeasurementProof(visitor: string, proof: string) {
  const [stamp, signature] = proof.split(".");
  const at = Number(stamp);
  if (
    !/^[a-f0-9-]{36}$/i.test(visitor) ||
    !/^\d{13}$/.test(stamp || "") ||
    !/^[a-f0-9]{64}$/.test(signature || "") ||
    at > Date.now() + 300000 ||
    Date.now() - at > 90 * 86400000
  )
    return false;
  const expected = measurementProof(visitor, at).split(".")[1];
  return (
    !!expected &&
    timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"))
  );
}
