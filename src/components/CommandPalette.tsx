import React, { useState, useRef, useEffect } from "react";
import { TC, SC, HIC } from "../constants";
import { fuzzyScore } from "../utils";

// ─── COMMAND PALETTE ──────────────────────────────────────────────────────────
interface CommandPaletteProps {
  items: any[];
  onNav: (id: string) => void;
  onClose: () => void;
}

export default function CommandPalette({ items, onNav, onClose }: CommandPaletteProps) {
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const results = q.trim()
    ? items.map(i => ({...i, _s:fuzzyScore(i,q)})).filter(i => i._s>0).sort((a,b) => b._s-a._s).slice(0,14)
    : items.slice(0,14);

  const onKey = (e: React.KeyboardEvent) => {
    if(e.key==='ArrowDown'){ e.preventDefault(); setCursor(c => Math.min(c+1, results.length-1)); }
    if(e.key==='ArrowUp'){ e.preventDefault(); setCursor(c => Math.max(c-1, 0)); }
    if(e.key==='Enter' && results[cursor]) onNav(results[cursor].id);
    if(e.key==='Escape') onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center" style={{ paddingTop:80, background:'rgba(15,23,42,0.65)', backdropFilter:'blur(2px)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden w-full" style={{ maxWidth:580 }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b bg-gray-50">
          <span className="text-gray-400 text-lg">🔍</span>
          <input ref={inputRef} value={q} onChange={e => { setQ(e.target.value); setCursor(0); }} onKeyDown={onKey}
            className="flex-1 bg-transparent outline-none text-gray-800 placeholder-gray-400" style={{ fontSize:15 }}
            placeholder="Search items by title, key, owner, tag…"/>
          <kbd className="bg-white border rounded px-2 py-0.5 text-gray-400 font-mono shrink-0" style={{ fontSize:11 }}>ESC</kbd>
        </div>
        <div style={{ maxHeight:420, overflowY:'auto' }}>
          {!results.length
            ? <div className="text-center text-gray-400 py-12" style={{ fontSize:13 }}>No results for "{q}"</div>
            : results.map((it, idx) => {
                const c = TC[it.type];
                return (
                  <button key={it.id} onClick={() => onNav(it.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left border-b last:border-0 transition-colors ${idx===cursor?'bg-blue-50 border-l-2 border-l-blue-500':'hover:bg-gray-50'}`}>
                    <span style={{ fontSize:20, width:28, textAlign:'center', flexShrink:0 }}>{c.i}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                        <span className={`font-mono font-bold ${c.tc}`} style={{ fontSize:11 }}>{it.key}</span>
                        <span className={`px-1.5 py-0 rounded-full ${SC[it.status]||''}`} style={{ fontSize:10 }}>{it.status}</span>
                        <span style={{ fontSize:11 }}>{HIC[it.health]}</span>
                      </div>
                      <div className="text-gray-800 font-medium truncate" style={{ fontSize:13 }}>{it.title||'(Untitled)'}</div>
                      {it.owner && <div className="text-gray-400 truncate" style={{ fontSize:11 }}>👤 {it.owner}</div>}
                    </div>
                    <span className={`shrink-0 font-semibold border rounded-full px-2 py-0.5 ${c.bg} ${c.tc} ${c.b}`} style={{ fontSize:10 }}>{c.l}</span>
                  </button>
                );
              })}
        </div>
        <div className="flex items-center gap-5 px-4 py-2 bg-gray-50 border-t text-gray-400" style={{ fontSize:11 }}>
          <span>↑↓ navigate</span><span>↵ open</span><span>esc close</span>
          <span className="ml-auto">{results.length} of {items.length} items</span>
        </div>
      </div>
    </div>
  );
}
