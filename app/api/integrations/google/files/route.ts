import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { adminAuthResponse, requireAdmin } from "@/lib/admin-auth";
import { getAccessToken, getGoogleConnection, googleApi } from "@/lib/google-drive";
export const runtime = "nodejs";
const MAX_BYTES = 50 * 1024 * 1024;
const mimeAllowlist = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm", "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.openxmlformats-officedocument.presentationml.presentation"]);
const nativeExports: Record<string, { mime: string; extension: string }> = {
  "application/vnd.google-apps.document": { mime: "application/pdf", extension: "pdf" },
  "application/vnd.google-apps.spreadsheet": { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", extension: "xlsx" },
  "application/vnd.google-apps.presentation": { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", extension: "pptx" },
};
function error(message: string, status = 400) { return NextResponse.json({ error: message }, { status }); }
function signature(bytes: Uint8Array, mime: string) {
  const starts = (...v: number[]) => v.every((n, i) => bytes[i] === n);
  if (mime === "image/jpeg") return starts(0xff,0xd8,0xff);
  if (mime === "image/png") return starts(0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a);
  if (mime === "image/webp") return starts(0x52,0x49,0x46,0x46) && bytes[8]===0x57 && bytes[9]===0x45 && bytes[10]===0x42 && bytes[11]===0x50;
  if (mime === "image/gif") return starts(0x47,0x49,0x46,0x38) && (bytes[4]===0x37 || bytes[4]===0x39) && bytes[5]===0x61; if (mime === "video/mp4") return bytes.length >= 12 && bytes[4]===0x66 && bytes[5]===0x74 && bytes[6]===0x79 && bytes[7]===0x70; if (mime === "video/webm") return starts(0x1a,0x45,0xdf,0xa3);
  if (mime === "application/pdf") return starts(0x25,0x50,0x44,0x46,0x2d);
  if (mime.startsWith("application/vnd.openxmlformats-officedocument.")) return starts(0x50,0x4b,0x03,0x04);
  return false;
}
async function boundedBytes(response: Response) {
  const length = Number(response.headers.get("content-length") || 0);
  if (length > MAX_BYTES) throw new Error("This Drive file exceeds the 50 MB import limit.");
  if (!response.body) throw new Error("Google Drive returned an empty file.");
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
  try { while (true) { const { done, value } = await reader.read(); if (done) break; total += value.byteLength; if (total > MAX_BYTES) { await reader.cancel(); throw new Error("This Drive file exceeds the 50 MB import limit."); } chunks.push(value); } }
  finally { reader.releaseLock(); }
  const output = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; } return Buffer.from(output);
}
async function tokenFor(userId: string) { const connection = await getGoogleConnection(userId); if (!connection) throw new Error("Connect Google Drive first."); return getAccessToken(connection); }
export async function GET(req: Request) {
  try {
    const auth = await requireAdmin({ redirectOnFailure: false });
    if (!["owner", "administrator"].includes(auth.role)) return error("Only an owner or administrator can browse Google Drive.", 403);
    const url = new URL(req.url); const search = (url.searchParams.get("q") || "").trim().slice(0, 100); const pageToken = (url.searchParams.get("pageToken") || "").slice(0, 2048);
    const { token } = await tokenFor(auth.user.id);
    const q = ["trashed = false", "mimeType != 'application/vnd.google-apps.folder'"];
    if (search) q.push(`name contains '${search.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`);
    const params = new URLSearchParams({ q: q.join(" and "), pageSize: "50", orderBy: "modifiedTime desc", fields: "nextPageToken,files(id,name,mimeType,size,webViewLink,thumbnailLink,modifiedTime)" });
    if (pageToken) params.set("pageToken", pageToken);
    const response = await googleApi(`https://www.googleapis.com/drive/v3/files?${params}`, token);
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok || !data || typeof data !== "object") return error("Google Drive could not list files. Reconnect the account if access was revoked.", response.status === 401 ? 401 : 502);
    const body = data as { files?: unknown[]; nextPageToken?: string };
    const files = (body.files || []).filter((f): f is Record<string, unknown> => Boolean(f && typeof f === "object")).map(f => ({ id: String(f.id || ""), name: String(f.name || "Untitled file"), mimeType: String(f.mimeType || "application/octet-stream"), size: typeof f.size === "string" ? f.size : null, webViewLink: typeof f.webViewLink === "string" ? f.webViewLink : null, thumbnailLink: typeof f.thumbnailLink === "string" ? f.thumbnailLink : null, modifiedTime: typeof f.modifiedTime === "string" ? f.modifiedTime : null, importable: mimeAllowlist.has(String(f.mimeType || "")) || String(f.mimeType || "").startsWith("image/") || Boolean(nativeExports[String(f.mimeType || "")]) }));
    return NextResponse.json({ files, nextPageToken: body.nextPageToken || null });
  } catch (e) {
    const auth = adminAuthResponse(e); if (auth) return auth;
    console.error("google_drive.files.list.failed", e instanceof Error ? e.message : "unknown");
    return error(e instanceof Error ? e.message : "Unable to list Google Drive files.", 502);
  }
}
export async function POST(req: Request) {
  try {
    const auth = await requireAdmin({ redirectOnFailure: false });
    if (!["owner", "administrator"].includes(auth.role)) return error("Only an owner or administrator can import Google Drive files.", 403);
    let body: unknown; try { body = await req.json(); } catch { return error("Request body must be valid JSON."); }
    if (!body || typeof body !== "object" || typeof (body as {file_id?: unknown}).file_id !== "string") return error("A Drive file ID is required.");
    const fileId = (body as {file_id:string}).file_id;
    if (!/^[A-Za-z0-9_-]{5,200}$/.test(fileId)) return error("Invalid Google Drive file ID.");
    const { token } = await tokenFor(auth.user.id);
    const metaResponse = await googleApi(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size,webViewLink`, token);
    const meta: unknown = await metaResponse.json().catch(() => null);
    if (!metaResponse.ok || !meta || typeof meta !== "object") return error("Unable to access this Drive file. Check its permissions.", metaResponse.status === 404 ? 404 : 502);
    const file = meta as { id: string; name?: string; mimeType?: string; size?: string; webViewLink?: string };
    const sourceMime = file.mimeType || "application/octet-stream"; const native = nativeExports[sourceMime]; const mime = native?.mime || sourceMime;
    if (!mimeAllowlist.has(mime)) return error("This file type cannot be imported. Import images, PDF, DOCX, XLSX, or PPTX files.", 415);
    if (file.size && Number(file.size) > MAX_BYTES) return error("This Drive file exceeds the 50 MB import limit.", 413);
    const downloadUrl = native
      ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=${encodeURIComponent(native.mime)}`
      : `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`;
    const downloadResponse = await googleApi(downloadUrl, token);
    if (!downloadResponse.ok) return error("Google Drive could not download this file. Check access permissions.", 502);
    const bytes = await boundedBytes(downloadResponse);
    if (!signature(bytes, mime)) return error("The downloaded file did not match an approved file signature.", 415);
    const extByMime: Record<string,string> = { "image/jpeg":"jpg", "image/png":"png", "image/webp":"webp", "image/gif":"gif", "application/pdf":"pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document":"docx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":"xlsx", "application/vnd.openxmlformats-officedocument.presentationml.presentation":"pptx" };
    const original = (file.name || "drive-import").replace(/[\\/\0-\x1f]/g, "_").slice(0, 180) || "drive-import";
    const base = original.replace(/\.[a-z0-9]{1,8}$/i, "").replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 150) || "drive-import";
    const filename = `${base}.${extByMime[mime]}`; const path = `${auth.user.id}/${randomUUID()}.${extByMime[mime]}`;
    const { error: uploadError } = await auth.supabase.storage.from("portfolio-assets").upload(path, bytes, { contentType: mime, upsert: false, cacheControl: "3600" });
    if (uploadError) throw uploadError;
    const { data: urlData } = auth.supabase.storage.from("portfolio-assets").getPublicUrl(path);
    const { data: asset, error: assetError } = await auth.supabase.from("media_assets").insert({ owner_id: auth.user.id, original_name: filename, storage_path: path, public_url: urlData.publicUrl, mime_type: mime, size_bytes: bytes.byteLength, alt_text: typeof (body as {alt_text?:unknown}).alt_text === "string" ? (body as {alt_text:string}).alt_text.slice(0,250) : null }).select("id,original_name,storage_path,public_url,mime_type,size_bytes,alt_text,created_at").single();
    if (assetError) { await auth.supabase.storage.from("portfolio-assets").remove([path]); throw assetError; }
    await auth.supabase.from("audit_events").insert({ actor_id: auth.user.id, action: "integration.google_drive.file_imported", target_type: "media_asset", target_id: asset.id, outcome: "success" });
    return NextResponse.json({ item: asset });
  } catch (e) {
    const auth = adminAuthResponse(e); if (auth) return auth;
    console.error("google_drive.files.import.failed", e instanceof Error ? e.message : "unknown");
    return error(e instanceof Error ? e.message : "Unable to import this Drive file.", 502);
  }
}

