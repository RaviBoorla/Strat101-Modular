import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface ChatMessage {
  id: string; tenant_id: string; sender: string;
  channel: string; message: string; is_broadcast: boolean;
  read_by: string[]; created_at: string;
}
interface ChatUser { username: string; full_name: string; role: string; }
interface ChatPanelProps {
  tenantId: string; loggedUser: string;
  userRole?: string; isViewer?: boolean;
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
function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', background:avatarColor(name),
      color:'white', display:'flex', alignItems:'center', justifyContent:'center',
      fontSize:size*0.38, fontWeight:600, flexShrink:0, fontFamily:'system-ui' }}>
      {name.slice(0,2).toUpperCase()}
    </div>
  );
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────
export default function ChatPanel({ tenantId, loggedUser, userRole='editor', isViewer=false }: ChatPanelProps) {
  const isAdmin = userRole === 'local_admin' || userRole === 'global_admin';

  // ── State ──────────────────────────────────────────────────────────────────
  const [open,        setOpen]        = useState(false);
  const [channel,     setChannel]     = useState<string>('team');
  const [messages,    setMessages]    = useState<ChatMessage[]>([]);
  const [users,       setUsers]       = useState<ChatUser[]>([]);
  const [input,       setInput]       = useState('');
  const [sending,     setSending]     = useState(false);
  const [unread,      setUnread]      = useState<Record<string,number>>({});
  const [dmSearch,    setDmSearch]    = useState('');        // search text for DM picker
  const [showDMSearch, setShowDMSearch] = useState(false);  // show DM search panel
  const [openedDMs,   setOpenedDMs]   = useState<Set<string>>(new Set());
  const [hoveredMsg,  setHoveredMsg]  = useState<string|null>(null); // id of hovered msg
  const [deleting,    setDeleting]    = useState<string|null>(null);

  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLTextAreaElement>(null);
  const dmSearchRef = useRef<HTMLInputElement>(null);

  // Refs for Realtime closure — always current without re-subscribing
  const channelRef  = useRef<string>('team');
  const openRef     = useRef<boolean>(false);
  channelRef.current = channel;
  openRef.current    = open;

  const totalUnread = Object.values(unread).reduce((a,b)=>a+b,0);

  // ── Load users ─────────────────────────────────────────────────────────────
  const loadUsers = useCallback(async () => {
    const { data } = await supabase.from('tenant_users')
      .select('username, full_name, role').eq('active', true).order('full_name');
    if (data) setUsers((data as ChatUser[]).filter(u => u.username !== loggedUser));
  }, [loggedUser]);

  // ── Load messages for a channel ────────────────────────────────────────────
  const loadMessages = useCallback(async (ch: string) => {
    if (!tenantId) return;
    const { data, error } = await supabase.from('chat_messages')
      .select('*').eq('tenant_id', tenantId).eq('channel', ch)
      .order('created_at', { ascending: true }).limit(300);
    if (error) console.error('[chat] load error:', error);
    if (data) setMessages(data as ChatMessage[]);
  }, [tenantId]);

  // ── Mark channel read — called once on open/channel-switch, not on every msg ─
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
        .update({ read_by: [...(m.read_by||[]), loggedUser] })
        .eq('id', m.id)
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

  // ── Realtime: INSERT + DELETE — mounted once per tenantId ──────────────────
  useEffect(() => {
    if (!tenantId) return;
    loadUsers();
    countUnread();

    const sub = supabase.channel(`chat_rt_${tenantId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'chat_messages',
        filter: `tenant_id=eq.${tenantId}`,
      }, (payload: any) => {
        const msg = payload.new as ChatMessage;
        if (msg.sender === loggedUser) return; // already optimistic
        if (msg.channel === channelRef.current && openRef.current) {
          setMessages(p => [...p, msg]);
          markRead(msg.channel);
        } else {
          setUnread(p => ({ ...p, [msg.channel]: (p[msg.channel]||0)+1 }));
        }
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'chat_messages',
        filter: `tenant_id=eq.${tenantId}`,
      }, (payload: any) => {
        const id = payload.old?.id;
        if (id) setMessages(p => p.filter(m => m.id !== id));
      })
      .subscribe();

    return () => { sub.unsubscribe(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  // ── Reload + markRead when channel changes ─────────────────────────────────
  useEffect(() => {
    loadMessages(channel);
    if (open) markRead(channel);
  }, [channel]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── markRead when panel opens (not on every message) ──────────────────────
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) markRead(channel);
    prevOpenRef.current = open;
    if (open) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:'smooth' }), 60);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scroll to bottom on new messages (only if open) ───────────────────────
  useEffect(() => {
    if (open) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:'smooth' }), 30);
  }, [messages.length, open]);

  // ── Focus input when panel opens or channel switches ──────────────────────
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open, channel]);

  // ── Focus DM search when opened ───────────────────────────────────────────
  useEffect(() => {
    if (showDMSearch) setTimeout(() => dmSearchRef.current?.focus(), 50);
  }, [showDMSearch]);

  // ── Send ───────────────────────────────────────────────────────────────────
  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    if (channel === 'broadcast' && !isAdmin) return;
    if (isViewer) return;

    setSending(true);
    setInput('');

    const now = new Date().toISOString();
    const optimistic: ChatMessage = {
      id: `opt_${now}`, tenant_id: tenantId, sender: loggedUser,
      channel, message: text,
      is_broadcast: channel === 'broadcast',
      read_by: [loggedUser], created_at: now,
    };

    setMessages(p => [...p, optimistic]);

    const { data, error } = await supabase.from('chat_messages').insert({
      tenant_id: tenantId, sender: loggedUser, channel,
      message: text, is_broadcast: channel === 'broadcast',
      read_by: [loggedUser],
    }).select().single();

    if (error) {
      console.error('[chat] send error:', error);
      setMessages(p => p.filter(m => m.id !== optimistic.id));
    } else if (data) {
      setMessages(p => p.map(m => m.id === optimistic.id ? data as ChatMessage : m));
    }

    setSending(false);
    inputRef.current?.focus();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  // ── Delete own message ─────────────────────────────────────────────────────
  const deleteMessage = async (id: string) => {
    if (id.startsWith('opt_')) return; // can't delete optimistic
    setDeleting(id);
    setMessages(p => p.filter(m => m.id !== id)); // optimistic remove
    const { error } = await supabase.from('chat_messages').delete().eq('id', id);
    if (error) {
      console.error('[chat] delete error:', error);
      loadMessages(channel); // reload to restore if failed
    }
    setDeleting(null);
  };

  // ── DM helpers ─────────────────────────────────────────────────────────────
  const dmTarget = channel.startsWith('dm::')
    ? channel.split('::').find(u => u !== loggedUser) : null;
  const dmUser   = dmTarget ? users.find(u => u.username === dmTarget) : null;

  const openDM = (username: string) => {
    const key = 'dm::' + dmKey(loggedUser, username);
    setOpenedDMs(s => new Set([...s, key]));
    setChannel(key);
    setShowDMSearch(false);
    setDmSearch('');
  };

  // DM search filter — only names, exact substring match case-insensitive
  const dmFiltered = dmSearch.trim()
    ? users.filter(u =>
        (u.full_name||u.username).toLowerCase().includes(dmSearch.toLowerCase())
      )
    : users;

  // Tabs: Team, Broadcast, then active DMs
  const activeDMs = users.filter(u => {
    const key = 'dm::' + dmKey(loggedUser, u.username);
    return unread[key] > 0 || channel === key || openedDMs.has(key);
  });

  // ── Permissions ────────────────────────────────────────────────────────────
  const canSend = channel === 'broadcast' ? isAdmin
    : !isViewer;

  // ── Labels ─────────────────────────────────────────────────────────────────
  const headerTitle =
    channel === 'team'      ? '💬 Team Chat' :
    channel === 'broadcast' ? '📢 Broadcast' :
    `💬 ${dmUser?.full_name || dmTarget}`;

  const headerSub =
    channel === 'team'      ? 'All team members' :
    channel === 'broadcast' ? (isAdmin ? 'Send to all users' : 'Announcements — read only') :
    `@${dmTarget}`;

  const NAVY = '#0F2744';

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Floating trigger ── */}
      <button onClick={() => setOpen(o => !o)} title="Team Chat"
        style={{ position:'fixed', bottom:60, right:20, zIndex:200,
          width:48, height:48, borderRadius:24, background:NAVY, border:'none',
          cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
          boxShadow:'0 4px 16px rgba(15,39,68,0.4)', transition:'transform 0.15s' }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.08)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
        <span style={{ fontSize:20 }}>💬</span>
        {totalUnread > 0 && !open && (
          <div style={{ position:'absolute', top:-2, right:-2, background:'#dc2626',
            color:'white', width:18, height:18, borderRadius:9,
            fontSize:10, fontWeight:700,
            display:'flex', alignItems:'center', justifyContent:'center' }}>
            {totalUnread > 9 ? '9+' : totalUnread}
          </div>
        )}
      </button>

      {/* ── Chat window ── */}
      {open && (
        <div style={{ position:'fixed', bottom:116, right:20, zIndex:200,
          width:'min(380px, calc(100vw - 32px))',
          height:'min(378px, calc(100vh - 160px))',
          background:'white', borderRadius:16,
          border:'1px solid #e2e8f0',
          boxShadow:'0 8px 40px rgba(0,0,0,0.18)',
          display:'flex', flexDirection:'column', overflow:'hidden',
          fontFamily:'system-ui,sans-serif' }}>

          {/* Header */}
          <div style={{ background:NAVY, padding:'10px 14px',
            display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'white',
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {headerTitle}
              </div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.5)', marginTop:1 }}>
                {headerSub}
              </div>
            </div>
            <button onClick={() => setOpen(false)}
              style={{ background:'none', border:'none',
                color:'rgba(255,255,255,0.6)', fontSize:18,
                cursor:'pointer', lineHeight:1, padding:'2px 6px', flexShrink:0 }}>
              ×
            </button>
          </div>

          {/* ── Tab bar: Team | Broadcast | [DMs] | + ── */}
          <div style={{ display:'flex', alignItems:'stretch',
            borderBottom:'1px solid #f1f5f9', background:'#f8fafc',
            flexShrink:0, overflowX:'auto' }}>

            {/* Fixed tabs */}
            {(['team','broadcast'] as const).map(ch => {
              const label  = ch === 'team' ? '# Team' : '📢';
              const cnt    = unread[ch] || 0;
              const active = channel === ch;
              return (
                <button key={ch} onClick={() => setChannel(ch)}
                  style={{ padding:'7px 11px', border:'none', cursor:'pointer',
                    fontSize:11, fontWeight:active ? 700 : 400,
                    color: active ? NAVY : '#64748b',
                    background:'transparent', whiteSpace:'nowrap', flexShrink:0,
                    borderBottom: active ? `2px solid ${NAVY}` : '2px solid transparent' }}>
                  {label}
                  {cnt > 0 && (
                    <span style={{ marginLeft:4, background:'#dc2626', color:'white',
                      fontSize:9, fontWeight:700, padding:'0 4px', borderRadius:99 }}>
                      {cnt}
                    </span>
                  )}
                </button>
              );
            })}

            {/* DM tabs — inline with Team/Broadcast */}
            {activeDMs.map(u => {
              const key    = 'dm::' + dmKey(loggedUser, u.username);
              const cnt    = unread[key] || 0;
              const active = channel === key;
              return (
                <button key={key}
                  onClick={() => { setOpenedDMs(s => new Set([...s, key])); setChannel(key); }}
                  style={{ padding:'7px 10px', border:'none', cursor:'pointer',
                    fontSize:11, fontWeight:active ? 700 : 400,
                    color: active ? NAVY : '#64748b',
                    background:'transparent', whiteSpace:'nowrap', flexShrink:0,
                    borderBottom: active ? `2px solid ${NAVY}` : '2px solid transparent' }}>
                  {u.username}
                  {cnt > 0 && (
                    <span style={{ marginLeft:4, background:'#dc2626', color:'white',
                      fontSize:9, fontWeight:700, padding:'0 4px', borderRadius:99 }}>
                      {cnt}
                    </span>
                  )}
                </button>
              );
            })}

            {/* + button to open DM search */}
            <button onClick={() => { setShowDMSearch(s => !s); setDmSearch(''); }}
              title="New direct message"
              style={{ padding:'7px 10px', border:'none', cursor:'pointer',
                fontSize:14, color: showDMSearch ? NAVY : '#94a3b8',
                background:'transparent', flexShrink:0, marginLeft:'auto',
                borderBottom: showDMSearch ? `2px solid ${NAVY}` : '2px solid transparent' }}>
              ＋
            </button>
          </div>

          {/* ── DM search panel — shows names only, character-by-character ── */}
          {showDMSearch && (
            <div style={{ background:'white', borderBottom:'1px solid #f1f5f9',
              flexShrink:0 }}>
              <div style={{ padding:'6px 10px' }}>
                <input
                  ref={dmSearchRef}
                  value={dmSearch}
                  onChange={e => setDmSearch(e.target.value)}
                  placeholder="Search by name…"
                  style={{ width:'100%', boxSizing:'border-box',
                    border:'1px solid #e2e8f0', borderRadius:8,
                    padding:'6px 10px', fontSize:12, color:'#374151',
                    outline:'none', fontFamily:'system-ui' }}
                />
              </div>
              <div style={{ maxHeight:140, overflowY:'auto' }}>
                {dmFiltered.length === 0 && (
                  <div style={{ padding:'8px 14px', fontSize:12, color:'#94a3b8' }}>
                    No users found
                  </div>
                )}
                {dmFiltered.map(u => (
                  <button key={u.username} onClick={() => openDM(u.username)}
                    style={{ width:'100%', display:'block', padding:'8px 14px',
                      border:'none', background:'transparent', cursor:'pointer',
                      textAlign:'left', fontSize:13, color:'#1e293b',
                      fontWeight:500 }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    {u.full_name || u.username}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Broadcast read-only notice ── */}
          {channel === 'broadcast' && !isAdmin && (
            <div style={{ background:'#f8fafc', borderBottom:'1px solid #f1f5f9',
              padding:'5px 14px', fontSize:11, color:'#64748b', flexShrink:0 }}>
              {isViewer ? '👁 Read only for viewers.' : '📢 Only admins can send broadcasts.'}
            </div>
          )}

          {/* ── Messages ── */}
          <div style={{ flex:1, overflowY:'auto', padding:'10px 12px',
            display:'flex', flexDirection:'column', gap:2 }}>
            {messages.length === 0 && (
              <div style={{ flex:1, display:'flex', flexDirection:'column',
                alignItems:'center', justifyContent:'center',
                color:'#94a3b8', gap:8 }}>
                <div style={{ fontSize:32 }}>
                  {channel === 'broadcast' ? '📢' : '💬'}
                </div>
                <div style={{ fontSize:12, textAlign:'center', lineHeight:1.6 }}>
                  {channel === 'team'      && 'No messages yet. Say hi to your team!'}
                  {channel === 'broadcast' && (isAdmin
                    ? 'No announcements yet.'
                    : 'No announcements from your admin yet.')}
                  {channel.startsWith('dm::') && `Start a conversation with ${dmTarget}.`}
                </div>
              </div>
            )}

            {messages.map((m, i) => {
              const isMe         = m.sender === loggedUser;
              const isOptimistic = m.id.startsWith('opt_');
              const showSender   = !isMe && (i === 0 || messages[i-1].sender !== m.sender);
              // Broadcast: show sender name prefixed with 📢 but same bubble style
              const displayName  = m.is_broadcast ? `📢 ${m.sender}` : m.sender;
              const showThisSender = !isMe && (
                i === 0 ||
                messages[i-1].sender !== m.sender ||
                messages[i-1].is_broadcast !== m.is_broadcast
              );
              const isHovered    = hoveredMsg === m.id;

              return (
                <div key={m.id}
                  onMouseEnter={() => setHoveredMsg(m.id)}
                  onMouseLeave={() => setHoveredMsg(null)}
                  style={{ display:'flex', flexDirection:'column',
                    alignItems: isMe ? 'flex-end' : 'flex-start',
                    marginBottom:2, opacity: isOptimistic ? 0.6 : 1,
                    position:'relative' }}>

                  {showThisSender && (
                    <div style={{ display:'flex', alignItems:'center', gap:5,
                      marginBottom:3, marginLeft: isMe ? 0 : 2 }}>
                      {!isMe && <Avatar name={m.sender} size={18}/>}
                      <span style={{ fontSize:11, fontWeight:600, color:'#374151' }}>
                        {displayName}
                      </span>
                    </div>
                  )}

                  <div style={{ display:'flex', alignItems:'flex-end',
                    gap:6, flexDirection: isMe ? 'row-reverse' : 'row' }}>

                    {/* Delete button — own messages only, on hover */}
                    {isMe && isHovered && !isOptimistic && (
                      <button
                        onClick={() => deleteMessage(m.id)}
                        disabled={deleting === m.id}
                        title="Delete message"
                        style={{ background:'none', border:'none', cursor:'pointer',
                          color:'#94a3b8', fontSize:12, padding:'2px 4px',
                          borderRadius:4, flexShrink:0, lineHeight:1,
                          opacity: deleting === m.id ? 0.4 : 1 }}>
                        🗑
                      </button>
                    )}

                    <div style={{ maxWidth:'76%', padding:'7px 11px',
                      borderRadius:12,
                      borderBottomRightRadius: isMe ? 3 : 12,
                      borderBottomLeftRadius:  isMe ? 12 : 3,
                      background: isMe ? NAVY : '#f1f5f9',
                      color: isMe ? 'white' : '#1e293b',
                      fontSize:12, lineHeight:1.5, wordBreak:'break-word' }}>
                      {m.message}
                    </div>
                  </div>

                  <div style={{ fontSize:9, color:'#94a3b8', margin:'2px 4px' }}>
                    {fmtTime(m.created_at)}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef}/>
          </div>

          {/* ── Input ── */}
          {canSend ? (
            <div style={{ padding:'8px 10px', borderTop:'1px solid #f1f5f9',
              display:'flex', gap:8, alignItems:'flex-end', flexShrink:0 }}>
              <textarea ref={inputRef} value={input}
                onChange={e => setInput(e.target.value)} onKeyDown={onKey}
                placeholder={
                  channel === 'broadcast' ? 'Broadcast to all users…' :
                  channel === 'team'      ? 'Message team…' :
                                            `Message ${dmTarget}…`
                }
                rows={1}
                style={{ flex:1, border:'1px solid #e2e8f0',
                  borderRadius:10, padding:'8px 12px', fontSize:12,
                  color:'#374151', resize:'none', outline:'none',
                  lineHeight:1.5, maxHeight:80, overflowY:'auto',
                  fontFamily:'system-ui' }}
              />
              <button onClick={send} disabled={!input.trim() || sending}
                style={{ width:34, height:34, borderRadius:10, border:'none',
                  flexShrink:0,
                  background: input.trim() ? NAVY : '#e2e8f0',
                  color: input.trim() ? 'white' : '#94a3b8',
                  fontSize:14, cursor: input.trim() ? 'pointer' : 'default',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  transition:'background 0.15s' }}>
                ↑
              </button>
            </div>
          ) : (
            <div style={{ padding:'8px 14px', borderTop:'1px solid #f1f5f9',
              fontSize:11, color:'#94a3b8', textAlign:'center', lineHeight:1.5 }}>
              {isViewer
                ? '👁 View only — viewers cannot send messages'
                : '📢 Only admins can send broadcasts'}
            </div>
          )}
        </div>
      )}
    </>
  );
}
