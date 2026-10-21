import { requestJson as request, ServiceRequestError } from "@/lib/http-client";
export async function requestJson<T = Record<string, any>>(path: string, init: RequestInit = {}, timeout = 45000) {
  const result = await request<T>(path, init, timeout);
  if (!result.response.ok) throw new ServiceRequestError(
    typeof (result.data as any).error === "string" ? (result.data as any).error : "This request could not be completed.", result.response.status,
  );
  return result;
}
