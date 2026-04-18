// src/modules/MindMap/MindMapView.tsx
// Left-to-right SVG mind-map: highest ancestor on the LEFT, children fan RIGHT.
// Each depth column has a −/+ collapse toggle. No visible swimlane dividers.

import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { TC, TL } from '../../constants';

// ─── Constants ─────────────────────────────────────────────────────────────────

const PALETTE = [
  '#2563eb','#16a34a','#d97706','#7c3aed',
  '#be185d','#0891b2','#ea580c','#0d9488',
  '#6366f1','#dc2626','#0369a1','#15803d',
];
const HEALTH_CLR: Record<string,string> = { Green:'#16a34a', Amber:'#f59e0b', Red:'#dc2626' };
const NODE_W         = 150;
const NODE_RX        = 17;
const ROW_H          = 92;    // vertical spacing per leaf
const LVL_DX         = 235;   // horizontal gap between depth columns
const ROOT_RX        = 82;    // root ellipse half-width
const ROOT_RY        = 46;    // root ellipse half-height
const LINE_H         = 13;    // text line-height inside nodes
const FONT_SZ        = 11;    // node title font size
const MAX_LINES      = 3;
const CHARS_PER_LINE = Math.floor((NODE_W - 20) / (FONT_SZ * 0.58));

// ─── Types ─────────────────────────────────────────────────────────────────────

interface MindNode {
  item:     any;
  children: MindNode[];
  x:        number;
  y:        number;
  depth:    number;   // 0 = root, 1 = first children, etc.
  color:    string;
}

interface Edge {
  x1: number; y1: number;
  x2: number; y2: number;
  color:     string;
  fromDepth: number;
  toDepth:   number;
}

// ─── Layout helpers ─────────────────────────────────────────────────────────────

function countLeaves(n: MindNode): number {
  return n.children.length ? n.children.reduce((s, c) => s + countLeaves(c), 0) : 1;
}

/** Assign x/y/depth to all nodes left-to-right by depth level. */
function layoutChildrenLR(children: MindNode[], yCtr: number, depth: number): void {
  const totalLeaves = Math.max(children.reduce((s, n) => s + countLeaves(n), 0), 1);
  const totalH = totalLeaves * ROW_H;
  let yOff = yCtr - totalH / 2;
  for (const node of children) {
    const leaves = countLeaves(node);
    const h      = leaves * ROW_H;
    const midY   = yOff + h / 2;
    node.x     = depth * LVL_DX;
    node.y     = midY;
    node.depth = depth;
    if (node.children.length) {
      // Propagate branch colour to children
      node.children.forEach(c => { if (c.color === '#1e3a5f') c.color = node.color; });
      layoutChildrenLR(node.children, midY, depth + 1);
    }
    yOff += h;
  }
}

// ─── Public helper ──────────────────────────────────────────────────────────────

/** Walk up the link chain to find the highest ancestor of a given item. */
export function findHighestAncestor(items: any[], itemId: string): any | null {
  const byId = new Map(items.map(i => [i.id, i]));
  let current = byId.get(itemId);
  if (!current) return null;
  const visited = new Set<string>();
  while (true) {
    if (visited.has(current.id)) break;
    visited.add(current.id);
    const parent = items
      .filter(p =>
        !visited.has(p.id) &&
        (TL[p.type] ?? 99) < (TL[current.type] ?? 99) &&
        ((p.links ?? []).includes(current.id) || (current.links ?? []).includes(p.id))
      )
      .sort((a, b) => (TL[a.type] ?? 0) - (TL[b.type] ?? 0))[0] ?? null;
    if (!parent) break;
    current = parent;
  }
  return current;
}

// ─── Tree builder ───────────────────────────────────────────────────────────────

function buildTree(items: any[], rootItemId?: string): MindNode | null {
  if (!items.length) return null;

  let rootItems: any[];
  if (rootItemId) {
    const root = items.find(i => i.id === rootItemId);
    rootItems  = root ? [root] : items.filter(i => i.type === 'vision');
  } else {
    rootItems  = items.filter(i => i.type === 'vision');
  }
  if (!rootItems.length) return null;

  function isParentChild(parent: any, child: any): boolean {
    const pLvl = TL[parent.type] ?? -1;
    const cLvl = TL[child.type]  ?? -1;
    if (cLvl <= pLvl) return false;
    const pLinks = parent.links ?? [];
    const cLinks = child.links  ?? [];
    return pLinks.includes(child.id) || cLinks.includes(parent.id);
  }

  const globalVisited = new Set<string>();
  function mkNode(item: any): MindNode {
    globalVisited.add(item.id);
    const children = items
      .filter(c => !globalVisited.has(c.id) && isParentChild(item, c))
      .sort((a, b) => (TL[a.type] ?? 0) - (TL[b.type] ?? 0))
      .map(c => mkNode(c));
    return { item, children, x: 0, y: 0, depth: 0, color: '#1e3a5f' };
  }

  const vNodes = rootItems.map(v => mkNode(v));
  const root: MindNode = vNodes.length === 1
    ? vNodes[0]
    : {
        item:     { id:'__root', type:'root', title:'Strategy', key:'', status:'', health:'' },
        children: vNodes, x: 0, y: 0, depth: 0, color: '#1e3a5f',
      };

  root.x = 0; root.y = 0; root.depth = 0;

  // Unique palette colours for first-level branches
  root.children.forEach((child, i) => {
    child.color = PALETTE[i % PALETTE.length];
  });

  if (root.children.length) layoutChildrenLR(root.children, 0, 1);
  return root;
}

// ─── Graph traversal ────────────────────────────────────────────────────────────

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
      // Source: right edge of parent (ellipse right for root, rect right for others)
      const sx = n.depth === 0 ? n.x + ROOT_RX : n.x + NODE_W / 2;
      // Target: left edge of child rect
      const ex = c.x - NODE_W / 2;
      edges.push({ x1: sx, y1: n.y, x2: ex, y2: c.y, color: c.color, fromDepth: n.depth, toDepth: c.depth });
      walk(c);
    }
  }
  walk(root);
  return edges;
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
  return Math.max(wrapTitle(title).length * LINE_H + 16, 30);
}

// ─── Edge ───────────────────────────────────────────────────────────────────────

function EdgePath({ x1, y1, x2, y2, color }: Edge) {
  const ctrl = (x2 - x1) * 0.45;
  const d    = `M ${x1} ${y1} C ${x1 + ctrl} ${y1} ${x2 - ctrl} ${y2} ${x2} ${y2}`;
  return <path d={d} fill="none" stroke={color} strokeWidth={1} opacity={0.55} />;
}

// ─── Lane collapse / expand button ─────────────────────────────────────────────

function LaneButton({
  depth, allNodes, collapsed, selDepth, onToggle,
}: {
  depth:     number;
  allNodes:  MindNode[];
  collapsed: boolean;
  selDepth:  number | null;
  onToggle:  () => void;
}) {
  const dNodes = allNodes.filter(n => n.depth === depth);
  if (!dNodes.length) return null;

  const typeName   = dNodes[0]?.item?.type ?? '';
  const meta       = TC[typeName as keyof typeof TC];
  const x          = depth * LVL_DX;
  const ys         = dNodes.map(n => n.y);
  const minY       = Math.min(...ys);
  const maxY       = Math.max(...ys);
  const canCollapse = selDepth !== depth;

  if (!collapsed) {
    // Small − pill floating above the topmost node
    const btnY = minY - 48;
    return (
      <g style={{ cursor: canCollapse ? 'pointer' : 'default' }}
         onClick={canCollapse ? onToggle : undefined}>
        <rect x={x - 16} y={btnY} width={32} height={20} rx={10}
          fill={canCollapse ? '#f1f5f9' : '#e5e7eb'}
          stroke={canCollapse ? '#cbd5e1' : '#d1d5db'} strokeWidth={1} />
        <text x={x} y={btnY + 10} textAnchor="middle" dominantBaseline="middle"
          fontSize={13} fontWeight={700}
          fill={canCollapse ? '#94a3b8' : '#9ca3af'}
          fontFamily="system-ui" style={{ pointerEvents:'none', userSelect:'none' }}>
          −
        </text>
      </g>
    );
  }

  // Collapsed: vertical pill strip showing type + count
  const pad    = 32;
  const stripY = minY - pad;
  const stripH = Math.max(maxY - minY + pad * 2, 60);
  const midY   = stripY + stripH / 2;
  const label  = `+ ${(meta?.l ?? typeName).toUpperCase()} (${dNodes.length})`;

  return (
    <g style={{ cursor:'pointer' }} onClick={onToggle}>
      <rect x={x - 16} y={stripY} width={32} height={stripH} rx={16}
        fill="#dbeafe" stroke="#93c5fd" strokeWidth={1} opacity={0.92} />
      <text x={x} y={midY} textAnchor="middle" dominantBaseline="middle"
        fontSize={9} fontWeight={700} fill="#1e40af" fontFamily="system-ui"
        transform={`rotate(-90,${x},${midY})`}
        style={{ pointerEvents:'none', userSelect:'none' }}>
        {label}
      </text>
    </g>
  );
}

// ─── Node ───────────────────────────────────────────────────────────────────────

function MindNode({ node, isSelected, isRoot, onClick }: {
  node: MindNode; isSelected: boolean; isRoot: boolean; onClick: () => void;
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
          fill="#4a6fa5" fontFamily="system-ui"
          style={{ pointerEvents:'none', letterSpacing:'0.05em' }}>
          {meta?.i ?? '🔭'} {(meta?.l ?? 'Vision').toUpperCase()}
        </text>
        {isSelected && (
          <ellipse cx={0} cy={0} rx={ROOT_RX + 6} ry={ROOT_RY + 6}
            fill="none" stroke="#16a34a" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.85} />
        )}
        <ellipse cx={0} cy={0} rx={ROOT_RX} ry={ROOT_RY}
          fill="#1e3a5f"
          stroke={isSelected ? '#16a34a' : 'rgba(255,255,255,0.2)'}
          strokeWidth={isSelected ? 1.5 : 1}
          style={{ filter:'drop-shadow(0 3px 8px rgba(0,0,0,0.25))' }} />
        <text textAnchor="middle" fontSize={12} fontWeight={700} fill="white"
          fontFamily="system-ui" style={{ pointerEvents:'none' }}>
          {lines.map((ln, i) => (
            <tspan key={i} x={0} dy={i === 0 ? startY : LINE_H + 1}>{ln}</tspan>
          ))}
        </text>
        {/* Health dot — straddles the right edge of the ellipse */}
        {hClr && (
          <circle cx={ROOT_RX + 3} cy={-(ROOT_RY * 0.4)} r={5}
            fill={hClr} stroke="white" strokeWidth={0.8} />
        )}
      </g>
    );
  }

  const lines  = wrapTitle(item.title);
  const NH     = nodeHeight(item.title);
  const tH     = lines.length * LINE_H;
  const startY = -(tH / 2) + LINE_H * 0.75;

  return (
    <g transform={`translate(${node.x},${node.y})`} onClick={onClick} style={{ cursor:'pointer' }}>
      {/* Type label above bubble */}
      {meta && (
        <text x={0} y={-(NH / 2 + 9)} textAnchor="middle" fontSize={8.5} fontWeight={700}
          fill={color} fontFamily="system-ui"
          style={{ pointerEvents:'none', letterSpacing:'0.04em' }}>
          {meta.i} {meta.l.toUpperCase()}
        </text>
      )}
      {/* Selection ring */}
      {isSelected && (
        <rect x={-NODE_W / 2 - 4} y={-NH / 2 - 4} width={NODE_W + 8} height={NH + 8}
          rx={NODE_RX + 4} fill="none" stroke="#16a34a" strokeWidth={1.5} strokeDasharray="4 3" />
      )}
      {/* Bubble */}
      <rect x={-NODE_W / 2} y={-NH / 2} width={NODE_W} height={NH}
        rx={NODE_RX} fill={fill} stroke={stroke} strokeWidth={strokeW}
        style={{ filter: isSelected
          ? 'drop-shadow(0 0 5px rgba(22,163,74,0.35))'
          : 'drop-shadow(0 1px 3px rgba(0,0,0,0.1))' }} />
      {/* Completed tick */}
      {completed && (
        <text x={-NODE_W / 2 + 8} y={startY} fontSize={10} fill="#16a34a"
          style={{ pointerEvents:'none' }}>✓</text>
      )}
      {/* Wrapped title */}
      <text textAnchor="middle" fontSize={FONT_SZ} fontWeight={600} fill="#1e293b"
        fontFamily="system-ui" style={{ pointerEvents:'none' }}>
        {lines.map((ln, i) => (
          <tspan key={i} x={completed ? 4 : 0} dy={i === 0 ? startY : LINE_H}>{ln}</tspan>
        ))}
      </text>
      {/* Health dot — straddles the right bubble edge */}
      {hClr && (
        <circle cx={NODE_W / 2} cy={0} r={5} fill={hClr} stroke="white" strokeWidth={0.8} />
      )}
    </g>
  );
}

// ─── "You are here" — red 👉 always to the LEFT of the bubble ──────────────────

function YouAreHere({ node, isRoot }: { node: MindNode; isRoot: boolean }) {
  if (isRoot) {
    const fx = -(ROOT_RX + 22);
    return (
      <g>
        <circle cx={fx} cy={0} r={14} fill="#dc2626" opacity={0.9} />
        <text x={fx} y={0} textAnchor="middle" dominantBaseline="middle"
          fontSize={15} style={{ pointerEvents:'none' }}>👉</text>
      </g>
    );
  }
  const fx = node.x - NODE_W / 2 - 22;
  return (
    <g>
      <circle cx={fx} cy={node.y} r={14} fill="#dc2626" opacity={0.9} />
      <text x={fx} y={node.y} textAnchor="middle" dominantBaseline="middle"
        fontSize={15} style={{ pointerEvents:'none' }}>👉</text>
    </g>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────────

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
  const [scale, setScale]       = useState(0.85);
  const [dragging, setDragging] = useState(false);
  const drag                    = useRef({ ox:0, oy:0, tx:0, ty:0 });
  const [collapsedDepths, setCollapsedDepths] = useState<Set<number>>(new Set());

  const tree  = useMemo(() => buildTree(items, rootItemId), [items, rootItemId]);
  const nodes = useMemo(() => tree ? flatNodes(tree) : [], [tree]);
  const edges = useMemo(() => tree ? collectEdges(tree) : [], [tree]);

  const rootId   = tree?.item.id ?? null;
  const selNode  = sel ? nodes.find(n => n.item.id === sel) ?? null : null;
  const selDepth = selNode?.depth ?? null;
  const maxDepth = useMemo(() => Math.max(0, ...nodes.map(n => n.depth)), [nodes]);

  // A node is visible only if none of its ancestor depths are collapsed
  const isNodeVisible = useCallback((n: MindNode): boolean => {
    if (n.depth === 0) return true;
    for (let d = 1; d <= n.depth; d++) {
      if (collapsedDepths.has(d)) return false;
    }
    return true;
  }, [collapsedDepths]);

  const visibleNodes = useMemo(() => nodes.filter(isNodeVisible), [nodes, isNodeVisible]);
  const visibleEdges = useMemo(() =>
    edges.filter(e => !collapsedDepths.has(e.fromDepth) && !collapsedDepths.has(e.toDepth)),
    [edges, collapsedDepths]
  );

  // Column indices for lane buttons (depth ≥ 1)
  const laneDepths = useMemo(
    () => Array.from({ length: maxDepth }, (_, i) => i + 1),
    [maxDepth]
  );

  // Toggle a depth: collapsing d also collapses d+1, d+2… (cascade); expanding d clears d+
  const toggleDepth = useCallback((depth: number) => {
    setCollapsedDepths(prev => {
      const next = new Set(prev);
      if (next.has(depth)) {
        // Expand this depth AND all deeper (so child lanes re-appear)
        for (let d = depth; d <= maxDepth; d++) next.delete(d);
      } else {
        // Collapse this depth AND all deeper
        for (let d = depth; d <= maxDepth; d++) next.add(d);
      }
      return next;
    });
  }, [maxDepth]);

  // ── Auto-fit on tree change ──────────────────────────────────────────────────
  const computeFit = useCallback((nodeList: MindNode[]) => {
    if (!nodeList.length || !containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    const pad  = 70;
    const allX = nodeList.map(n => n.x);
    const allY = nodeList.map(n => n.y);
    const minX = Math.min(...allX) - ROOT_RX - pad;
    const maxX = Math.max(...allX) + NODE_W / 2 + pad;
    const minY = Math.min(...allY) - ROW_H - pad;
    const maxY = Math.max(...allY) + ROW_H + pad;
    const s = Math.min((width * 0.95) / (maxX - minX), (height * 0.9) / (maxY - minY), 1.2);
    setScale(s);
    setTx(width  / 2 - ((minX + maxX) / 2) * s);
    setTy(height / 2 - ((minY + maxY) / 2) * s);
  }, []);

  useEffect(() => { computeFit(nodes); }, [nodes]); // eslint-disable-line react-hooks/exhaustive-deps

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

      {/* ── Zoom controls ──────────────────────────────────────────────────── */}
      <div style={{ position:'absolute', top:12, right:12, zIndex:10,
                    display:'flex', flexDirection:'column', gap:4 }}>
        {[
          { label:'+', action:() => setScale(s => Math.min(s * 1.2, 3)) },
          { label:'−', action:() => setScale(s => Math.max(s * 0.8, 0.15)) },
          { label:'⊙', action:() => computeFit(visibleNodes) },
        ].map(b => (
          <button key={b.label} onClick={b.action}
            style={{ width:30, height:30, background:'white', border:'1px solid #e2e8f0',
                     borderRadius:6, cursor:'pointer',
                     fontSize: b.label === '⊙' ? 15 : 17, fontWeight:700, lineHeight:1,
                     boxShadow:'0 1px 3px rgba(0,0,0,0.08)' }}>
            {b.label}
          </button>
        ))}
      </div>

      {/* ── Legend ─────────────────────────────────────────────────────────── */}
      <div style={{ position:'absolute', bottom:12, left:12, zIndex:10, display:'flex', gap:10,
                    fontSize:10, color:'#64748b', background:'white', borderRadius:8,
                    padding:'6px 12px', border:'1px solid #e2e8f0',
                    boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
        {[
          { label:'Completed', bg:'#dcfce7', border:'#16a34a', type:'rect' },
          { label:'Active',    bg:'white',   border:'#cbd5e1', type:'rect' },
        ].map(({ label, bg, border, type }) => (
          <span key={label} style={{ display:'flex', alignItems:'center', gap:4 }}>
            <span style={{ width:12, height:12, background:bg, border:`1px solid ${border}`,
              borderRadius: type === 'rect' ? 3 : '50%', display:'inline-block' }}/>
            {label}
          </span>
        ))}
        {['Green','Amber','Red'].map(h => (
          <span key={h} style={{ display:'flex', alignItems:'center', gap:4 }}>
            <span style={{ width:8, height:8, background:HEALTH_CLR[h],
              borderRadius:'50%', display:'inline-block' }}/>{h}
          </span>
        ))}
      </div>

      <svg width="100%" height="100%" style={{ display:'block' }}>
        <g transform={`translate(${tx},${ty}) scale(${scale})`}>

          {/* ── Edges (behind everything) ──────────────────────────────────── */}
          {visibleEdges.map((e, i) => <EdgePath key={i} {...e} />)}

          {/* ── Lane toggle buttons (one per depth ≥ 1) ───────────────────── */}
          {laneDepths.map(depth => {
            // Only show button if all parent depths are visible
            const parentCollapsed = Array.from({ length: depth - 1 }, (_, i) => i + 1)
              .some(d => collapsedDepths.has(d));
            if (parentCollapsed) return null;
            return (
              <LaneButton
                key={depth}
                depth={depth}
                allNodes={nodes}
                collapsed={collapsedDepths.has(depth)}
                selDepth={selDepth}
                onToggle={() => toggleDepth(depth)}
              />
            );
          })}

          {/* ── Nodes ──────────────────────────────────────────────────────── */}
          {visibleNodes.map(n => (
            <MindNode key={n.item.id} node={n}
              isSelected={n.item.id === sel}
              isRoot={n.item.id === rootId}
              onClick={() => { if (n.item.id !== '__root') onSel(n.item.id); }}
            />
          ))}

          {/* ── "You are here" pointer ─────────────────────────────────────── */}
          {selNode && isNodeVisible(selNode) && (
            <YouAreHere node={selNode} isRoot={selNode.item.id === rootId} />
          )}

        </g>
      </svg>
    </div>
  );
}
