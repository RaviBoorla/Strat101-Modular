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
const NODE_W   = 145;
const NODE_H   = 34;
const NODE_RX  = 17;
const ROW_H    = 68;
const LVL_DX   = 205;
const ROOT_R   = 54;

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

function buildTree(items: any[]): MindNode | null {
  if (!items.length) return null;
  const roots = items.filter(i => i.type === 'vision');
  if (!roots.length) return null;

  function isParentChild(parent: any, child: any): boolean {
    const pLvl = TL[parent.type] ?? -1;
    const cLvl = TL[child.type] ?? -1;
    if (cLvl !== pLvl + 1) return false;
    const pLinks = parent.links  ?? [];
    const cLinks = child.links   ?? [];
    return pLinks.includes(child.id) || cLinks.includes(parent.id);
  }

  function mkNode(item: any, visited: Set<string>): MindNode {
    visited.add(item.id);
    const children = items
      .filter(c => !visited.has(c.id) && isParentChild(item, c))
      .map(c => mkNode(c, new Set(visited)));
    return { item, children, x: 0, y: 0, side: 'center', color: '#1e3a5f' };
  }

  const vNodes = roots.map(v => mkNode(v, new Set<string>()));
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

function trunc(s: string, max: number) {
  if (!s) return '';
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

// ─── Edge ─────────────────────────────────────────────────────────────────────

function EdgePath({ x1, y1, x2, y2, color, side }: Edge) {
  const ctrl = LVL_DX * 0.55;
  const cx1 = side === 'right' ? x1 + ctrl : x1 - ctrl;
  const cx2 = side === 'right' ? x2 - ctrl : x2 + ctrl;
  // Root → first level: side may be 'center', treat as right for control points
  const cx1r = side === 'left' ? x1 - ctrl : x1 + ctrl;
  const cx2r = side === 'left' ? x2 + ctrl : x2 - ctrl;
  const d = `M ${x1} ${y1} C ${cx1r} ${y1} ${cx2r} ${y2} ${x2} ${y2}`;
  return <path d={d} fill="none" stroke={color} strokeWidth={2.5} opacity={0.65}/>;
}

// ─── Node ─────────────────────────────────────────────────────────────────────

function MindNode({ node, isSelected, isRoot, onClick }: { node:MindNode; isSelected:boolean; isRoot:boolean; onClick:()=>void }) {
  const { item, color } = node;
  const completed = item.status === 'Completed';
  const meta      = TC[item.type as keyof typeof TC];
  const hClr      = item.health ? (HEALTH_CLR[item.health] ?? '#94a3b8') : null;
  const fill      = completed ? '#dcfce7' : '#ffffff';
  const stroke    = isSelected ? '#16a34a' : color;
  const strokeW   = isSelected ? 2.5 : 1.5;

  if (isRoot) {
    return (
      <g onClick={onClick} style={{ cursor:'pointer' }}>
        {isSelected && (
          <circle cx={0} cy={0} r={ROOT_R + 7} fill="none" stroke="#16a34a" strokeWidth={2} strokeDasharray="5 3" opacity={0.9}/>
        )}
        <circle cx={0} cy={0} r={ROOT_R} fill="#1e3a5f" stroke={isSelected ? '#16a34a' : 'rgba(255,255,255,0.25)'} strokeWidth={isSelected ? 2.5 : 1.5}/>
        <text x={0} y={-6} textAnchor="middle" fontSize={10} fill="rgba(255,255,255,0.55)" fontFamily="system-ui" style={{pointerEvents:'none'}}>
          {meta?.i ?? '🔭'} {meta?.l ?? 'Vision'}
        </text>
        <text x={0} y={8} textAnchor="middle" dominantBaseline="middle" fontSize={12} fontWeight={700} fill="white" fontFamily="system-ui" style={{pointerEvents:'none'}}>
          {trunc(item.title, 16)}
        </text>
        {hClr && <circle cx={ROOT_R + 8} cy={0} r={5} fill={hClr} stroke="white" strokeWidth={1}/>}
      </g>
    );
  }

  return (
    <g transform={`translate(${node.x},${node.y})`} onClick={onClick} style={{ cursor:'pointer' }}>
      {/* Type label */}
      {meta && (
        <text x={0} y={-(NODE_H / 2 + 10)} textAnchor="middle" fontSize={9} fontWeight={700} fill={color}
          fontFamily="system-ui" style={{pointerEvents:'none',letterSpacing:'0.04em'}}>
          {meta.i} {meta.l.toUpperCase()}
        </text>
      )}
      {/* Selection ring */}
      {isSelected && (
        <rect x={-NODE_W/2 - 5} y={-NODE_H/2 - 5} width={NODE_W + 10} height={NODE_H + 10}
          rx={NODE_RX + 5} fill="none" stroke="#16a34a" strokeWidth={2} strokeDasharray="5 3"/>
      )}
      {/* Bubble */}
      <rect x={-NODE_W/2} y={-NODE_H/2} width={NODE_W} height={NODE_H}
        rx={NODE_RX} fill={fill} stroke={stroke} strokeWidth={strokeW}
        style={{filter: isSelected ? 'drop-shadow(0 0 6px rgba(22,163,74,0.4))' : 'drop-shadow(0 1px 4px rgba(0,0,0,0.12))'}}/>
      {/* Completed tick */}
      {completed && (
        <text x={-NODE_W/2 + 9} y={1} dominantBaseline="middle" fontSize={11} fill="#16a34a" style={{pointerEvents:'none'}}>✓</text>
      )}
      {/* Title */}
      <text x={completed ? 2 : 0} y={0} textAnchor="middle" dominantBaseline="middle"
        fontSize={11} fontWeight={600} fill="#1e293b" fontFamily="system-ui" style={{pointerEvents:'none'}}>
        {trunc(item.title, 17)}
      </text>
      {/* Health dot */}
      {hClr && <circle cx={NODE_W/2 + 8} cy={0} r={5} fill={hClr} stroke="white" strokeWidth={1}/>}
    </g>
  );
}

// ─── "You are here" badge ─────────────────────────────────────────────────────

function YouAreHere({ node, isRoot }: { node: MindNode; isRoot: boolean }) {
  if (isRoot) {
    // Badge below the root circle
    const by = ROOT_R + 26;
    return (
      <g>
        <line x1={0} y1={ROOT_R + 3} x2={0} y2={by - 11} stroke="#16a34a" strokeWidth={1.5} strokeDasharray="3 2"/>
        <rect x={-38} y={by - 11} width={76} height={22} rx={11} fill="#16a34a"/>
        <text x={0} y={by} textAnchor="middle" dominantBaseline="middle"
          fontSize={10} fontWeight={700} fill="white" fontFamily="system-ui">📍 You are here</text>
      </g>
    );
  }
  const onRight = node.side !== 'left';
  const bx = onRight ? node.x + NODE_W / 2 + 52 : node.x - NODE_W / 2 - 52;
  const lx1 = onRight ? node.x + NODE_W / 2 + 3  : node.x - NODE_W / 2 - 3;
  const lx2 = onRight ? bx - 38                   : bx + 38;
  return (
    <g>
      <line x1={lx1} y1={node.y} x2={lx2} y2={node.y} stroke="#16a34a" strokeWidth={1.5} strokeDasharray="3 2"/>
      <rect x={bx - 42} y={node.y - 11} width={84} height={22} rx={11} fill="#16a34a"/>
      <text x={bx} y={node.y} textAnchor="middle" dominantBaseline="middle"
        fontSize={10} fontWeight={700} fill="white" fontFamily="system-ui">📍 You are here</text>
    </g>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface MindMapViewProps {
  items: any[];
  sel:   string | null;
  onSel: (id: string) => void;
}

export function MindMapView({ items, sel, onSel }: MindMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tx, setTx]       = useState(0);
  const [ty, setTy]       = useState(0);
  const [scale, setScale] = useState(0.85);
  const [dragging, setDragging] = useState(false);
  const drag = useRef({ ox:0, oy:0, tx:0, ty:0 });

  const tree  = useMemo(() => buildTree(items), [items]);
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
    const minY = Math.min(...ys) - NODE_H * 3 - pad;
    const maxY = Math.max(...ys) + NODE_H * 3 + pad;
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
              const minY = Math.min(...ys)-NODE_H*3-pad; const maxY = Math.max(...ys)+NODE_H*3+pad;
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
