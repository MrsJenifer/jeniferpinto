export default function AdminLoading() {
  return <main style={{ minHeight: "60vh", padding: "clamp(20px,4vw,44px)", background: "#f5f7fa" }} aria-busy="true" aria-live="polite">
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <p style={{ color: "#748195", fontSize: 12, marginBottom: 12 }}>PORTFOLIO STUDIO</p>
      <div style={{ height: 30, width: "48%", background: "#e4e9f0", borderRadius: 8, marginBottom: 12 }} />
      <div style={{ height: 14, width: "72%", background: "#e9edf2", borderRadius: 6, marginBottom: 30 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
        {[1,2,3,4].map(n => <div key={n} style={{ height: 112, background: "white", border: "1px solid #e5eaf0", borderRadius: 14 }} />)}
      </div>
      <p style={{ color: "#748195", fontSize: 12, marginTop: 22 }}>Loading your workspace…</p>
    </div>
  </main>;
}
