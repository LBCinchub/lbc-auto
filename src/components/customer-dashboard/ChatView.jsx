import React, { useEffect, useRef, useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import { timeAgo } from "./viewUtils";

export default function ChatView({ messages, shopName, onSend }) {
  const [text,setText]=useState(""); const [state,setState]=useState({loading:false,error:""}); const listRef=useRef(null);
  useEffect(()=>{ if(listRef.current) listRef.current.scrollTop=listRef.current.scrollHeight; },[messages]);
  const send=async(e)=>{e.preventDefault();if(!text.trim())return;setState({loading:true,error:""});try{await onSend(text.trim());setText("");setState({loading:false,error:""});}catch(error){setState({loading:false,error:error.message});}};
  return <section className="cd-view-card cd-chat"><div className="cd-view-title"><MessageSquare/><div><span>Secure conversation</span><h1>Chat with {shopName}</h1></div></div><div className="cd-chat-list" ref={listRef}>{messages.length ? messages.map((m)=><div key={m.id} className={`cd-message ${m.sender}`}><strong>{m.sender==="shop"?shopName:"You"}</strong><p>{m.message}</p><small>{timeAgo(m.sent_at)}</small></div>):<div className="cd-empty"><MessageSquare/><strong>No messages yet</strong><p>Ask the shop a question about your vehicle or service.</p></div>}</div><form className="cd-chat-compose" onSubmit={send}><input value={text} onChange={(e)=>setText(e.target.value)} placeholder="Write a message…" aria-label="Message"/>{state.error&&<p>{state.error}</p>}<button disabled={state.loading||!text.trim()}><Send/>{state.loading?"Sending…":"Send"}</button></form></section>;
}