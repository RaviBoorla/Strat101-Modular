// src/modules/MindMap/MindMapView.tsx
// Full-page SVG mind-map showing the work-item hierarchy.
// Vision at centre, branches fan left/right, bezier connectors.

import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { TC, TL } from '../../constants';

// ─── Constants ────────────────────────────────────────────────────────────────

const PALETTE = [
  '#2563eb','#16a34a','#d97706','#7c3aed',
  '#be185d','#0891b2','#ea580c','#0d9488',
  '#6366f1','#dc2626','#0369a1','#15803d',
];
const HEALTH_CLR: Record<string,string> = { Green:'#16a34a', Amber:'#f59e0b', Red:'#dc2626' };
const NODE_W   = 150;
const NODE_RX  = 17;
const ROW_H    = 88;   // taller to accommodate wrapped text
const LVL_DX   = 210;
const ROOT_RX  = 82;   // ellipse half-width
const ROOT_RY  = 46;   // ellipse half-height
const LINE_H   = 13;   // text line-height inside nodes
const FONT_SZ  = 11;   // node title font size
const MAX_LINES = 3;   // max wrapped lines per node
// approximate chars that fit per line: NODE_W minus padding / charWidth
const CHARS_PER_LINE = Math.floor((NODE_W - 20) / (FONT_SZ * 0.58));

// ─── Types ────────────────────────────────────────────────────────────────────

interface MindNode {
  item:     any;
  children: MindNode[];
  x:        number;
  y:        number;
  side:     'left' | 'right' | 'center';
  color:    string;
}

interface Edge { x1:number; y1:number; x2:number; y2:number; color:string; side:'left'|'right'|'center'; }

// ─── Tree helpers ─────────────────────────────────────────────────────────────

function countLeaves(n: MindNode): number {
  return n.children.length ? n.children.reduce((s, c) => s + countLeaves(c), 0) : 1;
}

function layoutChildren(
  children: MindNode[], parentX: number, yCtr: number,
  side: 'left' | 'right', color: string,
): void {
  const totalLeaves = Math.max(children.reduce((s, n) => s + countLeaves(n), 0), 1);
  const totalH = totalLeaves * ROW_H;
  let yOff = yCtr - totalH / 2;
  for (const node of children) {
    const leaves = countLeaves(node);
    const h = leaves * ROW_H;
    const midY = yOff + h / 2;
    const nx = side === 'right' ? parentX + LVL_DX : parentX - LVL_DX;
    node.x = nx; node.y = midY; node.side = side; node.color = color;
    if (node.children.length) layoutChildren(node.children, nx, midY, side, color);
    yOff += h;
  }
}

/** Walk up the link chain to find the highest ancestor of a given item. */
export function findHighestAncestor(items: any[], itemId: string): any | null {
  const byId = new Map(items.map(i => [i.id, i]));
  let current = byId.get(itemId);
  if (!current) return null;
  const visited = new Set<string>();
  while (true) {
    if (visited.has(current.id)) break;
    visited.add(current.id);
    // Find any item that is at a strictly higher (shallower) level AND linked
    const parent = items
      .filter(p =>
        !visited.has(p.id) &&
        (TL[p.type] ?? 99) < (TL[current.type] ?? 99) &&
        ((p.links ?? []).includes(current.id) || (current.links ?? []).includes(p.id))
      )
      // Prefer the shallowest ancestor (lowest TL level) so we always get the true root
      .sort((a, b) => (TL[a.type] ?? 0) - (TL[b.type] ?? 0))[0] ?? null;
    if (!parent) break;
    current = parent;
  }
  return current;
}

function buildTree(items: any[], rootItemId?: string): MindNode | null {
  if (!items.length) return null;

  // If a specific root is requested (triggered from a work item), use it.
  // Otherwise fall back to all Vision items.
  let rootItems: any[];
  if (rootItemId) {
    const root = items.find(i => i.id === rootItemId);
    rootItems = root ? [root] : items.filter(i => i.type === 'vision');
  } else {
    rootItems = items.filter(i => i.type === 'vision');
  }
  if (!rootItems.length) return null;

  // Child must be at a strictly deeper hierarchy level AND linked to parent.
  // We allow any level gap (not just +1) to match actual link data which may
  // skip levels (e.g. Vision linked directly to Goal).
  function isParentChild(parent: any, child: any): boolean {
    const pLvl = TL[parent.type] ?? -1;
    const cLvl = TL[child.type] ?? -1;
    if (cLvl <= pLvl) return false;                  // must be strictly deeper
    const pLinks = parent.links ?? [];
    const cLinks = child.links  ?? [];
    // parent.links contains child.id  OR  child.links contains parent.id
    return pLinks.includes(child.id) || cLinks.includes(parent.id);
  }

  // Use a SHARED visited set so each item appears only once in the tree,
  // even if it is linked from multiple parents.
  const globalVisited = new Set<string>();

  function mkNode(item: any): MindNode {
    globalVisited.add(item.id);
    const children = items
      .filter(c => !globalVisited.has(c.id) && isParentChild(item, c))
      // Sort children by hierarchy level so shallower items are claimed first
      .sort((a, b) => (TL[a.type] ?? 0) - (TL[b.type] ?? 0))
      .map(c => mkNode(c));
    return { item, children, x: 0, y: 0, side: 'center', color: '#1e3a5f' };
  }

  const vNodes = rootItems.map(v => mkNode(v));
  const root: MindNode = vNodes.length === 1
    ? vNodes[0]
    : { item:{ id:'__root', type:'root', title:'Strategy', key:'', status:'', health:'' },
        children: vNodes, x: 0, y: 0, side:'center', color:'#1e3a5f' };

  root.x = 0; root.y = 0;

  const N = root.children.length;
  const half = Math.ceil(N / 2);
  const rightKids = root.children.slice(0, half);
  const leftKids  = root.children.slice(half);

  function placeSide(kids: MindNode[], side: 'left'|'right', colorOffset: number) {
    const tl = Math.max(kids.reduce((s, n) => s + countLeaves(n), 0), 1);
    const tH = tl * ROW_H;
    let yOff = -tH / 2;
    kids.forEach((n, i) => {
      const color = PALETTE[(colorOffset + i) % PALETTE.length];
      const leaves = countLeaves(n);
      const h = leaves * ROW_H;
      const midY = yOff + h / 2;
      n.x = side === 'right' ? LVL_DX : -LVL_DX;
      n.y = midY; n.side = side; n.color = color;
      if (n.children.length) layoutChildren(n.children, n.x, midY, side, color);
      yOff += h;
    });
  }

  placeSide(rightKids, 'right', 0);
  placeSide(leftKids,  'left',  half);
  return root;
}

function flatNodes(root: MindNode): MindNode[] {
  const out: MindNode[] = [];
  function walk(n: MindNode) { out.push(n); n.children.forEach(walk); }
  walk(root);
  return out;
}

function collectEdges(root: MindNode): Edge[] {
  const edges: Edge[] = [];
  function walk(n: MindNode) {
    for (const c of n.children) {
      edges.push({ x1: n.x, y1: n.y, x2: c.x, y2: c.y, color: c.color, side: c.side });
      walk(c);
    }
  }
  walk(root);
  return edges;
}

/** Wrap title into lines of ≤ CHARS_PER_LINE chars, max MAX_LINES lines. */
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

/** Compute node height from wrapped line count. */
function nodeHeight(title: string): number {
  const n = wrapTitle(title).length;
  return Math.max(n * LINE_H + 16, 30);
}

// ─── Edge ─────────────────────────────────────────────────────────────────────

function EdgePath({ x1, y1, x2, y2, color, side }: Edge) {
  const ctrl = LVL_DX * 0.52;
  const cx1r = side === 'left' ? x1 - ctrl : x1 + ctrl;
  const cx2r = side === 'left' ? x2 + ctrl : x2 - ctrl;
  const d = `M ${x1} ${y1} C ${cx1r} ${y1} ${cx2r} ${y2} ${x2} ${y2}`;
  return <path d={d} fill="none" stroke={color} strokeWidth={1} opacity={0.6}/>;
}

// ─── Node ─────────────────────────────────────────────────────────────────────

function MindNode({ node, isSelected, isRoot, onClick }: {
  node:MindNode; isSelected:boolean; isRoot:boolean; onClick:()=>void
}) {
  const { item, color } = node;
  const completed = item.status === 'Completed';
  const meta      = TC[item.type as keyof typeof TC];
  const hClr      = item.health ? (HEALTH_CLR[item.health] ?? '#94a3b8') : null;
  const fill      = completed ? '#dcfce7' : '#ffffff';
  const stroke    = isSelected ? '#16a34a' : color;
  const strokeW   = isSelected ? 1.5 : 0.8;

  if (isRoot) {
    const lines  = wrapTitle(item.title);
    const tH     = lines.length * LINE_H;
    const startY = -(tH / 2) + LINE_H * 0.75;
    return (
      <g onClick={onClick} style={{ cursor:'pointer' }}>
        {/* Type label OUTSIDE / above the ellipse */}
        <text x={0} y={-(ROOT_RY + 10)} textAnchor="middle" fontSize={9} fontWeight={700}
          fill="#4a6fa5" fontFamily="system-ui" style={{pointerEvents:'none',letterSpacing:'0.05em'}}>
          {meta?.i ?? '🔭'} {(meta?.l ?? 'Vision').toUpperCase()}
        </text>
        {isSelected && (
          <ellipse cx={0} cy={0} rx={ROOT_RX + 6} ry={ROOT_RY + 6}
            fill="none" stroke="#16a34a" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.85}/>
        )}
        <ellipse cx={0} cy={0} rx={ROOT_RX} ry={ROOT_RY}
          fill="#1e3a5f"
          stroke={isSelected ? '#16a34a' : 'rgba(255,255,255,0.2)'}
          strokeWidth={isSelected ? 1.5 : 1}
          style={{ filter:'drop-shadow(0 3px 8px rgba(0,0,0,0.25))' }}/>
        {/* Wrapped title inside ellipse */}
        <text textAnchor="middle" fontSize={12} fontWeight={700} fill="white"
          fontFamily="system-ui" style={{pointerEvents:'none'}}>
          {lines.map((ln, i) => (
            <tspan key={i} x={0} dy={i === 0 ? startY : LINE_H + 1}>{ln}</tspan>
          ))}
        </text>
        {/* Health dot — partly overlapping the right edge of ellipse */}
        {hClr && <circle cx={ROOT_RX + 3} cy={-(ROOT_RY * 0.4)} r={5} fill={hClr} stroke="white" strokeWidth={0.8}/>}
      </g>
    );
  }

  // Dynamic node height based on wrapped line count
  const lines  = wrapTitle(item.title);
  const NH     = nodeHeight(item.title);
  const tH     = lines.length * LINE_H;
  const startY = -(tH / 2) + LINE_H * 0.75;

  return (
    <g transform={`translate(${node.x},${node.y})`} onClick={onClick} style={{ cursor:'pointer' }}>
      {/* Type label above bubble (always outside) */}
      {meta && (
        <text x={0} y={-(NH / 2 + 9)} textAnchor="middle" fontSize={8.5} fontWeight={700} fill={color}
          fontFamily="system-ui" style={{pointerEvents:'none',letterSpacing:'0.04em'}}>
          {meta.i} {meta.l.toUpperCase()}
        </text>
      )}
      {/* Selection ring */}
      {isSelected && (
        <rect x={-NODE_W/2 - 4} y={-NH/2 - 4} width={NODE_W + 8} height={NH + 8}
          rx={NODE_RX + 4} fill="none" stroke="#16a34a" strokeWidth={1.5} strokeDasharray="4 3"/>
      )}
      {/* Bubble */}
      <rect x={-NODE_W/2} y={-NH/2} width={NODE_W} height={NH}
        rx={NODE_RX} fill={fill} stroke={stroke} strokeWidth={strokeW}
        style={{filter: isSelected ? 'drop-shadow(0 0 5px rgba(22,163,74,0.35))' : 'drop-shadow(0 1px 3px rgba(0,0,0,0.1))'}}/>
      {/* Completed tick */}
      {completed && (
        <text x={-NODE_W/2 + 8} y={startY} fontSize={10} fill="#16a34a" style={{pointerEvents:'none'}}>✓</text>
      )}
      {/* Wrapped title */}
      <text textAnchor="middle" fontSize={FONT_SZ} fontWeight={600} fill="#1e293b"
        fontFamily="system-ui" style={{pointerEvents:'none'}}>
        {lines.map((ln, i) => (
          <tspan key={i} x={completed ? 4 : 0} dy={i === 0 ? startY : LINE_H}>{ln}</tspan>
        ))}
      </text>
      {/* Health dot — centre on the right bubble edge (partly inside, partly outside) */}
      {hClr && <circle cx={NODE_W/2} cy={0} r={5} fill={hClr} stroke="white" strokeWidth={0.8}/>}
    </g>
  );
}

// ─── "You are here" — red finger to the LEFT of any bubble ───────────────────

function YouAreHere({ node, isRoot }: { node: MindNode; isRoot: boolean }) {
  // Always placed to the LEFT of the item
  if (isRoot) {
    const fx = -(ROOT_RX + 22);
    return (
      <g>
        <circle cx={fx} cy={0} r={14} fill="#dc2626" opacity={0.9}/>
        <text x={fx} y={0} textAnchor="middle" dominantBaseline="middle"
          fontSize={15} style={{pointerEvents:'none'}}>👉</text>
      </g>
    );
  }
  const fx = node.x - NODE_W / 2 - 22;
  return (
    <g>
      <circle cx={fx} cy={node.y} r={14} fill="#dc2626" opacity={0.9}/>
      <text x={fx} y={node.y} textAnchor="middle" dominantBaseline="middle"
        fontSize={15} style={{pointerEvents:'none'}}>👉</text>
    </g>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface MindMapViewProps {
  items:       any[];
  sel:         string | null;
  onSel:       (id: string) => void;
  rootItemId?: string;   // if set, this item is the centre; otherwise uses vision items
}

export function MindMapView({ items, sel, onSel, rootItemId }: MindMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tx, setTx]       = useState(0);
  const [ty, setTy]       = useState(0);
  const [scale, setScale] = useState(0.85);
  const [dragging, setDragging] = useState(false);
  const drag = useRef({ ox:0, oy:0, tx:0, ty:0 });

  const tree  = useMemo(() => buildTree(items, rootItemId), [items, rootItemId]);
  const nodes = useMemo(() => tree ? flatNodes(tree) : [], [tree]);
  const edges = useMemo(() => tree ? collectEdges(tree) : [], [tree]);

  // Auto-fit on mount / tree change
  useEffect(() => {
    if (!nodes.length || !containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    const xs = nodes.map(n => n.x);
    const ys = nodes.map(n => n.y);
    const pad = 60;
    const minX = Math.min(...xs) - NODE_W - pad;
    const maxX = Math.max(...xs) + NODE_W + 30 + pad;
    const minY = Math.min(...ys) - ROW_H * 2 - pad;
    const maxY = Math.max(...ys) + ROW_H * 2 + pad;
    const s = Math.min((width * 0.95) / (maxX - minX), (height * 0.95) / (maxY - minY), 1.2);
    setScale(s);
    setTx(width  / 2 - ((minX + maxX) / 2) * s);
    setTy(height / 2 - ((minY + maxY) / 2) * s);
  }, [nodes]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale(s => Math.min(Math.max(s * (e.deltaY > 0 ? 0.9 : 1.1), 0.15), 3));
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

  const selNode = sel ? nodes.find(n => n.item.id === sel) ?? null : null;
  const rootId  = tree?.item.id ?? null;

  if (!tree) {
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        height:'100%', gap:12, color:'#94a3b8', background:'#f8fafc' }}>
        <div style={{ fontSize:52 }}>🌳</div>
        <div style={{ fontSize:15, fontWeight:700, color:'#374151' }}>No hierarchy to display</div>
        <div style={{ fontSize:12, textAlign:'center', maxWidth:320, lineHeight:1.6 }}>
          Create a <strong>Vision</strong> item and link it to <strong>Missions</strong> to see the mind map.
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef}
      style={{ width:'100%', height:'100%', overflow:'hidden', background:'#f0f4f8',
               cursor: dragging ? 'grabbing' : 'grab', position:'relative', userSelect:'none' }}
      onWheel={onWheel} onMouseDown={onMouseDown} onMouseMove={onMouseMove}
      onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>

      {/* Zoom controls */}
      <div style={{ position:'absolute', top:12, right:12, zIndex:10, display:'flex', flexDirection:'column', gap:4 }}>
        {[
          { label:'+', action:() => setScale(s => Math.min(s * 1.2, 3)) },
          { label:'−', action:() => setScale(s => Math.max(s * 0.8, 0.15)) },
          { label:'⊙', action:() => {
              if (!nodes.length || !containerRef.current) return;
              const { width, height } = containerRef.current.getBoundingClientRect();
              const xs = nodes.map(n => n.x); const ys = nodes.map(n => n.y);
              const pad = 60;
              const minX = Math.min(...xs)-NODE_W-pad; const maxX = Math.max(...xs)+NODE_W+30+pad;
              const minY = Math.min(...ys)-ROW_H*2-pad; const maxY = Math.max(...ys)+ROW_H*2+pad;
              const s = Math.min((width*.95)/(maxX-minX),(height*.95)/(maxY-minY),1.2);
              setScale(s); setTx(width/2-((minX+maxX)/2)*s); setTy(height/2-((minY+maxY)/2)*s);
            }},
        ].map(b => (
          <button key={b.label} onClick={b.action}
            style={{ width:30, height:30, background:'white', border:'1px solid #e2e8f0', borderRadius:6,
                     cursor:'pointer', fontSize:b.label==='⊙'?15:17, fontWeight:700, lineHeight:1,
                     boxShadow:'0 1px 3px rgba(0,0,0,0.08)' }}>
            {b.label}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div style={{ position:'absolute', bottom:12, left:12, zIndex:10, display:'flex', gap:10,
                    fontSize:10, color:'#64748b', background:'white', borderRadius:8,
                    padding:'6px 12px', border:'1px solid #e2e8f0', boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
        <span style={{ display:'flex', alignItems:'center', gap:4 }}>
          <span style={{ width:12, height:12, background:'#dcfce7', border:'1px solid #16a34a', borderRadius:3, display:'inline-block' }}/>Completed
        </span>
        <span style={{ display:'flex', alignItems:'center', gap:4 }}>
          <span style={{ width:12, height:12, background:'white', border:'1px solid #cbd5e1', borderRadius:3, display:'inline-block' }}/>Active
        </span>
        {['Green','Amber','Red'].map(h => (
          <span key={h} style={{ display:'flex', alignItems:'center', gap:4 }}>
            <span style={{ width:8, height:8, background:HEALTH_CLR[h], borderRadius:'50%', display:'inline-block' }}/>{h}
          </span>
        ))}
      </div>

      <svg width="100%" height="100%" style={{ display:'block' }}>
        <g transform={`translate(${tx},${ty}) scale(${scale})`}>
          {/* Edges first (behind nodes) */}
          {edges.map((e, i) => <EdgePath key={i} {...e}/>)}

          {/* Nodes */}
          {nodes.map(n => (
            <MindNode key={n.item.id} node={n}
              isSelected={n.item.id === sel}
              isRoot={n.item.id === rootId}
              onClick={() => { if (n.item.id !== '__root') onSel(n.item.id); }}
            />
          ))}

          {/* "You are here" pointer */}
          {selNode && (
            <YouAreHere node={selNode} isRoot={selNode.item.id === rootId}/>
          )}
        </g>
      </svg>
    </div>
  );
}
