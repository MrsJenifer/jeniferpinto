import { NextResponse } from "next/server";
import { adminAuthResponse, requireAdmin } from "@/lib/admin-auth";

function fail(message: string, status = 400) { return NextResponse.json({ error: message }, { status }); }
export async function GET(req: Request) {
  try {
    const { supabase } = await requireAdmin({ redirectOnFailure: false });
    const id = new URL(req.url).searchParams.get("id");
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return fail("A valid content ID is required.");
    const { data, error } = await supabase.from("content_versions").select("id,content_item_id,snapshot,created_at").eq("content_item_id", id).order("created_at", { ascending: false }).limit(20);
    if (error) throw error;
    return NextResponse.json({ items: data ?? [] });
  } catch (e) {
    const auth = adminAuthResponse(e); if (auth) return auth;
    console.error("admin.content.versions.list.failed", e instanceof Error ? e.message : "unknown");
    return fail("Unable to load content history.", 500);
  }
}
export async function POST(req: Request) {
  try {
    const { supabase, user, role } = await requireAdmin({ redirectOnFailure: false });
    let body: unknown;
    try { body = await req.json(); } catch { return fail("Request body must be valid JSON."); }
    if (!body || typeof body !== "object" || !("version_id" in body) || typeof (body as {version_id: unknown}).version_id !== "string") return fail("A version ID is required.");
    const versionId = (body as {version_id:string}).version_id;
    if (!/^[0-9a-f-]{36}$/i.test(versionId)) return fail("A valid version ID is required.");
    const { data: version, error: versionError } = await supabase.from("content_versions").select("id,content_item_id,snapshot").eq("id", versionId).maybeSingle();
    if (versionError) throw versionError;
    if (!version || !version.content_item_id || !version.snapshot || typeof version.snapshot !== "object") return fail("This version cannot be restored because its original record no longer exists.", 404);
    const snapshot = version.snapshot as Record<string, unknown>;
    if (snapshot.content_type === "site_settings" && !["owner", "administrator"].includes(String(role))) return fail("Only an owner or administrator can restore site settings.", 403);
    const id = version.content_item_id;
    const { data: current, error: currentError } = await supabase.from("content_items").select("id,content_type,slug,data,is_published,sort_order,created_at,updated_at").eq("id", id).maybeSingle();
    if (currentError) throw currentError;
    if (!current) return fail("The content record no longer exists. Recreate it manually from the saved snapshot.", 404);
    const { error: saveCurrentError } = await supabase.from("content_versions").insert({ content_item_id: id, snapshot: current, created_by: user.id });
    if (saveCurrentError) console.error("admin.content.version.write.failed", saveCurrentError.message);
    const allowedTypes = new Set(["profile", "project", "skill", "experience", "education", "certification", "achievement", "article", "testimonial", "site_settings"]);
    if (typeof snapshot.content_type !== "string" || !allowedTypes.has(snapshot.content_type) || typeof snapshot.slug !== "string" || !snapshot.data || typeof snapshot.data !== "object" || typeof snapshot.is_published !== "boolean") return fail("The saved snapshot is invalid.", 422);
    const { data, error } = await supabase.from("content_items").update({ content_type: snapshot.content_type, slug: snapshot.slug, data: snapshot.data, is_published: snapshot.is_published, sort_order: typeof snapshot.sort_order === "number" ? snapshot.sort_order : 0, updated_by: user.id, updated_at: new Date().toISOString() }).eq("id", id).select("id,content_type,slug,data,is_published,sort_order,created_at,updated_at").single();
    if (error) { if (error.code === "23505") return fail("Cannot restore this version because its slug is now in use.", 409); throw error; }
    await supabase.from("audit_events").insert({ actor_id: user.id, action: "content.version.restored", target_type: "content_item", target_id: id, outcome: "success" });
    return NextResponse.json({ item: data });
  } catch (e) {
    const auth = adminAuthResponse(e); if (auth) return auth;
    console.error("admin.content.versions.restore.failed", e instanceof Error ? e.message : "unknown");
    return fail("Unable to restore this version.", 500);
  }
}
