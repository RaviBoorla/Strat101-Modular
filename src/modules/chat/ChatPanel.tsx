import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

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
    <div style={{
      width: size, height: size, borderRadius: '50%', background: avatarColor(name),
      color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 600, flexShrink: 0, fontFamily: 'system-ui',
    }}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

export default function ChatPanel({ tenantId, loggedUser, userRole = 'editor', isViewer = false }: ChatPanelProps) {
  const isAdmin = userRole === 'local_admin' || userRole === 'global_admin';

  const [open,       setOpen]       = useState(false);
  const [channel,    setChannel]    = useState<string>('team');
  const [messages,   setMessages]   = useState<ChatMessage[]>([]);
  const [users,      setUsers]      = useState<ChatUser[]>([]);
  const [input,      setInput]      = useState('');
  const [sending,    setSending]    = useState(false);
  const [unread,     setUnread]     = useState<Record<string, number>>({});
  const [showDMList, setShowDMList] = useState(false);

  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLTextAreaElement>(null);
  const channelRef = useRef<string>('team');
  channelRef.current = channel;

  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0);

  const loadUsers = useCallback(async () => {
    const { data } = await supabase.from('tenant_users')
      .select('username, full_name, role').eq('active', true).order('username');
    if (data) setUsers((data as ChatUser[]).filter(u => u.username !== loggedUser));
  }, [loggedUser]);

  const loadMessages = useCallback(async () => {
    if (!tenantId) return;
    const { data } = await supabase.from('chat_messages')
      .select('*').eq('tenant_id', tenantId).eq('channel', channel)
      .order('created_at', { ascending: true }).limit(300);
    if (data) setMessages(data as ChatMessage[]);
  }, [tenantId, channel]);

  const countUnread = useCallback(async () => {
    if (!tenantId) return;
    const { data } = await supabase.from('chat_messages')
      .select('channel, read_by').eq('tenant_id', tenantId).neq('sender', loggedUser);
    if (!data) return;
    const counts: Record<string, number> = {};
    for (const msg of data as any[]) {
      if (!(msg.read_by || []).includes(loggedUser))
        counts[msg.channel] = (counts[msg.channel] || 0) + 1;
    }
    setUnread(counts);
  }, [tenantId, loggedUser]);

  const markRead = useCallback(async () => {
    if (!tenantId) return;
    const { data } = await supabase.from('chat_messages')
      .select('id, read_by').eq('tenant_id', tenantId)
      .eq('channel', channelRef.current).neq('sender', loggedUser);
    if (!data) return;
    for (const msg of data as any[]) {
      if (!(msg.read_by || []).includes(loggedUser))
        await supabase.from('chat_messages')
          .update({ read_by: [...(msg.read_by || []), loggedUser] }).eq('id', msg.id);
    }
    setUnread(p => ({ ...p, [channelRef.current]: 0 }));
  }, [tenantId, loggedUser]);

  useEffect(() => {
    if (!tenantId) return;
    loadUsers(); countUnread();
    const sub = supabase.channel(`chat_${tenantId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'chat_messages',
        filter: `tenant_id=eq.${tenantId}`,
      }, (payload: any) => {
        const msg = payload.new as ChatMessage;
        if (msg.channel === channelRef.current) {
          setMessages(p => [...p, msg]);
          if (open) markRead();
        } else if (msg.sender !== loggedUser) {
          setUnread(p => ({ ...p, [msg.channel]: (p[msg.channel] || 0) + 1 }));
        }
      })
      .subscribe();
    return () => { sub.unsubscribe(); };
  }, [tenantId, loggedUser, open, loadUsers, countUnread, markRead]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  useEffect(() => {
    if (open) { markRead(); setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60); }
  }, [open, messages, markRead]);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open, channel]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending || (channel === 'broadcast' && !isAdmin)) return;
    setSending(true); setInput('');
    await supabase.from('chat_messages').insert({
      tenant_id: tenantId, sender: loggedUser, channel,
      message: text, is_broadcast: channel === 'broadcast', read_by: [loggedUser],
    });
    setSending(false); inputRef.current?.focus();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const dmTarget = channel.startsWith('dm::')
    ? channel.split('::').find(u => u !== loggedUser) : null;
  const dmUser = dmTarget ? users.find(u => u.username === dmTarget) : null;
  const openDM = (username: string) => { setChannel('dm::' + dmKey(loggedUser, username)); setShowDMList(false); };

  const channelLabel = channel === 'team' ? '💬 Team Chat'
    : channel === 'broadcast' ? '📢 Broadcast'
    : `💬 ${dmUser?.full_name || dmTarget}`;
  const channelSub = channel === 'team' ? 'All team members · anyone can post'
    : channel === 'broadcast' ? (isAdmin ? 'Announce to all users' : 'Admin announcements · read only')
    : `Direct message · ${dmTarget}`;

  const canSend = !isViewer && !(channel === 'broadcast' && !isAdmin);
  const headerBg = channel === 'broadcast' ? '#7c3aed' : '#0F2744';
  const sendBg   = channel === 'broadcast' ? '#7c3aed' : '#0F2744';

  const activeDMs = users.filter(u =>
    unread['dm::' + dmKey(loggedUser, u.username)] > 0 ||
    channel === 'dm::' + dmKey(loggedUser, u.username)
  );

  return (
    <>
      {/* Floating button */}
      <button onClick={() => setOpen(o => !o)} title="Team Chat"
        style={{ position:'fixed', bottom:60, right:20, zIndex:200, width:48, height:48,
          borderRadius:24, background:'#0F2744', border:'none', cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center',
          boxShadow:'0 4px 16px rgba(15,39,68,0.4)', transition:'transform 0.15s' }}
        onMouseEnter={e=>(e.currentTarget.style.transform='scale(1.08)')}
        onMouseLeave={e=>(e.currentTarget.style.transform='scale(1)')}>
        <span style={{ fontSize:20 }}>💬</span>
        {totalUnread > 0 && !open && (
          <div style={{ position:'absolute', top:-2, right:-2, background:'#dc2626',
            color:'white', width:18, height:18, borderRadius:9, fontSize:10, fontWeight:700,
            display:'flex', alignItems:'center', justifyContent:'center' }}>
            {totalUnread > 9 ? '9+' : totalUnread}
          </div>
        )}
      </button>

      {open && (
        <div style={{ position:'fixed', bottom:116, right:20, zIndex:200,
          width:'min(380px, calc(100vw - 32px))',
          height:'min(540px, calc(100vh - 160px))',
          background:'white', borderRadius:16, border:'1px solid #e2e8f0',
          boxShadow:'0 8px 40px rgba(0,0,0,0.18)',
          display:'flex', flexDirection:'column', overflow:'hidden',
          fontFamily:'system-ui,sans-serif' }}>

          {/* Header */}
          <div style={{ background:headerBg, padding:'10px 14px',
            display:'flex', alignItems:'center', gap:10, flexShrink:0, transition:'background 0.2s' }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'white' }}>{channelLabel}</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.55)', marginTop:1 }}>{channelSub}</div>
            </div>
            <button onClick={() => setShowDMList(s => !s)} title="Direct message"
              style={{ background:showDMList?'rgba(255,255,255,0.25)':'rgba(255,255,255,0.12)',
                border:'1px solid rgba(255,255,255,0.2)', borderRadius:7,
                color:'white', fontSize:11, fontWeight:600, padding:'3px 8px', cursor:'pointer' }}>
              👤 DM
            </button>
            <button onClick={() => setOpen(false)}
              style={{ background:'none', border:'none', color:'rgba(255,255,255,0.6)',
                fontSize:18, cursor:'pointer', lineHeight:1, padding:'2px 4px' }}>×</button>
          </div>

          {/* Tab bar */}
          <div style={{ display:'flex', borderBottom:'1px solid #f1f5f9',
            background:'#f8fafc', flexShrink:0, overflowX:'auto' }}>
            {(['team','broadcast'] as const).map(ch => {
              const label = ch === 'team' ? '# Team' : '📢 Broadcast';
              const cnt   = unread[ch] || 0;
              const active = channel === ch;
              const activeColor = ch === 'broadcast' ? '#7c3aed' : '#0F2744';
              return (
                <button key={ch} onClick={() => setChannel(ch)}
                  style={{ padding:'7px 12px', border:'none', cursor:'pointer',
                    fontSize:11, fontWeight:active?700:400,
                    color:active?activeColor:'#64748b',
                    background:'transparent', whiteSpace:'nowrap',
                    borderBottom:active?`2px solid ${activeColor}`:'2px solid transparent' }}>
                  {label}
                  {cnt>0 && <span style={{ marginLeft:4, background:'#dc2626', color:'white',
                    fontSize:9, fontWeight:700, padding:'0 4px', borderRadius:99 }}>{cnt}</span>}
                </button>
              );
            })}
            {activeDMs.map(u => {
              const key = 'dm::' + dmKey(loggedUser, u.username);
              const cnt = unread[key] || 0; const active = channel === key;
              return (
                <button key={key} onClick={() => setChannel(key)}
                  style={{ padding:'7px 10px', border:'none', cursor:'pointer',
                    fontSize:11, fontWeight:active?700:400,
                    color:active?'#0F2744':'#64748b',
                    background:'transparent', whiteSpace:'nowrap',
                    borderBottom:active?'2px solid #0F2744':'2px solid transparent' }}>
                  {u.username}
                  {cnt>0 && <span style={{ marginLeft:4, background:'#dc2626', color:'white',
                    fontSize:9, fontWeight:700, padding:'0 4px', borderRadius:99 }}>{cnt}</span>}
                </button>
              );
            })}
          </div>

          {/* DM user picker */}
          {showDMList && (
            <div style={{ background:'white', borderBottom:'1px solid #f1f5f9',
              maxHeight:180, overflowY:'auto', flexShrink:0 }}>
              <div style={{ padding:'6px 14px 4px', fontSize:10, fontWeight:700,
                color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em' }}>
                Direct messages
              </div>
              {users.length === 0
                ? <div style={{ padding:'8px 14px', fontSize:12, color:'#94a3b8' }}>No other users</div>
                : users.map(u => (
                  <button key={u.username} onClick={() => openDM(u.username)}
                    style={{ width:'100%', display:'flex', alignItems:'center', gap:10,
                      padding:'8px 14px', border:'none', background:'transparent',
                      cursor:'pointer', textAlign:'left' }}
                    onMouseEnter={e=>(e.currentTarget.style.background='#f8fafc')}
                    onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                    <Avatar name={u.username} size={26}/>
                    <div>
                      <div style={{ fontSize:12, fontWeight:600, color:'#1e293b' }}>
                        {u.full_name || u.username}
                      </div>
                      <div style={{ fontSize:10, color:'#94a3b8' }}>
                        {u.username}
                        {(u.role==='local_admin'||u.role==='global_admin') &&
                          <span style={{ marginLeft:4, background:'#eff6ff', color:'#2563eb',
                            padding:'1px 5px', borderRadius:99, fontSize:9 }}>Admin</span>}
                      </div>
                    </div>
                  </button>
                ))
              }
            </div>
          )}

          {/* Broadcast read-only notice */}
          {channel === 'broadcast' && !isAdmin && (
            <div style={{ background:'#faf5ff', borderBottom:'1px solid #e9d5ff',
              padding:'6px 14px', fontSize:11, color:'#7c3aed', flexShrink:0 }}>
              📢 Only admins can send broadcasts. You are in read-only mode.
            </div>
          )}

          {/* Messages */}
          <div style={{ flex:1, overflowY:'auto', padding:'10px 12px',
            display:'flex', flexDirection:'column', gap:2 }}>
            {messages.length === 0 && (
              <div style={{ flex:1, display:'flex', flexDirection:'column',
                alignItems:'center', justifyContent:'center', color:'#94a3b8', gap:8 }}>
                <div style={{ fontSize:32 }}>{channel==='broadcast'?'📢':'💬'}</div>
                <div style={{ fontSize:12, textAlign:'center', lineHeight:1.6 }}>
                  {channel==='team' && 'No messages yet. Say hi to your team!'}
                  {channel==='broadcast' && (isAdmin
                    ? 'No announcements yet.\nSend a broadcast to all users.'
                    : 'No announcements from your admin yet.')}
                  {channel.startsWith('dm::') && `Start a conversation with ${dmTarget}.`}
                </div>
              </div>
            )}
            {messages.map((m, i) => {
              const isMe = m.sender === loggedUser;
              const showSender = !isMe && (i===0 || messages[i-1].sender !== m.sender);

              // Broadcast pill style
              if (m.is_broadcast) return (
                <div key={m.id} style={{ background:'#faf5ff', border:'1px solid #e9d5ff',
                  borderLeft:'3px solid #7c3aed', borderRadius:10, padding:'8px 12px', margin:'4px 0' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                    <span style={{ fontSize:12 }}>📢</span>
                    <span style={{ fontSize:11, fontWeight:700, color:'#7c3aed' }}>{m.sender}</span>
                    <span style={{ fontSize:9, color:'#94a3b8', marginLeft:'auto' }}>{fmtTime(m.created_at)}</span>
                  </div>
                  <div style={{ fontSize:12, color:'#1e293b', lineHeight:1.5 }}>{m.message}</div>
                </div>
              );

              return (
                <div key={m.id} style={{ display:'flex', flexDirection:'column',
                  alignItems:isMe?'flex-end':'flex-start', marginBottom:2 }}>
                  {showSender && (
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3, marginLeft:2 }}>
                      <Avatar name={m.sender} size={20}/>
                      <span style={{ fontSize:11, fontWeight:600, color:'#374151' }}>{m.sender}</span>
                    </div>
                  )}
                  <div style={{ maxWidth:'78%', padding:'7px 11px', borderRadius:12,
                    borderBottomRightRadius:isMe?3:12, borderBottomLeftRadius:isMe?12:3,
                    background:isMe?'#0F2744':'#f1f5f9',
                    color:isMe?'white':'#1e293b', fontSize:12, lineHeight:1.5, wordBreak:'break-word' }}>
                    {m.message}
                  </div>
                  <div style={{ fontSize:9, color:'#94a3b8', margin:'2px 4px' }}>{fmtTime(m.created_at)}</div>
                </div>
              );
            })}
            <div ref={bottomRef}/>
          </div>

          {/* Input */}
          {canSend ? (
            <div style={{ padding:'8px 10px', borderTop:'1px solid #f1f5f9',
              display:'flex', gap:8, alignItems:'flex-end', flexShrink:0 }}>
              <textarea ref={inputRef} value={input}
                onChange={e => setInput(e.target.value)} onKeyDown={onKey}
                placeholder={channel==='broadcast' ? '📢 Broadcast to all users…'
                  : channel==='team' ? 'Message team…' : `Message ${dmTarget}…`}
                rows={1}
                style={{ flex:1, border:`1px solid ${channel==='broadcast'?'#e9d5ff':'#e2e8f0'}`,
                  borderRadius:10, padding:'8px 12px', fontSize:12, color:'#374151',
                  resize:'none', outline:'none', lineHeight:1.5, maxHeight:80,
                  overflowY:'auto', fontFamily:'system-ui' }}
              />
              <button onClick={send} disabled={!input.trim()||sending}
                style={{ width:34, height:34, borderRadius:10, border:'none', flexShrink:0,
                  background:!input.trim()?'#e2e8f0':sendBg,
                  color:input.trim()?'white':'#94a3b8', fontSize:14,
                  cursor:input.trim()?'pointer':'default',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  transition:'background 0.15s' }}>
                ↑
              </button>
            </div>
          ) : (
            <div style={{ padding:'8px 14px', borderTop:'1px solid #f1f5f9',
              fontSize:11, color:'#94a3b8', textAlign:'center' }}>
              {isViewer ? 'Viewers can read but not send messages' : 'Read only'}
            </div>
          )}
        </div>
      )}
    </>
  );
}
