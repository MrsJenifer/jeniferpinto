import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { contactSchema } from "@/lib/validation";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 8 * 1024;
const RATE_WINDOW_SECONDS = 10 * 60;
const RATE_MAX_REQUESTS = 5;

class RequestInputError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "RequestInputError";
  }
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function sameOriginRequest(req: Request): boolean {
  const origin = req.headers.get("origin");
  // Browser form submissions should always carry Origin in production. In development,
  // allow origin-less CLI smoke checks, but reject a provided mismatching Origin.
  if (!origin) return process.env.NODE_ENV !== "production";

  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(req.url);
    return originUrl.origin === requestUrl.origin;
  } catch {
    return false;
  }
}

async function readBoundedJson(req: Request): Promise<unknown> {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new RequestInputError("Content-Type must be application/json.", 415);
  }

  const contentLength = req.headers.get("content-length");
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) {
      throw new RequestInputError("Invalid Content-Length header.", 400);
    }
    if (Number(contentLength) > MAX_BODY_BYTES) {
      throw new RequestInputError("Enquiry request is too large.", 413);
    }
  }

  if (!req.body) throw new RequestInputError("Request body is required.", 400);

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new RequestInputError("Enquiry request is too large.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch {
    throw new RequestInputError("Request body must be valid UTF-8 JSON.", 400);
  }
}

function clientKeyHash(req: Request): string {
  // Prefer the platform-supplied direct client IP; when using X-Forwarded-For, use
  // the final proxy-added address instead of the left-most caller-supplied value.
  const realIp = req.headers.get("x-real-ip")?.trim();
  const forwarded = req.headers.get("x-forwarded-for")?.split(",").map((v) => v.trim()).filter(Boolean);
  const lastForwarded = forwarded && forwarded.length > 0 ? forwarded[forwarded.length - 1] : undefined;
  const clientAddress = (realIp || lastForwarded || "unknown").slice(0, 200);
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Server-side contact protection is not configured.");
  // Do not store raw IP addresses in the rate-limit table.
  return createHmac("sha256", secret).update(clientAddress).digest("hex");
}

export async function POST(req: Request) {
  if (!sameOriginRequest(req)) {
    return errorResponse("This request origin is not allowed.", 403);
  }

  let raw: unknown;
  try {
    raw = await readBoundedJson(req);
  } catch (error) {
    if (error instanceof RequestInputError) return errorResponse(error.message, error.status);
    return errorResponse("Unable to read the enquiry request.", 400);
  }

  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) {
    return errorResponse(parsed.error.issues.map((issue) => issue.message).join(" "), 400);
  }

  const values = parsed.data;
  // Silent success for the off-screen honeypot so simple bots do not learn the field result.
  if (values.website.trim()) return NextResponse.json({ ok: true });

  let supabase: ReturnType<typeof createServiceRoleClient>;
  try {
    supabase = createServiceRoleClient();
  } catch {
    console.error("contact.configuration.missing");
    return errorResponse("Contact submissions are temporarily unavailable.", 503);
  }

  let allowed: boolean | null = null;
  try {
    const keyHash = clientKeyHash(req);
    const { data, error } = await supabase.rpc("consume_contact_rate_limit", {
      p_key_hash: keyHash,
      p_window_seconds: RATE_WINDOW_SECONDS,
      p_max_requests: RATE_MAX_REQUESTS,
    });
    if (error) {
      console.error("contact.rate_limit.failed", { code: error.code || "unknown" });
      return errorResponse("Contact submissions are temporarily unavailable.", 503);
    }
    allowed = data === true;
  } catch {
    console.error("contact.rate_limit.configuration.failed");
    return errorResponse("Contact submissions are temporarily unavailable.", 503);
  }

  if (!allowed) {
    return errorResponse("Too many enquiries have been submitted. Please try again later.", 429);
  }

  try {
    const { error } = await supabase.from("contact_enquiries").insert({
      name: values.name,
      email: values.email,
      category: values.category,
      message: values.message,
      status: "new",
    });
    if (error) {
      console.error("contact.submit.failed", { code: error.code || "unknown" });
      return errorResponse("We could not process your enquiry right now. Please try again later.", 500);
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    console.error("contact.submit.failed");
    return errorResponse("We could not process your enquiry right now. Please try again later.", 500);
  }
}
