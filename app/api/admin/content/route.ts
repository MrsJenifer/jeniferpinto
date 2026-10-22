import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { adminAuthResponse, requireAdmin } from "@/lib/admin-auth";
import { contentUpsertSchema, contentTypeSchema } from "@/lib/validation";

function jsonError(message: string, status = 400) { return NextResponse.json({ error: message }, { status }); }
async function audit(supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"], actorId: string, action: string, targetId: string, outcome = "success") {
  const { error } = await supabase.from("audit_events").insert({ actor_id: actorId, action, target_type: "content_item", target_id: targetId, outcome });
  if (error) console.error("admin.audit.write.failed", { action, message: error.message });
}

export async function GET(req: Request) {
  try {
    const { supabase } = await requireAdmin({ redirectOnFailure: false });
    const url = new URL(req.url);
    const parsed = contentTypeSchema.safeParse(url.searchParams.get("type"));
    let query = supabase.from("content_items").select("id,content_type,slug,data,is_published,sort_order,created_at,updated_at").order("sort_order", { ascending: true });
    if (url.searchParams.has("type")) {
      if (!parsed.success) return jsonError("Invalid content type.");
      query = query.eq("content_type", parsed.data);
    }
    const { data, error } = await query.limit(300);
    if (error) throw error;
    return NextResponse.json({ items: data || [] });
  } catch (e) {
    const auth = adminAuthResponse(e); if (auth) return auth;
    console.error("admin.content.list.failed", e instanceof Error ? e.message : "unknown");
    return jsonError("Unable to load content. Check administrator permissions and database setup.", 500);
  }
}

export async function POST(req: Request) {
  try {
    const { supabase, user, role } = await requireAdmin({ redirectOnFailure: false });
    let body: unknown;
    try { body = await req.json(); } catch { return jsonError("Request body must be valid JSON."); }
    const parsed = contentUpsertSchema.safeParse(body);
    if (!parsed.success) return jsonError(parsed.error.issues.map(x => x.message).join(" "));
    const payload = parsed.data;
    if (payload.content_type === "site_settings" && !["owner", "administrator"].includes(String(role))) return jsonError("Only an owner or administrator can change site settings.", 403);
    const priorResult = payload.id
      ? await supabase.from("content_items").select("id,content_type,slug,data,is_published,sort_order,created_at,updated_at").eq("id", payload.id).maybeSingle()
      : { data: null, error: null };
    if (priorResult.error) throw priorResult.error;
    if (payload.id && !priorResult.data) return jsonError("Content record not found.", 404);
    if (priorResult.data) {
      const { error: versionError } = await supabase.from("content_versions").insert({ content_item_id: priorResult.data.id, snapshot: priorResult.data, created_by: user.id });
      if (versionError) console.error("admin.content.version.write.failed", versionError.message);
    }
    const values = {
      content_type: payload.content_type,
      slug: payload.slug,
      data: payload.data,
      is_published: payload.is_published,
      sort_order: payload.sort_order,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    // Use explicit UPDATE and INSERT paths. This keeps the insert-only created_by
    // field out of updates and avoids an incomplete upsert row under strict types.
    const result = payload.id
      ? await supabase.from("content_items").update(values).eq("id", payload.id)
          .select("id,content_type,slug,data,is_published,sort_order,created_at,updated_at").single()
      : await supabase.from("content_items").insert({ id: randomUUID(), ...values, created_by: user.id })
          .select("id,content_type,slug,data,is_published,sort_order,created_at,updated_at").single();

    if (result.error) {
      if (result.error.code === "23505") return jsonError("That slug is already in use for this content type.", 409);
      throw result.error;
    }
    const saved = result.data;
    await audit(supabase, user.id, priorResult.data ? "content.updated" : "content.created", saved.id);
    return NextResponse.json({ item: saved });
  } catch (e) {
    const auth = adminAuthResponse(e); if (auth) return auth;
    console.error("admin.content.save.failed", e instanceof Error ? e.message : "unknown");
    return jsonError("Unable to save content. Check validation and database permissions.", 500);
  }
}

export async function DELETE(req: Request) {
  try {
    const { supabase, user, role } = await requireAdmin({ redirectOnFailure: false });
    const id = new URL(req.url).searchParams.get("id");
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return jsonError("A valid record ID is required.");
    const { data: prior, error: fetchError } = await supabase.from("content_items").select("id,content_type,slug,data,is_published,sort_order,created_at,updated_at").eq("id", id).maybeSingle();
    if (fetchError) throw fetchError;
    if (!prior) return jsonError("Content record not found.", 404);
    if (prior.content_type === "site_settings" && !["owner", "administrator"].includes(String(role))) return jsonError("Only an owner or administrator can delete site settings.", 403);
    const { error: versionError } = await supabase.from("content_versions").insert({ content_item_id: prior.id, snapshot: prior, created_by: user.id });
    if (versionError) console.error("admin.content.version.write.failed", versionError.message);
    const { error } = await supabase.from("content_items").delete().eq("id", id);
    if (error) throw error;
    await audit(supabase, user.id, "content.deleted", id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const auth = adminAuthResponse(e); if (auth) return auth;
    console.error("admin.content.delete.failed", e instanceof Error ? e.message : "unknown");
    return jsonError("Unable to delete content. Check permissions and asset references.", 500);
  }
}
