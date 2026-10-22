/** Browser-side fetch helper for admin requests. Every request has a finite timeout. */
export async function adminFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 15000,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`The request timed out after ${Math.round(timeoutMs / 1000)} seconds. Check your connection and try again.`);
    }
    throw new Error("Unable to reach the server. Check your connection and try again.");
  } finally {
    clearTimeout(timeout);
  }
}
