// Retry one transient overload without rotating credentials or evading quotas.
export async function geminiFetch(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  if (![502, 503].includes(response.status) || init.signal?.aborted)
    return response;
  await response.body?.cancel();
  await new Promise((resolve) => setTimeout(resolve, 1200));
  return fetch(url, init);
}
