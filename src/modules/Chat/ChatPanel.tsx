import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface ChatMessage {
  id: string; tenant_id: string; sender: string;
  channel: string; message: string; is_broadcast: boolean;
  read_by: string[]; created_at: string;
}
interface ChatUser {
  username: string; full_name: string; role: string; tenant_id?: string;
}
interface ChatGroup {
  id: string; tenant_id: string; name: string;
  members: string[]; created_by: string; created_at: string;
}
interface ChatPanelProps {
  tenantId: string; loggedUser: string; userRole?: string;
  isViewer?: boolean; onClose?: () => void; embedded?: boolean;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const dmKey = (a: string, b: string) => `dm::${[a,b].sort().join('::')}`;

function fmtTime(iso: string) {
  if (!iso) return '';
  const d = new Date(iso), now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  return d.toLocaleDateString([], { day:'numeric', month:'short' })
    + ' ' + d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
}

const COLORS = ['#2563eb','#7c3aed','#0891b2','#059669','#d97706','#dc2626','#db2777'];
function avatarColor(n: string) {
  let h = 0; for (let i=0;i<n.length;i++) h=(h*31+n.charCodeAt(i))&0xfffffff;
  return COLORS[h%COLORS.length];
}
function Avatar({ name, size=20 }: { name:string; size?:number }) {
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', background:avatarColor(name),
      color:'white', display:'flex', alignItems:'center', justifyContent:'center',
      fontSize:Math.floor(size*0.42), fontWeight:700, flexShrink:0 }}>
      {name.slice(0,2).toUpperCase()}
    </div>
  );
}
function Ticks({ msg, loggedUser }: { msg:ChatMessage; loggedUser:string }) {
  if (msg.id.startsWith('opt_')) return <span style={{fontSize:9,color:'#9ca3af',marginLeft:3}}>✓</span>;
  const readByOthers = (msg.read_by||[]).some(u=>u!==loggedUser);
  if (readByOthers) return <span style={{fontSize:9,color:'#0F2744',fontWeight:700,marginLeft:3}}>✓✓</span>;
  return <span style={{fontSize:9,color:'#9ca3af',marginLeft:3}}>✓✓</span>;
}
function parseMentions(text: string): string[] {
  const re=/@(\w+)/g; const out:string[]=[]; let m;
  while ((m=re.exec(text))!==null) out.push(m[1].toLowerCase());
  return out;
}
function MsgText({ text, loggedUser }: { text:string; loggedUser:string }) {
  return (
    <span>
      {text.split(/(@\w+)/g).map((p,i)=>{
        if (!p.startsWith('@')) return <span key={i}>{p}</span>;
        const isMe = p.slice(1).toLowerCase()===loggedUser.toLowerCase();
        return <span key={i} style={{color:isMe?'#dc2626':'#2563eb',fontWeight:600}}>{p}</span>;
      })}
    </span>
  );
}
const NAVY='#0F2744';

// ─── NEW GROUP MODAL ──────────────────────────────────────────────────────────
function NewGroupModal({ users, onSave, onClose }:{
  users:ChatUser[]; onSave:(name:string,members:string[])=>void; onClose:()=>void;
}) {
  const [name,setSel_name]=useState('');
  const [sel,setSel]=useState<Set<string>>(new Set());
  const [q,setQ]=useState('');
  const filtered=q.trim()
    ? users.filter(u=>(u.full_name||u.username).toLowerCase().includes(q.toLowerCase()))
    : users;
  const toggle=(u:string)=>setSel(s=>{const n=new Set(s);n.has(u)?n.delete(u):n.add(u);return n;});
  return (
    <div style={{position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,0.45)',
      display:'flex',alignItems:'center',justifyContent:'center',padding:16}}
      onClick={onClose}>
      <div onClick={e=>e.stopPropagation()}
        style={{background:'white',borderRadius:12,width:'100%',maxWidth:380,
          display:'flex',flexDirection:'column',overflow:'hidden',
          boxShadow:'0 16px 48px rgba(0,0,0,0.2)'}}>
        <div style={{background:NAVY,padding:'12px 16px',display:'flex',
          alignItems:'center',justifyContent:'space-between'}}>
          <span style={{color:'white',fontWeight:700,fontSize:13}}>New Group Chat</span>
          <button onClick={onClose} style={{background:'none',border:'none',
            color:'rgba(255,255,255,0.6)',fontSize:18,cursor:'pointer'}}>×</button>
        </div>
        <div style={{padding:'12px 16px',borderBottom:'1px solid #f1f5f9'}}>
          <input value={name} onChange={e=>setSel_name(e.target.value)}
            placeholder="Group name…" autoFocus
            style={{width:'100%',boxSizing:'border-box',border:'1px solid #e2e8f0',
              borderRadius:7,padding:'8px 10px',fontSize:14,outline:'none'}}/>
        </div>
        <div style={{padding:'8px 16px 4px',borderBottom:'1px solid #f1f5f9'}}>
          <input value={q} onChange={e=>setQ(e.target.value)}
            placeholder="Search members…"
            style={{width:'100%',boxSizing:'border-box',border:'1px solid #e2e8f0',
              borderRadius:7,padding:'6px 10px',fontSize:13,outline:'none',background:'#f8fafc'}}/>
        </div>
        <div style={{maxHeight:220,overflowY:'auto'}}>
          {filtered.map(u=>(
            <div key={u.username} onClick={()=>toggle(u.username)}
              style={{display:'flex',alignItems:'center',gap:10,padding:'9px 16px',
                cursor:'pointer',background:sel.has(u.username)?'#eff6ff':'white'}}
              onMouseEnter={e=>{if(!sel.has(u.username))e.currentTarget.style.background='#f8fafc';}}
              onMouseLeave={e=>{e.currentTarget.style.background=sel.has(u.username)?'#eff6ff':'white';}}>
              <div style={{width:18,height:18,borderRadius:4,
                border:`2px solid ${sel.has(u.username)?NAVY:'#e2e8f0'}`,
                background:sel.has(u.username)?NAVY:'white',
                display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                {sel.has(u.username)&&<span style={{color:'white',fontSize:11,lineHeight:1}}>✓</span>}
              </div>
              <Avatar name={u.username} size={24}/>
              <div>
                <div style={{fontSize:12,fontWeight:500,color:'#1e293b'}}>{u.full_name||u.username}</div>
                <div style={{fontSize:10,color:'#94a3b8'}}>@{u.username}</div>
              </div>
            </div>
          ))}
          {filtered.length===0&&<div style={{padding:'12px 16px',fontSize:12,color:'#94a3b8'}}>No users found</div>}
        </div>
        <div style={{padding:'10px 16px',borderTop:'1px solid #f1f5f9',
          display:'flex',justifyContent:'flex-end',gap:8}}>
          <button onClick={onClose}
            style={{padding:'7px 16px',borderRadius:7,border:'1px solid #e2e8f0',
              background:'white',fontSize:12,cursor:'pointer',color:'#374151'}}>Cancel</button>
          <button onClick={()=>{if(name.trim()&&sel.size>0)onSave(name.trim(),[...sel]);}}
            disabled={!name.trim()||sel.size===0}
            style={{padding:'7px 16px',borderRadius:7,border:'none',
              background:name.trim()&&sel.size>0?NAVY:'#e2e8f0',
              color:name.trim()&&sel.size>0?'white':'#94a3b8',
              fontSize:12,fontWeight:600,cursor:'pointer'}}>
            Create ({sel.size})
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SIDEBAR ROW ──────────────────────────────────────────────────────────────
function SideRow({ label, sub, icon, active, unread, onClick }:{
  label:string; sub?:string; icon?:React.ReactNode;
  active:boolean; unread:number; onClick:()=>void;
}) {
  return (
    <div onClick={onClick}
      style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',
        cursor:'pointer',borderRadius:6,margin:'0 4px',
        background:active?'rgba(255,255,255,0.14)':'transparent',
        borderLeft:active?`3px solid white`:'3px solid transparent',
        transition:'background 0.12s'}}
      onMouseEnter={e=>{if(!active)e.currentTarget.style.background='rgba(255,255,255,0.07)';}}
      onMouseLeave={e=>{if(!active)e.currentTarget.style.background='transparent';}}>
      <div style={{flexShrink:0}}>{icon}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:12,fontWeight:active?600:400,color:'white',
          overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{label}</div>
        {sub&&<div style={{fontSize:10,color:'rgba(255,255,255,0.4)',
          overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{sub}</div>}
      </div>
      {unread>0&&(
        <div style={{background:'#dc2626',color:'white',fontSize:9,fontWeight:700,
          minWidth:16,height:16,borderRadius:99,display:'flex',
          alignItems:'center',justifyContent:'center',padding:'0 4px',flexShrink:0}}>
          {unread>99?'99+':unread}
        </div>
      )}
    </div>
  );
}

// ─── MENTION AUTOCOMPLETE ─────────────────────────────────────────────────────
function MentionMenu({ items, idx, onPick }:{
  items:ChatUser[]; idx:number; onPick:(u:ChatUser)=>void;
}) {
  if (!items.length) return null;
  return (
    <div style={{position:'absolute',bottom:'calc(100% + 4px)',left:0,right:0,
      background:'white',border:'1px solid #e2e8f0',borderRadius:8,
      boxShadow:'0 4px 16px rgba(0,0,0,0.12)',overflow:'hidden',zIndex:50}}>
      {items.map((u,i)=>(
        <div key={u.username} onClick={()=>onPick(u)}
          style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',
            cursor:'pointer',background:i===idx?'#eff6ff':'white',fontSize:12}}
          onMouseEnter={e=>e.currentTarget.style.background='#eff6ff'}
          onMouseLeave={e=>e.currentTarget.style.background=i===idx?'#eff6ff':'white'}>
          <Avatar name={u.username} size={18}/>
          <span style={{fontWeight:500,color:'#1e293b'}}>{u.full_name||u.username}</span>
          <span style={{color:'#94a3b8',fontSize:11}}>@{u.username}</span>
        </div>
      ))}
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function ChatPanel({
  tenantId, loggedUser, userRole='editor', isViewer=false, onClose, embedded=false,
}: ChatPanelProps) {
  const isAdmin = userRole==='local_admin'||userRole==='global_admin';

  const [channel,      setChannel]      = useState<string>('');
  const [messages,     setMessages]     = useState<ChatMessage[]>([]);
  const [users,        setUsers]        = useState<ChatUser[]>([]);
  const [groups,       setGroups]       = useState<ChatGroup[]>([]);
  const [input,        setInput]        = useState('');
  const [sending,      setSending]      = useState(false);
  const [unread,       setUnread]       = useState<Record<string,number>>({});
  const [search,       setSearch]       = useState('');
  const [hoveredMsg,   setHoveredMsg]   = useState<string|null>(null);
  const [deleting,     setDeleting]     = useState<string|null>(null);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [mentionList,  setMentionList]  = useState<ChatUser[]>([]);
  const [mentionIdx,   setMentionIdx]   = useState(0);

  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLTextAreaElement>(null);
  const channelRef = useRef<string>('');
  channelRef.current = channel;

  // ── Load users ──────────────────────────────────────────────────────────────
  const loadUsers = useCallback(async () => {
    if (!tenantId) return;
    if (userRole==='global_admin') {
      const { data:own }   = await supabase.from('tenant_users')
        .select('username,full_name,role,tenant_id').eq('active',true).eq('tenant_id',tenantId).order('full_name');
      const { data:other } = await supabase.from('tenant_users')
        .select('username,full_name,role,tenant_id').eq('active',true).eq('role','local_admin').neq('tenant_id',tenantId).order('full_name');
      setUsers([...(own||[]),...(other||[])].filter(u=>u.username!==loggedUser) as ChatUser[]);
    } else {
      const { data } = await supabase.from('tenant_users')
        .select('username,full_name,role').eq('active',true).eq('tenant_id',tenantId).order('full_name');
      if (data) setUsers((data as ChatUser[]).filter(u=>u.username!==loggedUser));
    }
  }, [tenantId,loggedUser,userRole]);

  // ── Load groups ─────────────────────────────────────────────────────────────
  const loadGroups = useCallback(async () => {
    if (!tenantId) return;
    try {
      const { data } = await supabase.from('chat_groups')
        .select('*').eq('tenant_id',tenantId)
        .contains('members',[loggedUser]).order('created_at');
      if (data) setGroups(data as ChatGroup[]);
    } catch { /* table may not exist yet */ }
  }, [tenantId,loggedUser]);

  // ── Load messages ───────────────────────────────────────────────────────────
  const loadMessages = useCallback(async (ch:string) => {
    if (!tenantId||!ch) return;
    const { data } = await supabase.from('chat_messages')
      .select('*').eq('tenant_id',tenantId).eq('channel',ch)
      .order('created_at',{ascending:true}).limit(300);
    if (data) setMessages(data as ChatMessage[]);
  }, [tenantId]);

  // ── Mark read ───────────────────────────────────────────────────────────────
  const markRead = useCallback(async (ch:string) => {
    if (!tenantId||!ch) return;
    const { data } = await supabase.from('chat_messages')
      .select('id,read_by').eq('tenant_id',tenantId).eq('channel',ch).neq('sender',loggedUser);
    if (!data) return;
    const toUpdate=(data as any[]).filter(m=>!(m.read_by||[]).includes(loggedUser));
    if (!toUpdate.length) return;
    await Promise.all(toUpdate.map(m=>
      supabase.from('chat_messages').update({read_by:[...(m.read_by||[]),loggedUser]}).eq('id',m.id)
    ));
    setUnread(p=>({...p,[ch]:0}));
  }, [tenantId,loggedUser]);

  // ── Count unread ────────────────────────────────────────────────────────────
  const countUnread = useCallback(async () => {
    if (!tenantId) return;
    const { data } = await supabase.from('chat_messages')
      .select('channel,read_by,message').eq('tenant_id',tenantId).neq('sender',loggedUser);
    if (!data) return;
    const counts: Record<string,number>={};
    for (const msg of data as any[]) {
      const unreadMsg=!(msg.read_by||[]).includes(loggedUser);
      const mentioned=parseMentions(msg.message||'').includes(loggedUser.toLowerCase());
      if (unreadMsg||mentioned) counts[msg.channel]=(counts[msg.channel]||0)+1;
    }
    setUnread(counts);
  }, [tenantId,loggedUser]);

  // ── Realtime ────────────────────────────────────────────────────────────────
  useEffect(()=>{
    if (!tenantId) return;
    loadUsers(); loadGroups(); countUnread();
    const sub=supabase.channel(`chat_rt_${tenantId}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'chat_messages',
        filter:`tenant_id=eq.${tenantId}`},(payload:any)=>{
        const msg=payload.new as ChatMessage;
        if (msg.sender===loggedUser) return;
        if (msg.channel===channelRef.current){
          setMessages(p=>[...p,msg]); markRead(msg.channel);
        } else {
          setUnread(p=>({...p,[msg.channel]:(p[msg.channel]||0)+1}));
        }
      })
      .on('postgres_changes',{event:'DELETE',schema:'public',table:'chat_messages',
        filter:`tenant_id=eq.${tenantId}`},(payload:any)=>{
        if (payload.old?.id) setMessages(p=>p.filter(m=>m.id!==payload.old.id));
      })
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'chat_groups',
        filter:`tenant_id=eq.${tenantId}`},()=>loadGroups())
      .subscribe();
    return ()=>{ sub.unsubscribe(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[tenantId]);

  useEffect(()=>{ if(channel){ loadMessages(channel); markRead(channel); } },[channel]); // eslint-disable-line
  useEffect(()=>{ setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:'smooth'}),40); },[messages.length]);
  useEffect(()=>{ if(channel) inputRef.current?.focus(); },[channel]);

  // ── @mention autocomplete ────────────────────────────────────────────────────
  useEffect(()=>{
    const m=input.match(/@(\w*)$/);
    if (!m){setMentionList([]);return;}
    const q=m[1].toLowerCase();
    const allOpts:ChatUser[]=[{username:'broadcast',full_name:'Broadcast to all (@broadcast)',role:''},...users];
    const filtered=q===''?allOpts.slice(0,7):allOpts.filter(u=>
      u.username.toLowerCase().startsWith(q)||(u.full_name||'').toLowerCase().startsWith(q)
    ).slice(0,7);
    setMentionList(filtered); setMentionIdx(0);
  },[input,users]);

  const applyMention=(u:ChatUser)=>{
    const replaced=input.replace(/@(\w*)$/,'@'+u.username+' ');
    setInput(replaced); setMentionList([]);
    setTimeout(()=>inputRef.current?.focus(),0);
  };

  // ── Send ────────────────────────────────────────────────────────────────────
  const send=async()=>{
    const text=input.trim();
    if (!text||sending||isViewer||!channel) return;
    setSending(true); setInput(''); setMentionList([]);

    const isDM=channel.startsWith('dm::');
    const dmTarg=isDM?channel.split('::').find(u=>u!==loggedUser):null;
    const dmTargUser=dmTarg?users.find(u=>u.username===dmTarg):null;
    const effectiveTenantId=(dmTargUser?.tenant_id&&dmTargUser.tenant_id!==tenantId)
      ?dmTargUser.tenant_id:tenantId;

    const isBcast=channel==='broadcast';
    const now=new Date().toISOString();
    const opt:ChatMessage={
      id:`opt_${now}`,tenant_id:effectiveTenantId,sender:loggedUser,
      channel,message:text,is_broadcast:isBcast,read_by:[loggedUser],created_at:now,
    };
    setMessages(p=>[...p,opt]);
    const {data,error}=await supabase.from('chat_messages').insert({
      tenant_id:effectiveTenantId,sender:loggedUser,channel,
      message:text,is_broadcast:isBcast,read_by:[loggedUser],
    }).select().single();
    if (error) setMessages(p=>p.filter(m=>m.id!==opt.id));
    else if (data) setMessages(p=>p.map(m=>m.id===opt.id?data as ChatMessage:m));
    setSending(false); inputRef.current?.focus();
  };

  const onKey=(e:React.KeyboardEvent)=>{
    if (mentionList.length>0){
      if (e.key==='ArrowDown'){e.preventDefault();setMentionIdx(i=>Math.min(i+1,mentionList.length-1));return;}
      if (e.key==='ArrowUp'){e.preventDefault();setMentionIdx(i=>Math.max(i-1,0));return;}
      if (e.key==='Enter'||e.key==='Tab'){e.preventDefault();applyMention(mentionList[mentionIdx]);return;}
      if (e.key==='Escape'){setMentionList([]);return;}
    }
    if (e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const deleteMessage=async(id:string)=>{
    if (id.startsWith('opt_')||deleting) return;
    setDeleting(id); setMessages(p=>p.filter(m=>m.id!==id));
    const {error}=await supabase.from('chat_messages').delete().eq('id',id);
    if (error) loadMessages(channel);
    setDeleting(null);
  };

  // ── Create group ─────────────────────────────────────────────────────────────
  const createGroup=async(name:string,members:string[])=>{
    setShowNewGroup(false);
    const allMembers=[...new Set([...members,loggedUser])];
    const {data,error}=await supabase.from('chat_groups').insert({
      tenant_id:tenantId,name,members:allMembers,created_by:loggedUser,
    }).select().single();
    if (!error&&data){
      setGroups(p=>[...p,data as ChatGroup]);
      setChannel(`group::${(data as ChatGroup).id}`);
    }
  };

  // ── Sidebar filtering ────────────────────────────────────────────────────────
  const sq=search.trim().toLowerCase();
  const dmUsers=users.filter(u=>{
    const key=dmKey(loggedUser,u.username);
    const hasActivity=unread[key]>0||channel===key;
    const matchesSearch=!sq||(u.full_name||u.username).toLowerCase().includes(sq)||u.username.toLowerCase().includes(sq);
    return hasActivity||matchesSearch;
  });
  const visibleUsers=sq
    ? users.filter(u=>(u.full_name||u.username).toLowerCase().includes(sq)||u.username.toLowerCase().includes(sq))
    : dmUsers;
  const visibleGroups=sq
    ? groups.filter(g=>g.name.toLowerCase().includes(sq))
    : groups;

  // ── Active channel label ─────────────────────────────────────────────────────
  const activeLabel=()=>{
    if (!channel) return '💬 Select a conversation';
    if (channel.startsWith('dm::')){
      const targ=channel.split('::').find(u=>u!==loggedUser);
      const u=users.find(x=>x.username===targ);
      return u?.full_name||targ||'Direct Message';
    }
    if (channel.startsWith('group::')){
      const gid=channel.replace('group::','');
      return groups.find(g=>g.id===gid)?.name||'Group Chat';
    }
    if (channel==='broadcast') return '📢 Broadcast';
    return channel;
  };

  const canSend=!isViewer&&!!channel&&(channel!=='broadcast'||isAdmin);
  const groupMembers=channel.startsWith('group::')
    ? groups.find(g=>`group::${g.id}`===channel)?.members||[]
    : [];

  // ── RENDER ───────────────────────────────────────────────────────────────────
  return (
    <div style={{display:'flex',height:'100%',fontFamily:'system-ui,sans-serif',overflow:'hidden'}}>

      {/* ── LEFT SIDEBAR (30%) ── */}
      <div style={{width:'30%',minWidth:160,maxWidth:220,background:NAVY,
        display:'flex',flexDirection:'column',overflow:'hidden',flexShrink:0}}>

        {/* Header */}
        <div style={{padding:'10px 12px 6px',display:'flex',alignItems:'center',
          justifyContent:'space-between',flexShrink:0}}>
          <span style={{fontSize:13,fontWeight:700,color:'white'}}>Messages</span>
          {onClose&&(
            <button onClick={onClose} style={{background:'none',border:'none',
              color:'rgba(255,255,255,0.5)',fontSize:16,cursor:'pointer',padding:'2px 4px'}}>×</button>
          )}
        </div>

        {/* Search */}
        <div style={{padding:'0 8px 8px',flexShrink:0}}>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Search…"
            style={{width:'100%',boxSizing:'border-box',background:'rgba(255,255,255,0.1)',
              border:'1px solid rgba(255,255,255,0.15)',borderRadius:6,
              padding:'6px 9px',fontSize:12,color:'white',outline:'none',
              fontFamily:'system-ui'}}/>
        </div>

        {/* Conversation list */}
        <div style={{flex:1,overflowY:'auto',paddingBottom:8}}>

          {/* Broadcast — admins only */}
          {isAdmin&&(!sq||'broadcast'.includes(sq))&&(
            <>
              <div style={{padding:'4px 12px 2px',fontSize:9,fontWeight:700,
                color:'rgba(255,255,255,0.35)',textTransform:'uppercase',letterSpacing:'.06em'}}>
                Broadcast
              </div>
              <SideRow label="📢 All Users" sub="Send to everyone"
                active={channel==='broadcast'} unread={unread['broadcast']||0}
                icon={null}
                onClick={()=>setChannel('broadcast')}/>
            </>
          )}

          {/* Groups */}
          {visibleGroups.length>0&&(
            <div style={{padding:'8px 12px 2px',fontSize:9,fontWeight:700,
              color:'rgba(255,255,255,0.35)',textTransform:'uppercase',letterSpacing:'.06em'}}>
              Groups
            </div>
          )}
          {visibleGroups.map(g=>(
            <SideRow key={g.id} label={g.name}
              sub={`${g.members.length} members`}
              active={channel===`group::${g.id}`}
              unread={unread[`group::${g.id}`]||0}
              icon={<div style={{width:20,height:20,borderRadius:'50%',background:'rgba(255,255,255,0.15)',
                display:'flex',alignItems:'center',justifyContent:'center',fontSize:10}}>👥</div>}
              onClick={()=>setChannel(`group::${g.id}`)}/>
          ))}

          {/* Direct Messages */}
          <div style={{padding:'8px 12px 2px',fontSize:9,fontWeight:700,
            color:'rgba(255,255,255,0.35)',textTransform:'uppercase',letterSpacing:'.06em'}}>
            Direct Messages
          </div>
          {visibleUsers.map(u=>(
            <SideRow key={u.username}
              label={u.full_name||u.username}
              sub={`@${u.username}`}
              active={channel===dmKey(loggedUser,u.username)}
              unread={unread[dmKey(loggedUser,u.username)]||0}
              icon={<Avatar name={u.username} size={20}/>}
              onClick={()=>setChannel(dmKey(loggedUser,u.username))}/>
          ))}
          {visibleUsers.length===0&&sq&&(
            <div style={{padding:'8px 12px',fontSize:11,color:'rgba(255,255,255,0.3)'}}>No results</div>
          )}
        </div>

        {/* New group button */}
        {!isViewer&&(
          <div style={{padding:'8px',borderTop:'1px solid rgba(255,255,255,0.08)',flexShrink:0}}>
            <button onClick={()=>setShowNewGroup(true)}
              style={{width:'100%',padding:'7px',borderRadius:6,border:'1px solid rgba(255,255,255,0.2)',
                background:'transparent',color:'rgba(255,255,255,0.7)',fontSize:11,
                fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',
                justifyContent:'center',gap:5}}>
              ＋ New Group
            </button>
          </div>
        )}
      </div>

      {/* ── RIGHT PANE (70%) ── */}
      <div style={{flex:1,display:'flex',flexDirection:'column',
        background:'white',overflow:'hidden',minWidth:0}}>

        {!channel ? (
          <div style={{flex:1,display:'flex',flexDirection:'column',
            alignItems:'center',justifyContent:'center',color:'#94a3b8',gap:10}}>
            <div style={{fontSize:32}}>💬</div>
            <div style={{fontSize:12,textAlign:'center',lineHeight:1.7,maxWidth:200}}>
              Select a conversation from the left or search for someone to message.
            </div>
          </div>
        ) : (
          <>
            {/* Pane header */}
            <div style={{background:'#f8fafc',borderBottom:'1px solid #e2e8f0',
              padding:'8px 14px',flexShrink:0,display:'flex',alignItems:'center',gap:8}}>
              <div style={{fontWeight:600,fontSize:13,color:NAVY,flex:1}}>{activeLabel()}</div>
              {channel.startsWith('group::')&&groupMembers.length>0&&(
                <div style={{fontSize:10,color:'#64748b'}}>
                  {groupMembers.join(', ')}
                </div>
              )}
              {channel==='broadcast'&&!isAdmin&&(
                <span style={{fontSize:10,color:'#f59e0b',background:'#fef9c3',
                  padding:'1px 7px',borderRadius:99}}>Read only</span>
              )}
            </div>

            {/* Messages */}
            <div style={{flex:1,overflowY:'auto',padding:'10px 14px',
              display:'flex',flexDirection:'column',gap:1}}>
              {messages.length===0&&(
                <div style={{flex:1,display:'flex',flexDirection:'column',
                  alignItems:'center',justifyContent:'center',color:'#94a3b8',gap:8,minHeight:200}}>
                  <div style={{fontSize:28}}>💬</div>
                  <div style={{fontSize:11,textAlign:'center',lineHeight:1.7}}>
                    {channel==='broadcast'?'No broadcasts yet.'
                      :channel.startsWith('group::')?'No messages in this group yet.'
                      :'No messages yet. Say something!'}
                  </div>
                </div>
              )}
              {messages.map((m,i)=>{
                const isMe=m.sender===loggedUser;
                const isOpt=m.id.startsWith('opt_');
                const isHov=hoveredMsg===m.id;
                const prev=messages[i-1];
                const showSender=!isMe&&(i===0||prev.sender!==m.sender);
                const inTenant=isMe||users.some(u=>u.username===m.sender);
                const dispName=inTenant?m.sender:`${m.sender} (removed)`;
                return (
                  <div key={m.id}
                    onMouseEnter={()=>setHoveredMsg(m.id)}
                    onMouseLeave={()=>setHoveredMsg(null)}
                    style={{display:'flex',flexDirection:'column',
                      alignItems:isMe?'flex-end':'flex-start',
                      marginBottom:3,opacity:isOpt?0.6:1}}>
                    {showSender&&(
                      <div style={{display:'flex',alignItems:'center',gap:4,marginBottom:2,marginLeft:2}}>
                        <Avatar name={m.sender} size={16}/>
                        <span style={{fontSize:10,fontWeight:600,
                          color:inTenant?'#374151':'#94a3b8',
                          fontStyle:inTenant?'normal':'italic'}}>{dispName}</span>
                      </div>
                    )}
                    <div style={{display:'flex',alignItems:'flex-end',
                      gap:5,flexDirection:isMe?'row-reverse':'row'}}>
                      {isMe&&isHov&&!isOpt&&(
                        <button onClick={()=>deleteMessage(m.id)}
                          style={{background:'none',border:'none',cursor:'pointer',
                            color:'#94a3b8',fontSize:11,padding:'1px 3px',
                            borderRadius:3,opacity:deleting===m.id?0.4:1}}>🗑</button>
                      )}
                      <div style={{maxWidth:'78%',fontSize:12,lineHeight:1.5,
                        color:isMe?NAVY:'#1e293b',wordBreak:'break-word',
                        overflowWrap:'anywhere',whiteSpace:'pre-wrap',
                        fontWeight:isMe?500:400}}>
                        <MsgText text={m.message} loggedUser={loggedUser}/>
                      </div>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:2,
                      fontSize:9,color:'#94a3b8',margin:'1px 2px'}}>
                      {fmtTime(m.created_at)}
                      {isMe&&<Ticks msg={m} loggedUser={loggedUser}/>}
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef}/>
            </div>

            {/* Input */}
            {canSend?(
              <div style={{padding:'8px 10px',borderTop:'1px solid #f1f5f9',
                display:'flex',gap:8,alignItems:'flex-end',flexShrink:0,
                background:'white',position:'relative'}}>
                {/* @mention autocomplete */}
                {mentionList.length>0&&(
                  <MentionMenu items={mentionList} idx={mentionIdx} onPick={applyMention}/>
                )}
                <textarea ref={inputRef} value={input}
                  onChange={e=>setInput(e.target.value)} onKeyDown={onKey}
                  placeholder={channel==='broadcast'?'Broadcast to all…'
                    :channel.startsWith('group::')?'Message group… (type @ to mention)'
                    :'Message… (type @ to mention)'}
                  rows={1}
                  style={{flex:1,border:'1px solid #e2e8f0',borderRadius:8,
                    padding:'7px 10px',fontSize:16,color:'#374151',resize:'none',
                    outline:'none',lineHeight:1.5,maxHeight:80,overflowY:'auto',
                    fontFamily:'system-ui'}}/>
                <button onClick={send} disabled={!input.trim()||sending}
                  style={{height:34,padding:'0 14px',borderRadius:8,border:'none',
                    background:input.trim()?NAVY:'#e2e8f0',
                    color:input.trim()?'white':'#94a3b8',
                    fontSize:11,fontWeight:700,cursor:input.trim()?'pointer':'default',
                    display:'flex',alignItems:'center',gap:5,
                    whiteSpace:'nowrap',flexShrink:0,transition:'background 0.15s'}}>
                  <span style={{fontSize:12}}>&#10148;</span> Send
                </button>
              </div>
            ):(
              <div style={{padding:'8px 12px',borderTop:'1px solid #f1f5f9',
                fontSize:11,color:'#94a3b8',textAlign:'center'}}>
                {isViewer?'👁 View only':'📢 Only admins can broadcast'}
              </div>
            )}
          </>
        )}
      </div>

      {/* New Group Modal */}
      {showNewGroup&&(
        <NewGroupModal users={users} onSave={createGroup} onClose={()=>setShowNewGroup(false)}/>
      )}
    </div>
  );
}
