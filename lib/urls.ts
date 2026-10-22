/** Accept only absolute HTTP(S) URLs for user-managed external links. */
export function safeExternalUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 2048) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

/** Allow same-site paths or safe external links; reject protocol-relative and script URLs. */
export function safeHref(value: unknown, fallback = "/contact"): string {
  if (typeof value !== "string" || value.length > 2048) return fallback;
  if (value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")) return value;
  return safeExternalUrl(value) ?? fallback;
}
