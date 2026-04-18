// src/modules/MindMap/MindMapView.tsx
// Matrix mind-map: each work-item type occupies a column (left = highest hierarchy).
// Items stack vertically per column. Click a bubble to highlight the full path.

import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { TC, TL } from '../../constants';

// ─── Constants ─────────────────────────────────────────────────────────────────
const PALETTE: string[] = [
  '#2563eb','#16a34a','#d97706','#7c3aed',
  '#be185d','#0891b2','#ea580c','#0d9488',
  '#6366f1','#dc2626','#0369a1','#15803d',
];
const HEALTH_CLR: Record<string,string> = { Green:'#16a34a', Amber:'#f59e0b', Red:'#dc2626' };

const COLUMN_W       = 268;   // centre-to-centre column gap
const NODE_W         = 162;   // bubble width  (wider for larger font)
const NODE_RX        = 14;    // bubble corner radius
const ROW_H          = 90;    // vertical spacing per leaf
const HEADER_ABOVE   = 64;    // px above topmost node for column headers
const LINE_H         = 16;    // SVG line-height  (matches 13 pt font)
const FONT_SZ        = 13;    // +2 from previous 11
const MAX_LINES      = 3;
const CHARS_PER_LINE = Math.floor((NODE_W - 24) / (FONT_SZ * 0.58)); // ≈ 18 chars

// ─── Types ─────────────────────────────────────────────────────────────────────
interface MindNode {
  item:     any;
  children: MindNode[];
  x:        number;
  y:        number;
  depth:    number;
  color:    string;
}

interface Edge {
  x1: number; y1: number;
  x2: number; y2: number;
  color:      string;
  fromColIdx: number;
  toColIdx:   number;
  fromId:     string;   // for path-highlight filtering
  toId:       string;
}

// ─── Text helpers ───────────────────────────────────────────────────────────────
function wrapTitle(title: string): string[] {
  if (!title) return [''];
  const words = title.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (test.length <= CHARS_PER_LINE) { cur = test; }
    else {
      if (cur) lines.push(cur);
      cur = w.length > CHARS_PER_LINE ? w.slice(0, CHARS_PER_LINE) : w;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, MAX_LINES);
}
function nodeHeight(title: string): number {
  return Math.max(wrapTitle(title).length * LINE_H + 20, 36);
}

// ─── Column map ─────────────────────────────────────────────────────────────────
function buildColumnMap(allNodes: MindNode[]): Map<string,number> {
  const types = [
    ...new Set(allNodes.map(n => n.item.type).filter((t: string) => t && t !== 'root')),
  ].sort((a: string, b: string) => ((TL as any)[a] ?? 99) - ((TL as any)[b] ?? 99));
  return new Map(types.map((t: string, i: number) => [t, i]));
}

// ─── Tree builder (structure only) ──────────────────────────────────────────────
function buildTreeStructure(items: any[], rootItemId?: string): MindNode | null {
  if (!items.length) return null;
  let rootItems: any[];
  if (rootItemId) {
    const r = items.find(i => i.id === rootItemId);
    rootItems = r ? [r] : items.filter(i => i.type === 'vision');
  } else {
    rootItems = items.filter(i => i.type === 'vision');
  }
  if (!rootItems.length) return null;

  function isParentChild(parent: any, child: any): boolean {
    const pLvl = (TL as any)[parent.type] ?? -1;
    const cLvl = (TL as any)[child.type]  ?? -1;
    if (cLvl <= pLvl) return false;
    return (parent.links ?? []).includes(child.id) || (child.links ?? []).includes(parent.id);
  }
  const visited = new Set<string>();
  function mkNode(item: any, depth = 0): MindNode {
    visited.add(item.id);
    const children = items
      .filter(c => !visited.has(c.id) && isParentChild(item, c))
      .sort((a, b) => ((TL as any)[a.type] ?? 0) - ((TL as any)[b.type] ?? 0))
      .map(c => mkNode(c, depth + 1));
    return { item, children, x: 0, y: 0, depth, color: '#1e3a5f' };
  }
  const vNodes = rootItems.map(v => mkNode(v, 0));
  return vNodes.length === 1
    ? vNodes[0]
    : { item:{ id:'__root', type:'root', title:'', key:'', status:'', health:'' },
        children: vNodes, x: 0, y: 0, depth: 0, color: '#1e3a5f' };
}

// ─── Layout ──────────────────────────────────────────────────────────────────────
function countLeaves(n: MindNode): number {
  return n.children.length ? n.children.reduce((s, c) => s + countLeaves(c), 0) : 1;
}
function layoutChildrenMatrix(children: MindNode[], yCtr: number, colMap: Map<string,number>): void {
  const total = Math.max(children.reduce((s, n) => s + countLeaves(n), 0), 1);
  let yOff = yCtr - (total * ROW_H) / 2;
  for (const node of children) {
    const leaves = countLeaves(node);
    const h      = leaves * ROW_H;
    const midY   = yOff + h / 2;
    node.x = (colMap.get(node.item.type) ?? 0) * COLUMN_W;
    node.y = midY;
    if (node.children.length) {
      node.children.forEach(c => { if (c.color === '#1e3a5f') c.color = node.color; });
      layoutChildrenMatrix(node.children, midY, colMap);
    }
    yOff += h;
  }
}
function layoutMatrix(root: MindNode, colMap: Map<string,number>): void {
  if (root.item.id === '__root') {
    if (root.children.length) layoutChildrenMatrix(root.children, 0, colMap);
  } else {
    root.x = (colMap.get(root.item.type) ?? 0) * COLUMN_W;
    root.y = 0;
    if (root.children.length) layoutChildrenMatrix(root.children, 0, colMap);
  }
}

// ─── Graph helpers ────────────────────────────────────────────────────────────────
function flatNodes(root: MindNode): MindNode[] {
  const out: MindNode[] = [];
  (function walk(n) { out.push(n); n.children.forEach(walk); })(root);
  return out;
}
function collectEdges(root: MindNode, colMap: Map<string,number>): Edge[] {
  const edges: Edge[] = [];
  (function walk(n: MindNode) {
    if (n.item.id === '__root') { n.children.forEach(walk); return; }
    const fromColIdx = colMap.get(n.item.type) ?? 0;
    for (const c of n.children) {
      edges.push({
        x1: n.x + NODE_W / 2, y1: n.y,
        x2: c.x - NODE_W / 2, y2: c.y,
        color: c.color,
        fromColIdx, toColIdx: colMap.get(c.item.type) ?? 0,
        fromId: n.item.id, toId: c.item.id,
      });
      walk(c);
    }
  })(root);
  return edges;
}

// ─── Public helper ────────────────────────────────────────────────────────────────
export function findHighestAncestor(items: any[], itemId: string): any | null {
  const byId = new Map(items.map(i => [i.id, i]));
  let current = byId.get(itemId);
  if (!current) return null;
  const vis = new Set<string>();
  while (true) {
    if (vis.has(current.id)) break;
    vis.add(current.id);
    const parent = items
      .filter(p =>
        !vis.has(p.id) &&
        ((TL as any)[p.type] ?? 99) < ((TL as any)[current.type] ?? 99) &&
        ((p.links ?? []).includes(current.id) || (current.links ?? []).includes(p.id))
      )
      .sort((a, b) => ((TL as any)[a.type] ?? 0) - ((TL as any)[b.type] ?? 0))[0] ?? null;
    if (!parent) break;
    current = parent;
  }
  return current;
}

// ─── Edge ─────────────────────────────────────────────────────────────────────────
function EdgePath({ x1, y1, x2, y2, color, inPath }: Edge & { inPath: boolean | null }) {
  // inPath=null → no selection active (normal); true → on path; false → off path (dim)
  const opacity  = inPath === null ? 0.5 : inPath ? 0.85 : 0.08;
  const strokeW  = inPath ? 2 : 1;
  const ctrl     = (x2 - x1) * 0.46;
  const d        = `M ${x1} ${y1} C ${x1+ctrl} ${y1} ${x2-ctrl} ${y2} ${x2} ${y2}`;
  return <path d={d} fill="none" stroke={color} strokeWidth={strokeW} opacity={opacity} />;
}

// ─── Column header ─────────────────────────────────────────────────────────────────
function ColumnHeader({
  colIdx, typeName, headerY, nodeCount, isCollapsed, selColIdx, onToggle,
}: {
  colIdx: number; typeName: string; headerY: number; nodeCount: number;
  isCollapsed: boolean; selColIdx: number | null; onToggle: () => void;
}) {
  const meta      = (TC as any)[typeName];
  const cx        = colIdx * COLUMN_W;
  const canToggle = selColIdx !== colIdx;
  const label     = (meta?.l ?? typeName).toUpperCase();
  const icon      = meta?.i ?? '';

  if (isCollapsed) {
    return (
      <g style={{ cursor:'pointer' }} onClick={onToggle}>
        <rect x={cx - 56} y={headerY - 4} width={112} height={28} rx={14}
          fill="#dbeafe" stroke="#93c5fd" strokeWidth={1}/>
        <text x={cx} y={headerY + 13} textAnchor="middle" dominantBaseline="middle"
          fontSize={9} fontWeight={700} fill="#1e40af" fontFamily="system-ui"
          style={{ pointerEvents:'none' }}>
          + {label} ({nodeCount})
        </text>
      </g>
    );
  }
  return (
    <g>
      <text x={cx} y={headerY + 4} textAnchor="middle" fontSize={11} fontWeight={700}
        fill="#1e3a5f" fontFamily="system-ui"
        style={{ letterSpacing:'0.05em', pointerEvents:'none' }}>
        {icon}  {label}
      </text>
      {canToggle && (
        <g style={{ cursor:'pointer' }} onClick={onToggle}>
          <circle cx={cx} cy={headerY + 26} r={11} fill="#f8fafc" stroke="#e2e8f0" strokeWidth={1}/>
          <text x={cx} y={headerY + 26} textAnchor="middle" dominantBaseline="middle"
            fontSize={13} fontWeight={700} fill="#94a3b8"
            style={{ pointerEvents:'none', userSelect:'none' }}>
            −
          </text>
        </g>
      )}
    </g>
  );
}

// ─── Matrix node bubble ───────────────────────────────────────────────────────────
function MatrixNode({
  node, colIdx, isSelected, inPath, onClick,
}: {
  node: MindNode; colIdx: number; isSelected: boolean;
  inPath: boolean | null; onClick: () => void;
}) {
  const { item, color } = node;
  const isFirstCol = colIdx === 0;
  const completed  = item.status === 'Completed';
  const hClr       = item.health ? (HEALTH_CLR[item.health] ?? null) : null;

  const bgFill  = isFirstCol ? '#1e3a5f' : completed ? '#dcfce7' : '#ffffff';
  const txtFill = isFirstCol ? 'white'   : '#1e293b';
  const border  = isSelected ? '#16a34a' : isFirstCol ? 'rgba(255,255,255,0.18)' : color;
  const strokeW = isSelected ? 2 : 0.8;

  // inPath=null → normal; true → on path (emphasise); false → off path (dim)
  const nodeOpacity = inPath === false ? 0.18 : 1;

  const lines  = wrapTitle(item.title);
  const NH     = nodeHeight(item.title);
  const tH     = lines.length * LINE_H;
  const startY = -(tH / 2) + LINE_H * 0.78;

  return (
    <g transform={`translate(${node.x},${node.y})`} onClick={onClick}
       style={{ cursor:'pointer' }} opacity={nodeOpacity}>
      {/* Selection ring */}
      {isSelected && (
        <rect x={-NODE_W/2 - 5} y={-NH/2 - 5} width={NODE_W + 10} height={NH + 10}
          rx={NODE_RX + 5} fill="none" stroke="#16a34a"
          strokeWidth={2} strokeDasharray="5 3" />
      )}
      {/* Path-highlight ring (ancestors / descendants, not the selected node itself) */}
      {inPath === true && !isSelected && (
        <rect x={-NODE_W/2 - 3} y={-NH/2 - 3} width={NODE_W + 6} height={NH + 6}
          rx={NODE_RX + 3} fill="none" stroke={color}
          strokeWidth={1.5} opacity={0.6} />
      )}
      {/* Bubble */}
      <rect x={-NODE_W/2} y={-NH/2} width={NODE_W} height={NH}
        rx={NODE_RX} fill={bgFill} stroke={border} strokeWidth={strokeW}
        style={{ filter: isSelected
          ? 'drop-shadow(0 0 6px rgba(22,163,74,0.4))'
          : inPath === true
            ? `drop-shadow(0 2px 6px ${color}44)`
            : 'drop-shadow(0 1px 4px rgba(0,0,0,0.08))' }} />
      {/* Completed tick */}
      {completed && !isFirstCol && (
        <text x={-NODE_W/2 + 9} y={startY} fontSize={10} fill="#16a34a"
          style={{ pointerEvents:'none' }}>✓</text>
      )}
      {/* Title */}
      <text textAnchor="middle" fontSize={FONT_SZ}
        fontWeight={isFirstCol ? 700 : 600} fill={txtFill}
        fontFamily="system-ui" style={{ pointerEvents:'none' }}>
        {lines.map((ln, i) => (
          <tspan key={i} x={completed && !isFirstCol ? 6 : 0}
            dy={i === 0 ? startY : LINE_H}>{ln}</tspan>
        ))}
      </text>
      {/* Health dot */}
      {hClr && (
        <circle cx={NODE_W/2} cy={0} r={5}
          fill={hClr} stroke={isFirstCol ? '#1e3a5f' : 'white'} strokeWidth={0.8} />
      )}
    </g>
  );
}

// ─── "You are here" ───────────────────────────────────────────────────────────────
function YouAreHere({ node }: { node: MindNode }) {
  return (
    <g>
      <circle cx={node.x - NODE_W/2 - 22} cy={node.y} r={14} fill="#dc2626" opacity={0.9}/>
      <text x={node.x - NODE_W/2 - 22} y={node.y}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={15} style={{ pointerEvents:'none' }}>👉</text>
    </g>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────────
interface MindMapViewProps {
  items:       any[];
  sel:         string | null;
  onSel:       (id: string) => void;
  rootItemId?: string;
}

export function MindMapView({ items, sel, onSel, rootItemId }: MindMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tx, setTx]             = useState(0);
  const [ty, setTy]             = useState(0);
  const [scale, setScale]       = useState(1);
  const [dragging, setDragging] = useState(false);
  const drag                    = useRef({ ox:0, oy:0, tx:0, ty:0 });

  // Independent per-column collapse (Set of collapsed column indices)
  const [collapsedCols, setCollapsedCols] = useState<Set<number>>(new Set());

  // ── Build tree + colMap + layout + parentMap in one memo ──────────────────────
  const { nodes, edges, colMap, parentMap } = useMemo(() => {
    const t = buildTreeStructure(items, rootItemId);
    if (!t) return {
      nodes: [] as MindNode[], edges: [] as Edge[],
      colMap: new Map<string,number>(), parentMap: new Map<string,MindNode>(),
    };
    const allNodes = flatNodes(t);
    const cm       = buildColumnMap(allNodes);

    t.children.forEach((child, i) => { child.color = PALETTE[i % PALETTE.length]; });
    layoutMatrix(t, cm);
    const edgs = collectEdges(t, cm);

    // parent lookup: childId → parentMindNode
    const pm = new Map<string,MindNode>();
    for (const n of allNodes) {
      for (const c of n.children) pm.set(c.item.id, n);
    }
    return { nodes: allNodes, edges: edgs, colMap: cm, parentMap: pm };
  }, [items, rootItemId]);

  // ── Derived ────────────────────────────────────────────────────────────────────
  const contentNodes = useMemo(() => nodes.filter(n => n.item.id !== '__root'), [nodes]);
  const selNode      = sel ? contentNodes.find(n => n.item.id === sel) ?? null : null;
  const selColIdx    = selNode ? (colMap.get(selNode.item.type) ?? null) : null;

  // Full path: ancestors + selected + descendants
  const highlightedIds = useMemo((): Set<string> | null => {
    if (!sel || !selNode) return null;
    const set = new Set<string>();
    set.add(sel);
    // Walk UP
    let cur: MindNode | undefined = parentMap.get(sel);
    while (cur && cur.item.id !== '__root') {
      set.add(cur.item.id);
      cur = parentMap.get(cur.item.id);
    }
    // Walk DOWN
    (function addDesc(n: MindNode) {
      set.add(n.item.id);
      n.children.forEach(addDesc);
    })(selNode);
    return set;
  }, [sel, selNode, parentMap]);

  // Column list sorted by index
  const columns = useMemo(() => {
    const map = new Map<number, { typeName:string; count:number }>();
    for (const [type, idx] of colMap.entries()) {
      if (!map.has(idx)) map.set(idx, { typeName: type, count: 0 });
      map.get(idx)!.count += contentNodes.filter(n => n.item.type === type).length;
    }
    return [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([colIdx, { typeName, count }]) => ({ colIdx, typeName, count }));
  }, [colMap, contentNodes]);

  const maxColIdx = columns.length > 0 ? columns[columns.length - 1].colIdx : 0;

  // Visibility: a column is independently toggleable
  const isNodeVisible = useCallback((n: MindNode): boolean => {
    if (n.item.id === '__root') return false;
    return !collapsedCols.has(colMap.get(n.item.type) ?? 0);
  }, [colMap, collapsedCols]);

  const visibleNodes = useMemo(() => contentNodes.filter(isNodeVisible), [contentNodes, isNodeVisible]);
  const visibleEdges = useMemo(() =>
    edges.filter(e => !collapsedCols.has(e.fromColIdx) && !collapsedCols.has(e.toColIdx)),
    [edges, collapsedCols]
  );

  // Header Y: above topmost node (stable — based on all content, not just visible)
  const headerY = useMemo(() => {
    if (!contentNodes.length) return -HEADER_ABOVE;
    return Math.min(...contentNodes.map(n => n.y)) - HEADER_ABOVE;
  }, [contentNodes]);

  // ── Auto-fit ───────────────────────────────────────────────────────────────────
  const computeFit = useCallback((vnodes: MindNode[], hY: number) => {
    if (!vnodes.length || !containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    const pad  = 36;
    const minX = -(NODE_W / 2) - pad;
    const maxX = maxColIdx * COLUMN_W + NODE_W / 2 + pad;
    const minY = hY - 14;
    const maxY = Math.max(...vnodes.map(n => n.y)) + ROW_H / 2 + pad;
    const w    = maxX - minX || 1;
    const h    = maxY - minY || 1;
    const s    = Math.min((width * 0.96) / w, (height * 0.93) / h, 2.5);
    setScale(s);
    setTx(width  / 2 - ((minX + maxX) / 2) * s);
    setTy(height / 2 - ((minY + maxY) / 2) * s);
  }, [maxColIdx]);

  useEffect(() => {
    computeFit(contentNodes, headerY);
  }, [nodes]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pan / zoom ─────────────────────────────────────────────────────────────────
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale(s => Math.min(Math.max(s * (e.deltaY > 0 ? 0.9 : 1.1), 0.1), 4));
  }, []);
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setDragging(true);
    drag.current = { ox: e.clientX, oy: e.clientY, tx, ty };
  }, [tx, ty]);
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    setTx(drag.current.tx + (e.clientX - drag.current.ox));
    setTy(drag.current.ty + (e.clientY - drag.current.oy));
  }, [dragging]);
  const onMouseUp = useCallback(() => setDragging(false), []);

  // ── Empty state ─────────────────────────────────────────────────────────────────
  if (!contentNodes.length) {
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
        justifyContent:'center', height:'100%', gap:12, background:'white' }}>
        <div style={{ fontSize:52 }}>🌳</div>
        <div style={{ fontSize:15, fontWeight:700, color:'#374151' }}>No hierarchy to display</div>
        <div style={{ fontSize:12, textAlign:'center', maxWidth:320, lineHeight:1.6, color:'#6b7280' }}>
          Create a <strong>Vision</strong> item and link child items to see the strategy matrix.
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef}
      style={{ width:'100%', height:'100%', overflow:'hidden', background:'white',
               cursor: dragging ? 'grabbing' : 'grab',
               position:'relative', userSelect:'none' }}
      onWheel={onWheel} onMouseDown={onMouseDown} onMouseMove={onMouseMove}
      onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>

      {/* ── Zoom controls ──────────────────────────────────────────────────── */}
      <div style={{ position:'absolute', top:12, right:12, zIndex:10,
                    display:'flex', flexDirection:'column', gap:4 }}>
        {([
          { label:'+', fn:() => setScale(s => Math.min(s * 1.2, 4)) },
          { label:'−', fn:() => setScale(s => Math.max(s * 0.8, 0.1)) },
          { label:'⊙', fn:() => computeFit(visibleNodes, headerY) },
        ] as { label:string; fn:()=>void }[]).map(b => (
          <button key={b.label} onClick={b.fn}
            style={{ width:30, height:30, background:'white', border:'1px solid #e5e7eb',
                     borderRadius:6, cursor:'pointer',
                     fontSize: b.label === '⊙' ? 15 : 17, fontWeight:700,
                     color:'#374151', boxShadow:'0 1px 3px rgba(0,0,0,0.07)' }}>
            {b.label}
          </button>
        ))}
      </div>

      {/* ── Legend ─────────────────────────────────────────────────────────── */}
      <div style={{ position:'absolute', bottom:10, left:12, zIndex:10,
                    display:'flex', gap:10, fontSize:10, color:'#6b7280',
                    background:'white', borderRadius:8, padding:'5px 10px',
                    border:'1px solid #f3f4f6' }}>
        {[
          { label:'Completed', bg:'#dcfce7', border:'#16a34a' },
          { label:'Active',    bg:'white',   border:'#d1d5db'  },
        ].map(({ label, bg, border }) => (
          <span key={label} style={{ display:'flex', alignItems:'center', gap:3 }}>
            <span style={{ width:11, height:11, background:bg,
              border:`1px solid ${border}`, borderRadius:3, display:'inline-block' }}/>{label}
          </span>
        ))}
        {['Green','Amber','Red'].map(h => (
          <span key={h} style={{ display:'flex', alignItems:'center', gap:3 }}>
            <span style={{ width:8, height:8, borderRadius:'50%', display:'inline-block',
              background:HEALTH_CLR[h] }}/>{h}
          </span>
        ))}
        {highlightedIds && (
          <span style={{ display:'flex', alignItems:'center', gap:3,
            borderLeft:'1px solid #f3f4f6', paddingLeft:8, color:'#2563eb' }}>
            ✦ path highlighted
          </span>
        )}
      </div>

      <svg width="100%" height="100%" style={{ display:'block' }}>
        <g transform={`translate(${tx},${ty}) scale(${scale})`}>

          {/* ── Edges ──────────────────────────────────────────────────────── */}
          {visibleEdges.map((e, i) => {
            const inPath = highlightedIds === null
              ? null
              : (highlightedIds.has(e.fromId) && highlightedIds.has(e.toId));
            return <EdgePath key={i} {...e} inPath={inPath} />;
          })}

          {/* ── Column headers ─────────────────────────────────────────────── */}
          {columns.map(({ colIdx, typeName, count }) => (
            <ColumnHeader
              key={typeName}
              colIdx={colIdx} typeName={typeName}
              headerY={headerY} nodeCount={count}
              isCollapsed={collapsedCols.has(colIdx)}
              selColIdx={selColIdx}
              onToggle={() =>
                setCollapsedCols(prev => {
                  const next = new Set(prev);
                  if (next.has(colIdx)) next.delete(colIdx); else next.add(colIdx);
                  return next;
                })
              }
            />
          ))}

          {/* ── Nodes ──────────────────────────────────────────────────────── */}
          {visibleNodes.map(n => {
            const inPath = highlightedIds === null
              ? null
              : highlightedIds.has(n.item.id);
            return (
              <MatrixNode
                key={n.item.id} node={n}
                colIdx={colMap.get(n.item.type) ?? 0}
                isSelected={n.item.id === sel}
                inPath={inPath}
                onClick={() => onSel(n.item.id)}
              />
            );
          })}

          {/* ── You are here ───────────────────────────────────────────────── */}
          {selNode && isNodeVisible(selNode) && <YouAreHere node={selNode} />}

        </g>
      </svg>
    </div>
  );
}
