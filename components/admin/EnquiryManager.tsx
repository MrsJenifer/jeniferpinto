"use client";
import { adminFetch } from "@/lib/admin-fetch";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Mail, CheckCircle2 } from "lucide-react";

type Enquiry = { id: string; name: string; email: string; category: string; message: string; status: "new" | "in_progress" | "responded" | "archived"; created_at: string };
const statusLabels: Record<Enquiry["status"], string> = { new: "New", in_progress: "In progress", responded: "Responded", archived: "Archived" };
export function EnquiryManager() {
  const [items, setItems] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [busyId, setBusyId] = useState("");
  const load = useCallback(async () => {
    try {
      const r = await adminFetch("/api/admin/enquiries", { cache: "no-store" });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || "Could not load enquiries.");
      setItems(b.items ?? []);
      setFailed(false);
    } catch (e) {
      setFailed(true);
      setNotice(e instanceof Error ? e.message : "Could not load enquiries.");
    } finally {
      setLoading(false);
    }
  }, []);
  // Intentional async data-fetching effect; state updates occur after the network request.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  async function update(id: string, status: Enquiry["status"]) {
    setBusyId(id); setNotice(""); setFailed(false);
    try { const r = await adminFetch("/api/admin/enquiries", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) }); const b = await r.json(); if (!r.ok) throw new Error(b.error || "Could not update enquiry."); setItems(old => old.map(x => x.id === id ? { ...x, status } : x)); setNotice("Enquiry status updated."); }
    catch (e) { setFailed(true); setNotice(e instanceof Error ? e.message : "Could not update enquiry."); }
    finally { setBusyId(""); }
  }
  const visible = useMemo(() => items.filter(x => (filter === "all" || x.status === filter) && `${x.name} ${x.email} ${x.category} ${x.message}`.toLowerCase().includes(query.toLowerCase())), [items, filter, query]);
  return <>
    {notice && <div className={`admin-alert${failed ? " error" : ""}`} role="status">{notice}</div>}
    <section className="admin-panel">
      <div className="admin-panel-head"><h2>Contact enquiries</h2><button className="btn btn-outline" onClick={() => { setLoading(true); setNotice(""); setFailed(false); void load(); }}><RefreshCw size={14}/> Refresh</button></div>
      <div className="admin-toolbar"><input aria-label="Search enquiries" placeholder="Search name, email, message…" value={query} onChange={e => setQuery(e.target.value)} /><select aria-label="Filter by status" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All statuses</option><option value="new">New</option><option value="in_progress">In progress</option><option value="responded">Responded</option><option value="archived">Archived</option></select></div>
      {loading ? <p className="small-muted">Loading enquiries…</p> : visible.length ? <div className="content-list" style={{ marginTop: 16 }}>{visible.map(item => <article className="content-row" key={item.id}><div style={{ minWidth: 0, flex: 1 }}><div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><h3>{item.name}</h3><span className={`pill${item.status === "new" ? " draft" : ""}`}>{statusLabels[item.status]}</span></div><p><a href={`mailto:${encodeURIComponent(item.email)}?subject=${encodeURIComponent("Re: " + item.category)}`}><Mail size={12} style={{ display: "inline", marginRight: 5 }}/>{item.email}</a> · {item.category} · {new Date(item.created_at).toLocaleString()}</p><p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", marginTop: 12 }}>{item.message}</p></div><div style={{ display: "grid", gap: 8, minWidth: 135 }}><label className="small-muted" htmlFor={`status-${item.id}`}>Status</label><select id={`status-${item.id}`} value={item.status} disabled={busyId === item.id} onChange={e => void update(item.id, e.target.value as Enquiry["status"])}>{Object.entries(statusLabels).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select>{item.status === "responded" && <small className="small-muted"><CheckCircle2 size={12} style={{ display: "inline", marginRight: 4 }}/>Marked responded</small>}</div></article>)}</div> : <div className="empty-state">No enquiries match this filter. New messages submitted through the public contact form will appear here.</div>}
    </section>
    <p className="small-muted">Contact messages contain personal information. Restrict dashboard access and apply a retention policy before production launch.</p>
  </>;
}
