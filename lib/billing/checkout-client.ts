/** One bounded loader shared by retries; a failed load can be retried. */
let loading: Promise<void> | undefined;
export function loadCheckout(): Promise<void> {
  if ((window as any).Razorpay) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    const fail = () => {
      clearTimeout(timer);
      script.remove();
      loading = undefined;
      reject(
        new Error(
          "Checkout could not load. Check your connection and try again.",
        ),
      );
    };
    const timer = window.setTimeout(fail, 15000);
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => {
      if (!(window as any).Razorpay) return fail();
      clearTimeout(timer);
      resolve();
    };
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return loading;
}

export async function paymentRequest(path: string, body?: unknown) {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(25000),
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}
