import React, { useState, useRef, useEffect } from "react";

// ─── AI ENDPOINT ──────────────────────────────────────────────────────────────
// Phase 8: requests now go to the Vercel Edge Function /api/claude which
// proxies to Anthropic server-side so the API key is never in the browser.
// In local dev (npm run dev) Vite proxies /api → the function via vercel dev,
// or you can run: npx vercel dev  instead of npm run dev.
const AI_ENDPOINT = "/api/claude";

// ─── SUGGESTED PROMPTS ────────────────────────────────────────────────────────
const SUGGESTED = [
  "Summarise the overall portfolio health and highlight any Red or Amber items",
  "Which items are at Critical priority and still In Progress?",
  "What are the top risks across the portfolio and which items carry them?",
];

// ─── SYSTEM PROMPT BUILDER ────────────────────────────────────────────────────
function buildSystemPrompt(items: any[]): string {
  const summary = items.map(it => ({
    key:           it.key,
    type:          it.type,
    title:         it.title,
    status:        it.status,
    priority:      it.priority,
    health:        it.health,
    risk:          it.risk,
    progress:      it.progress,
    owner:         it.owner,
    startDate:     it.startDate,
    endDate:       it.endDate,
    currentStatus: it.currentStatus  || "",
    riskStatement: it.riskStatement  || "",
    impact:        it.impact         || "",
    tags:          it.tags,
    links:         it.links,
    dependencies:  it.dependencies,
    keyResult:     it.keyResult      || "",
  }));

  return `You are the Strat101.com AI Assist \u2014 a dedicated strategic intelligence bot for this tenant\u2019s transformation portfolio.

You have full read access to the tenant\u2019s live item registry, which contains ${items.length} items structured in a 9-level hierarchy:
Vision \u2192 Mission \u2192 Goal \u2192 OKR \u2192 Key Result \u2192 Initiative \u2192 Program \u2192 Project \u2192 Task \u2192 Subtask

Your role is to help the user understand their portfolio: surface risks, report on progress, identify blockers, highlight dependencies, and provide concise briefings. Be direct, structured, and use the actual data. When referencing items always include their key (e.g. V-0001, O-0002).

TENANT PORTFOLIO DATA (JSON):
${JSON.stringify(summary, null, 0)}

Rules:
- Answer only from the data above. Do not invent items or figures.
- Be concise. Use bullet points or short sections for multi-item answers.
- For health: Green = on track, Amber = at risk, Red = critical issue.
- Always cite item keys when mentioning specific records.
- If asked for something not in the data, say so clearly.`;
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────
interface BotPanelProps {
  items: any[];
}

export default function BotPanel({ items }: BotPanelProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text?: string) => {
    const q = (text || input).trim();
    if (!q || loading) return;

    setInput(""); setError(null);
    const userMsg = { role: "user", content: q };
    const next    = [...messages, userMsg];
    setMessages(next);
    setLoading(true);

    try {
      const res = await fetch(AI_ENDPOINT, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model:      "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system:     buildSystemPrompt(items),
          messages:   next.map((m: any) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText}`);
      }

      const data = await res.json();
      if (data.error) throw new Error(data.error.message);

      const reply =
        data.content?.map((b: any) => b.text || "").join("") || "No response.";
      setMessages(p => [...p, { role: "assistant", content: reply }]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: "system-ui,sans-serif", background: "#f1f5f9" }}>

      {/* ── Header ── */}
      <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b"
        style={{ background: "#a3bbff", borderColor: "#7a9ee8" }}>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center rounded-xl shrink-0"
            style={{ width:32, height:32, background:"linear-gradient(135deg,#2563eb,#4f46e5)", boxShadow:"0 2px 8px rgba(37,99,235,0.35)" }}>
            <span style={{ fontSize: 16 }}>🤖</span>
          </div>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:"#0c2d4a" }}>Strat101.com AI Assist</div>
            <div style={{ fontSize:11, color:"#1a5276" }}>
              Powered by Claude \u00b7 {items.length} items in context
            </div>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            style={{ fontSize:11, color:"#0c3d6e", background:"rgba(255,255,255,0.45)", border:"1px solid rgba(0,60,120,0.2)", borderRadius:8, padding:"4px 12px", cursor:"pointer" }}>
            Clear conversation
          </button>
        )}
      </div>

      {/* ── Message area ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4"
        style={{ scrollbarWidth: "thin", scrollbarColor: "#cbd5e1 transparent" }}>

        {isEmpty ? (
          /* Empty state with suggested prompts */
          <div className="flex flex-col items-center justify-center h-full" style={{ minHeight: 300 }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🤖</div>
            <div style={{ fontSize:16, fontWeight:700, color:"#0f172a", marginBottom:4 }}>
              Ask anything about your portfolio
            </div>
            <div style={{ fontSize:12, color:"#64748b", maxWidth:420, textAlign:"center", marginBottom:32, lineHeight:1.6 }}>
              I have access to all {items.length} items in this workspace \u2014 risks, OKRs,
              owners, progress, dependencies and more.
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, width:"100%", maxWidth:680 }}>
              {SUGGESTED.map((s, i) => (
                <button key={i} onClick={() => send(s)}
                  style={{ textAlign:"left", borderRadius:16, border:"1px solid #e2e8f0", background:"white", padding:"14px 16px", display:"flex", flexDirection:"column", gap:8, cursor:"pointer", fontSize:12, color:"#334155", lineHeight:1.5, boxShadow:"0 1px 4px rgba(0,0,0,0.06)", transition:"all 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor="#93c5fd"; e.currentTarget.style.boxShadow="0 2px 8px rgba(37,99,235,0.12)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor="#e2e8f0"; e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.06)"; }}>
                  <span style={{ fontSize:18, color:"#2563eb" }}>&#9658;</span>
                  <span>{s}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Conversation thread */
          <div className="space-y-4" style={{ maxWidth:760, margin:"0 auto" }}>
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && (
                  <div className="flex items-center justify-center rounded-xl shrink-0 self-start"
                    style={{ width:28, height:28, fontSize:14, marginTop:2, background:"linear-gradient(135deg,#2563eb,#4f46e5)" }}>
                    🤖
                  </div>
                )}
                <div style={{
                  borderRadius:16, padding:"10px 16px", fontSize:13, lineHeight:1.65,
                  maxWidth:"80%", whiteSpace:"pre-wrap",
                  ...(m.role === "user"
                    ? { background:"#2563eb", color:"white", borderTopRightRadius:4 }
                    : { background:"white", color:"#1e293b", border:"1px solid #e2e8f0", borderTopLeftRadius:4, boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }),
                }}>
                  {m.content}
                </div>
                {m.role === "user" && (
                  <div className="flex items-center justify-center rounded-xl shrink-0 self-start font-bold"
                    style={{ width:28, height:28, fontSize:12, marginTop:2, background:"#e2e8f0", color:"#475569" }}>
                    U
                  </div>
                )}
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="flex gap-3 justify-start">
                <div className="flex items-center justify-center rounded-xl shrink-0"
                  style={{ width:28, height:28, fontSize:14, background:"linear-gradient(135deg,#2563eb,#4f46e5)" }}>
                  🤖
                </div>
                <div style={{ background:"white", border:"1px solid #e2e8f0", borderRadius:16, borderTopLeftRadius:4, padding:"12px 16px", display:"flex", alignItems:"center", gap:6, boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
                  {[0, 1, 2].map(d => (
                    <div key={d} style={{ width:7, height:7, borderRadius:"50%", background:"#93c5fd", animation:"bounce 1.2s infinite", animationDelay:`${d * 0.2}s` }}/>
                  ))}
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div style={{ borderRadius:12, border:"1px solid #fca5a5", background:"#fef2f2", padding:"10px 16px", color:"#dc2626", fontSize:12 }}>
                &#9888; {error}
              </div>
            )}

            <div ref={bottomRef}/>
          </div>
        )}
      </div>

      {/* ── Suggested chips (shown after first message) ── */}
      {!isEmpty && (
        <div className="shrink-0 px-4 py-2 border-t overflow-x-auto"
          style={{ borderColor:"#e2e8f0", background:"#f8fafc", scrollbarWidth:"none" }}>
          <div className="flex gap-2" style={{ width:"max-content" }}>
            {SUGGESTED.slice(0, 5).map((s, i) => (
              <button key={i} onClick={() => send(s)} disabled={loading}
                style={{ flexShrink:0, padding:"5px 12px", borderRadius:999, border:"1px solid #e2e8f0", background:"white", color:"#475569", fontSize:11, whiteSpace:"nowrap", cursor:"pointer", transition:"all 0.15s", opacity:loading ? 0.4 : 1 }}
                onMouseEnter={e => { if (!loading) { e.currentTarget.style.borderColor="#93c5fd"; e.currentTarget.style.color="#1d4ed8"; } }}
                onMouseLeave={e => { e.currentTarget.style.borderColor="#e2e8f0"; e.currentTarget.style.color="#475569"; }}>
                {s.slice(0, 48)}{s.length > 48 ? "\u2026" : ""}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Input row ── */}
      <div className="shrink-0 px-3 py-2 border-t" style={{ background:"white", borderColor:"#e2e8f0" }}>
        <div className="flex gap-2 items-end" style={{ maxWidth:760, margin:"0 auto" }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKey}
            rows={1}
            disabled={loading}
            placeholder="Ask about risks, progress, owners, OKRs\u2026 (Enter to send)"
            style={{ flex:1, background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:12, padding:"10px 14px", color:"#1e293b", fontSize:13, lineHeight:1.5, minHeight:42, maxHeight:120, outline:"none", resize:"none", transition:"border-color 0.15s", opacity:loading ? 0.5 : 1 }}
            onFocus={e => e.target.style.borderColor="#93c5fd"}
            onBlur={e  => e.target.style.borderColor="#e2e8f0"}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            style={{ width:42, height:42, borderRadius:12, border:"none", background:(!input.trim() || loading) ? "#e2e8f0" : "linear-gradient(135deg,#2563eb,#4f46e5)", color:"white", fontSize:18, cursor:(!input.trim() || loading) ? "not-allowed" : "pointer", transition:"all 0.15s", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
            &#8679;
          </button>
        </div>
        <div style={{ fontSize:10, color:"#94a3b8", textAlign:"center", marginTop:4 }}>
          Enter to send \u00b7 Shift+Enter for new line \u00b7 Context: {items.length} portfolio items
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0);   opacity: 0.5; }
          40%            { transform: translateY(-6px); opacity: 1;   }
        }
      `}</style>
    </div>
  );
}
