import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface ChatMessage {
  id: string; tenant_id: string; sender: string;
  channel: string; message: string; is_broadcast: boolean;
  read_by: string[]; created_at: string;
}
interface ChatUser { username: string; full_name: string; role: string; tenant_id?: string; }
interface ChatPanelProps {
  tenantId:   string;
  loggedUser: string;
  userRole?:  string;
  isViewer?:  boolean;
  onClose?:   () => void;   // called when × is pressed inside panel
  embedded?:  boolean;      // true = renders as panel, not floating
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const dmKey = (a: string, b: string) => [a, b].sort().join('::');

function fmtTime(iso: string) {
  const d = new Date(iso), now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' })
    + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const COLORS = ['#2563eb','#7c3aed','#0891b2','#059669','#d97706','#dc2626','#db2777'];
function avatarColor(n: string) {
  let h = 0; for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) & 0xfffffff;
  return COLORS[h % COLORS.length];
}
function Avatar({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', background:avatarColor(name),
      color:'white', display:'flex', alignItems:'center', justifyContent:'center',
      fontSize:size*0.4, fontWeight:600, flexShrink:0, fontFamily:'system-ui' }}>
      {name.slice(0,2).toUpperCase()}
    </div>
  );
}

// Tick component — one grey = sent, two grey = delivered, two navy = read
function Ticks({ msg, loggedUser }: { msg: ChatMessage; loggedUser: string }) {
  if (msg.id.startsWith('opt_')) return <span style={{fontSize:9,color:'#9ca3af',marginLeft:3}}>✓</span>;
  const readByOthers = (msg.read_by||[]).some(u => u !== loggedUser);
  if (readByOthers) return <span style={{fontSize:9,color:'#0F2744',fontWeight:700,marginLeft:3}}>✓✓</span>;
  return <span style={{fontSize:9,color:'#9ca3af',marginLeft:3}}>✓✓</span>;
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function ChatPanel({
  tenantId, loggedUser, userRole='editor', isViewer=false, onClose, embedded=false,
}: ChatPanelProps) {
  const isAdmin = userRole === 'local_admin' || userRole === 'global_admin';
  const NAVY = '#0F2744';

  const [channel,      setChannel]      = useState<string>('team');
  const [messages,     setMessages]     = useState<ChatMessage[]>([]);
  const [users,        setUsers]        = useState<ChatUser[]>([]);
  const [input,        setInput]        = useState('');
  const [sending,      setSending]      = useState(false);
  const [unread,       setUnread]       = useState<Record<string,number>>({});
  const [dmSearch,     setDmSearch]     = useState('');
  const [showDMSearch, setShowDMSearch] = useState(false);
  const [openedDMs,    setOpenedDMs]    = useState<Set<string>>(new Set());
  const [hoveredMsg,   setHoveredMsg]   = useState<string|null>(null);
  const [deleting,     setDeleting]     = useState<string|null>(null);

  const bottomRef   = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLTextAreaElement>(null);
  const dmSearchRef = useRef<HTMLInputElement>(null);
  const channelRef  = useRef<string>('team');
  const openRef     = useRef<boolean>(true); // always "open" since embedded
  channelRef.current = channel;
  openRef.current    = true;

  const totalUnread = Object.values(unread).reduce((a,b)=>a+b,0);

  // ── Load users ─────────────────────────────────────────────────────────────
  const loadUsers = useCallback(async () => {
    if (!tenantId) return;
    // For global admin: also load local_admins from other tenants for cross-tenant messaging
    const isGlobalAdmin = userRole === 'global_admin';

    if (isGlobalAdmin) {
      // Own tenant members (all active users)
      const { data: ownUsers } = await supabase.from('tenant_users')
        .select('username, full_name, role, tenant_id')
        .eq('active', true).eq('tenant_id', tenantId).order('full_name');

      // Local admins from other tenants
      const { data: otherAdmins } = await supabase.from('tenant_users')
        .select('username, full_name, role, tenant_id')
        .eq('active', true).eq('role', 'local_admin')
        .neq('tenant_id', tenantId).order('full_name');

      const combined = [...(ownUsers||[]), ...(otherAdmins||[])];
      setUsers(combined.filter(u => u.username !== loggedUser) as ChatUser[]);
    } else {
      // Regular users — only see members of own tenant
      const { data } = await supabase.from('tenant_users')
        .select('username, full_name, role')
        .eq('active', true).eq('tenant_id', tenantId).order('full_name');
      if (data) setUsers((data as ChatUser[]).filter(u => u.username !== loggedUser));
    }
  }, [tenantId, loggedUser, userRole]);

  // ── Load messages ───────────────────────────────────────────────────────────
  const loadMessages = useCallback(async (ch: string) => {
    if (!tenantId) return;
    const { data } = await supabase.from('chat_messages')
      .select('*').eq('tenant_id', tenantId).eq('channel', ch)
      .order('created_at', { ascending: true }).limit(300);
    if (data) setMessages(data as ChatMessage[]);
  }, [tenantId]);

  // ── Mark read ───────────────────────────────────────────────────────────────
  const markRead = useCallback(async (ch: string) => {
    if (!tenantId) return;
    const { data } = await supabase.from('chat_messages')
      .select('id, read_by').eq('tenant_id', tenantId)
      .eq('channel', ch).neq('sender', loggedUser);
    if (!data) return;
    const toUpdate = (data as any[]).filter(m => !(m.read_by||[]).includes(loggedUser));
    if (!toUpdate.length) return;
    await Promise.all(toUpdate.map(m =>
      supabase.from('chat_messages')
        .update({ read_by: [...(m.read_by||[]), loggedUser] }).eq('id', m.id)
    ));
    setUnread(p => ({ ...p, [ch]: 0 }));
  }, [tenantId, loggedUser]);

  // ── Count unread ────────────────────────────────────────────────────────────
  const countUnread = useCallback(async () => {
    if (!tenantId) return;
    const { data } = await supabase.from('chat_messages')
      .select('channel, read_by').eq('tenant_id', tenantId).neq('sender', loggedUser);
    if (!data) return;
    const counts: Record<string,number> = {};
    for (const msg of data as any[]) {
      if (!(msg.read_by||[]).includes(loggedUser))
        counts[msg.channel] = (counts[msg.channel]||0) + 1;
    }
    setUnread(counts);
  }, [tenantId, loggedUser]);

  // ── Realtime — INSERT + DELETE ──────────────────────────────────────────────
  useEffect(() => {
    if (!tenantId) return;
    loadUsers(); countUnread();
    const sub = supabase.channel(`chat_rt_${tenantId}`)
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'chat_messages',
        filter:`tenant_id=eq.${tenantId}` }, (payload: any) => {
        const msg = payload.new as ChatMessage;
        if (msg.sender === loggedUser) return;
        if (msg.channel === channelRef.current) {
          setMessages(p => [...p, msg]);
          markRead(msg.channel);
        } else {
          setUnread(p => ({ ...p, [msg.channel]: (p[msg.channel]||0)+1 }));
        }
      })
      .on('postgres_changes', { event:'DELETE', schema:'public', table:'chat_messages',
        filter:`tenant_id=eq.${tenantId}` }, (payload: any) => {
        const id = payload.old?.id;
        if (id) setMessages(p => p.filter(m => m.id !== id));
      })
      .subscribe();
    return () => { sub.unsubscribe(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  // ── Reload + markRead on channel change ─────────────────────────────────────
  useEffect(() => { loadMessages(channel); markRead(channel); }, [channel]); // eslint-disable-line

  // ── Scroll on new messages ──────────────────────────────────────────────────
  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:'smooth' }), 40);
  }, [messages.length]);

  // ── Focus ───────────────────────────────────────────────────────────────────
  useEffect(() => { inputRef.current?.focus(); }, [channel]);
  useEffect(() => { if (showDMSearch) setTimeout(() => dmSearchRef.current?.focus(), 50); }, [showDMSearch]);

  // ── Send ────────────────────────────────────────────────────────────────────
  const send = async () => {
    const text = input.trim();
    if (!text || sending || isViewer || (channel==='broadcast' && !isAdmin)) return;
    setSending(true); setInput('');

    // For cross-tenant DMs (global admin → local admin of another tenant),
    // store the message under the RECIPIENT's tenantId so their Realtime
    // subscription (filtered on their tenant_id) picks it up.
    const dmTargetUser = dmTarget ? users.find(u => u.username === dmTarget) : null;
    const effectiveTenantId = (dmTargetUser?.tenant_id && dmTargetUser.tenant_id !== tenantId)
      ? dmTargetUser.tenant_id : tenantId;

    const now = new Date().toISOString();
    const opt: ChatMessage = {
      id:`opt_${now}`, tenant_id:effectiveTenantId, sender:loggedUser, channel,
      message:text, is_broadcast:channel==='broadcast', read_by:[loggedUser], created_at:now,
    };
    setMessages(p => [...p, opt]);
    const { data, error } = await supabase.from('chat_messages').insert({
      tenant_id:effectiveTenantId, sender:loggedUser, channel,
      message:text, is_broadcast:channel==='broadcast', read_by:[loggedUser],
    }).select().single();
    if (error) { setMessages(p => p.filter(m => m.id !== opt.id)); }
    else if (data) { setMessages(p => p.map(m => m.id===opt.id ? data as ChatMessage : m)); }
    setSending(false); inputRef.current?.focus();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const deleteMessage = async (id: string) => {
    if (id.startsWith('opt_') || deleting) return;
    setDeleting(id);
    setMessages(p => p.filter(m => m.id !== id));
    const { error } = await supabase.from('chat_messages').delete().eq('id', id);
    if (error) { loadMessages(channel); }
    setDeleting(null);
  };

  // ── DM helpers ──────────────────────────────────────────────────────────────
  const dmTarget = channel.startsWith('dm::')
    ? channel.split('::').find(u => u !== loggedUser) : null;
  const dmUser   = dmTarget ? users.find(u => u.username === dmTarget) : null;
  const openDM   = (username: string) => {
    const key = 'dm::'+dmKey(loggedUser, username);
    setOpenedDMs(s => new Set([...s, key]));
    setChannel(key); setShowDMSearch(false); setDmSearch('');
  };
  const dmFiltered = dmSearch.trim()
    ? users.filter(u => (u.full_name||u.username).toLowerCase().includes(dmSearch.toLowerCase()))
    : users;
  const activeDMs = users.filter(u => {
    const key = 'dm::'+dmKey(loggedUser, u.username);
    return unread[key]>0 || channel===key || openedDMs.has(key);
  });

  // ── Permissions ─────────────────────────────────────────────────────────────
  const canSend = !isViewer && (channel!=='broadcast' || isAdmin);

  // ── Header label ────────────────────────────────────────────────────────────
  const headerTitle = channel==='team' ? '💬 Team Chat'
    : channel==='broadcast' ? '📢 Broadcast'
    : `💬 ${dmUser?.full_name||dmTarget}`;

  // ── RENDER ──────────────────────────────────────────────────────────────────
  const panelStyle: React.CSSProperties = embedded
    ? { display:'flex', flexDirection:'column', height:'100%', background:'white',
        fontFamily:'system-ui,sans-serif', overflow:'hidden' }
    : { display:'flex', flexDirection:'column', height:'100%', background:'white',
        fontFamily:'system-ui,sans-serif', overflow:'hidden' };

  return (
    <div style={panelStyle}>

      {/* ── Header ── */}
      <div style={{ background:NAVY, padding:'8px 12px', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
          <span style={{ fontSize:12, fontWeight:700, color:'white' }}>{headerTitle}</span>
          {onClose && (
            <button onClick={onClose}
              style={{ background:'none', border:'none', color:'rgba(255,255,255,0.6)',
                fontSize:16, cursor:'pointer', lineHeight:1, padding:'2px 6px' }}>×</button>
          )}
        </div>
        {/* Tab bar */}
        <div style={{ display:'flex', alignItems:'center', overflowX:'auto' }}>
          {(['team','broadcast'] as const).map(ch => {
            const cnt   = unread[ch]||0;
            const label = ch==='team' ? '# Team' : '📢';
            const active = channel===ch;
            return (
              <button key={ch} onClick={()=>setChannel(ch)}
                style={{ padding:'3px 10px', border:'none', cursor:'pointer',
                  fontSize:10, fontWeight:active?700:400,
                  color:active?'white':'rgba(255,255,255,0.5)',
                  background:'transparent', whiteSpace:'nowrap', flexShrink:0,
                  borderBottom:active?'2px solid white':'2px solid transparent' }}>
                {label}
                {cnt>0 && <span style={{ marginLeft:3, background:'#dc2626', color:'white',
                  fontSize:8, fontWeight:700, padding:'0 3px', borderRadius:99 }}>{cnt}</span>}
              </button>
            );
          })}
          {activeDMs.map(u => {
            const key = 'dm::'+dmKey(loggedUser, u.username);
            const cnt = unread[key]||0; const active = channel===key;
            return (
              <button key={key}
                onClick={()=>{ setOpenedDMs(s=>new Set([...s,key])); setChannel(key); }}
                style={{ padding:'3px 9px', border:'none', cursor:'pointer',
                  fontSize:10, fontWeight:active?700:400,
                  color:active?'white':'rgba(255,255,255,0.5)',
                  background:'transparent', whiteSpace:'nowrap', flexShrink:0,
                  borderBottom:active?'2px solid white':'2px solid transparent' }}>
                {u.username}
                {cnt>0 && <span style={{ marginLeft:3, background:'#dc2626', color:'white',
                  fontSize:8, fontWeight:700, padding:'0 3px', borderRadius:99 }}>{cnt}</span>}
              </button>
            );
          })}
          <button onClick={()=>{ setShowDMSearch(s=>!s); setDmSearch(''); }}
            title="New direct message"
            style={{ padding:'3px 8px', border:'none', cursor:'pointer',
              fontSize:13, color:showDMSearch?'white':'rgba(255,255,255,0.4)',
              background:'transparent', flexShrink:0, marginLeft:'auto',
              borderBottom:showDMSearch?'2px solid white':'2px solid transparent' }}>
            ＋
          </button>
        </div>
      </div>

      {/* ── Always-visible search bar ── */}
      <div style={{ padding:'6px 10px', background:'#f1f5f9', borderBottom:'1px solid #e2e8f0', flexShrink:0 }}>
        <input
          ref={dmSearchRef}
          value={dmSearch}
          onChange={e => { setDmSearch(e.target.value); setShowDMSearch(true); }}
          onFocus={() => setShowDMSearch(true)}
          placeholder="Search users to message…"
          style={{ width:'100%', boxSizing:'border-box', border:'1px solid #e2e8f0',
            borderRadius:6, padding:'5px 10px', fontSize:11, color:'#374151',
            outline:'none', fontFamily:'system-ui', background:'white' }}
        />
      </div>

      {/* ── DM search results ── */}
      {showDMSearch && dmSearch.trim() && (
        <div style={{ background:'white', borderBottom:'1px solid #f1f5f9', maxHeight:160, overflowY:'auto', flexShrink:0 }}>
          {dmFiltered.length===0
            ? <div style={{ padding:'8px 12px', fontSize:11, color:'#94a3b8' }}>No users found</div>
            : dmFiltered.map(u => (
              <button key={u.username} onClick={() => openDM(u.username)}
                style={{ width:'100%', display:'block', padding:'7px 12px', border:'none',
                  background:'transparent', cursor:'pointer', textAlign:'left',
                  fontSize:12, color:'#1e293b', fontWeight:500 }}
                onMouseEnter={e=>(e.currentTarget.style.background='#f1f5f9')}
                onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                {u.full_name||u.username}
              </button>
            ))
          }
        </div>
      )}

      {/* ── Broadcast read-only notice ── */}
      {channel==='broadcast' && !isAdmin && (
        <div style={{ background:'#f8fafc', borderBottom:'1px solid #f1f5f9',
          padding:'5px 12px', fontSize:10, color:'#64748b', flexShrink:0 }}>
          {isViewer ? '👁 Read only for viewers.' : '📢 Only admins can send broadcasts.'}
        </div>
      )}

      {/* ── Messages ── */}
      <div style={{ flex:1, overflowY:'auto', padding:'8px 12px',
        display:'flex', flexDirection:'column', gap:1 }}>
        {messages.length===0 && (
          <div style={{ flex:1, display:'flex', flexDirection:'column',
            alignItems:'center', justifyContent:'center', color:'#94a3b8', gap:8 }}>
            <div style={{ fontSize:28 }}>{channel==='broadcast'?'📢':'💬'}</div>
            <div style={{ fontSize:11, textAlign:'center', lineHeight:1.6 }}>
              {channel==='team'&&'No messages yet. Say hi to your team!'}
              {channel==='broadcast'&&(isAdmin?'Send a broadcast to all users.':'No announcements yet.')}
              {channel.startsWith('dm::')&&`Start a conversation with ${dmTarget}.`}
            </div>
          </div>
        )}
        {messages.map((m, i) => {
          const isMe        = m.sender === loggedUser;
          const isOptimistic = m.id.startsWith('opt_');
          const isHovered   = hoveredMsg === m.id;
          const prevMsg     = messages[i-1];
          const showSender  = !isMe && (
            i===0 || prevMsg.sender!==m.sender || prevMsg.is_broadcast!==m.is_broadcast
          );
          const senderInTenant = m.sender === loggedUser || users.some(u => u.username === m.sender);
          const displayName = m.is_broadcast
            ? `📢 ${m.sender}`
            : senderInTenant ? m.sender : `${m.sender} (removed)`;

          return (
            <div key={m.id}
              onMouseEnter={()=>setHoveredMsg(m.id)}
              onMouseLeave={()=>setHoveredMsg(null)}
              style={{ display:'flex', flexDirection:'column',
                alignItems:isMe?'flex-end':'flex-start',
                marginBottom:3, opacity:isOptimistic?0.6:1 }}>

              {showSender && (
                <div style={{ display:'flex', alignItems:'center', gap:4,
                  marginBottom:2, marginLeft:2 }}>
                  <Avatar name={m.sender} size={16}/>
                  <span style={{ fontSize:10, fontWeight:600,
                    color: senderInTenant ? '#374151' : '#94a3b8',
                    fontStyle: senderInTenant ? 'normal' : 'italic' }}>
                    {displayName}
                  </span>
                </div>
              )}

              <div style={{ display:'flex', alignItems:'flex-end',
                gap:5, flexDirection:isMe?'row-reverse':'row' }}>
                {isMe && isHovered && !isOptimistic && (
                  <button onClick={()=>deleteMessage(m.id)} title="Delete"
                    style={{ background:'none', border:'none', cursor:'pointer',
                      color:'#94a3b8', fontSize:11, padding:'1px 3px',
                      borderRadius:3, opacity:deleting===m.id?0.4:1 }}>
                    🗑
                  </button>
                )}
                {/* No bubble background — plain text aligned left/right */}
                <div style={{ maxWidth:'78%', fontSize:12, lineHeight:1.5,
                  color:isMe?NAVY:'#1e293b', wordBreak:'break-word',
                  fontWeight:isMe?500:400 }}>
                  {m.message}
                </div>
              </div>

              <div style={{ display:'flex', alignItems:'center', gap:2,
                fontSize:9, color:'#94a3b8', margin:'1px 2px' }}>
                {fmtTime(m.created_at)}
                {isMe && <Ticks msg={m} loggedUser={loggedUser}/>}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef}/>
      </div>

      {/* ── Input ── */}
      {canSend ? (
        <div style={{ padding:'8px 10px', borderTop:'1px solid #f1f5f9',
          display:'flex', gap:8, alignItems:'flex-end', flexShrink:0, background:'white' }}>
          <textarea ref={inputRef} value={input}
            onChange={e=>setInput(e.target.value)} onKeyDown={onKey}
            placeholder={channel==='broadcast'?'Broadcast to all users…'
              :channel==='team'?'Message team…':`Message ${dmTarget}…`}
            rows={1}
            style={{ flex:1, border:'1px solid #e2e8f0', borderRadius:8,
              padding:'7px 10px', fontSize:12, color:'#374151', resize:'none',
              outline:'none', lineHeight:1.5, maxHeight:80, overflowY:'auto',
              fontFamily:'system-ui' }}
          />
          <button onClick={send} disabled={!input.trim()||sending}
            style={{ height:34, padding:'0 14px', borderRadius:8, border:'none',
              background:input.trim()?NAVY:'#e2e8f0',
              color:input.trim()?'white':'#94a3b8',
              fontSize:11, fontWeight:700, cursor:input.trim()?'pointer':'default',
              display:'flex', alignItems:'center', gap:5,
              whiteSpace:'nowrap', flexShrink:0, transition:'background 0.15s' }}>
            <span style={{fontSize:12}}>&#10148;</span> Send
          </button>
        </div>
      ) : (
        <div style={{ padding:'8px 12px', borderTop:'1px solid #f1f5f9',
          fontSize:11, color:'#94a3b8', textAlign:'center' }}>
          {isViewer?'👁 View only — viewers cannot send':'📢 Only admins can broadcast'}
        </div>
      )}
    </div>
  );
}
