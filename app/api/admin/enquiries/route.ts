import { NextResponse } from "next/server";
import { adminAuthResponse, requireAdmin } from "@/lib/admin-auth";

const statuses = new Set(["new", "in_progress", "responded", "archived"]);
function error(message: string, status = 400) { return NextResponse.json({ error: message }, { status }); }

export async function GET() {
  try {
    const { supabase } = await requireAdmin({ redirectOnFailure: false });
    const { data, error: queryError } = await supabase
      .from("contact_enquiries")
      .select("id,name,email,category,message,status,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (queryError) throw queryError;
    return NextResponse.json({ items: data ?? [] });
  } catch (e) {
    const auth = adminAuthResponse(e);
    if (auth) return auth;
    console.error("admin.enquiries.list.failed", e instanceof Error ? e.message : "unknown");
    return error("Unable to load enquiries. Check database setup and administrator permissions.", 500);
  }
}

export async function PATCH(req: Request) {
  try {
    const { supabase, user } = await requireAdmin({ redirectOnFailure: false });
    const body: unknown = await req.json();
    if (!body || typeof body !== "object" || !("id" in body) || !("status" in body)) return error("An enquiry ID and status are required.");
    const { id, status } = body as { id?: unknown; status?: unknown };
    if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return error("A valid enquiry ID is required.");
    if (typeof status !== "string" || !statuses.has(status)) return error("Choose a valid enquiry status.");
    const { data, error: updateError } = await supabase.from("contact_enquiries").update({ status }).eq("id", id).select("id,status").maybeSingle();
    if (updateError) throw updateError;
    if (!data) return error("Enquiry not found.", 404);
    await supabase.from("audit_events").insert({ actor_id: user.id, action: "enquiry.status.updated", target_type: "contact_enquiry", target_id: id, outcome: "success" });
    return NextResponse.json({ item: data });
  } catch (e) {
    const auth = adminAuthResponse(e);
    if (auth) return auth;
    console.error("admin.enquiries.update.failed", e instanceof Error ? e.message : "unknown");
    return error("Unable to update the enquiry status.", 500);
  }
}
