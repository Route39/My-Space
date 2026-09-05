import React, { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send, MoreVertical, Trash2 } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Avatar } from "@/components/common";

export default function ChatWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [staffList, setStaffList] = useState([]);
  const [mentionMode, setMentionMode] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [activeMenu, setActiveMenu] = useState(null);
  const [unread, setUnread] = useState(false);
  const messagesEndRef = useRef(null);

  // Use a ref to track the last message ID to detect new ones and play sound
  const lastMsgIdRef = useRef(null);

  const fetchMessages = async () => {
    try {
      const { data } = await api.get("/chat/messages");
      setMessages(data);
      
      if (data.length > 0) {
        const lastMsg = data[data.length - 1];
        
        // If we already tracked a previous message, and the new last message is different
        if (lastMsgIdRef.current && lastMsgIdRef.current !== lastMsg.id) {
          // Play sound and show dot if the new message is not sent by me
          if (lastMsg.sender_id !== user.id) {
            const audio = new Audio("/ping.mp3");
            audio.play().catch(e => console.log("Audio play blocked"));
            
            // Because fetchMessages is in a setInterval closure, we use a functional state update 
            // or just rely on the fact that if it's running, the user got a new message.
            // But wait, the closure might have stale `open` state.
            // Let's just always set unread to true if the chat is not actively focused/open.
            // Actually, we can use document.visibilityState or just set it to true and let the open effect clear it.
            setUnread(prev => {
                // We don't have fresh 'open' here easily, but if they receive it while open, 
                // the useEffect will immediately clear it anyway.
                return true;
            });
          }
        }
        
        // Update the ref to the latest message ID
        lastMsgIdRef.current = lastMsg.id;
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStaff = async () => {
    try {
      const { data } = await api.get("/employees");
      setStaffList(data);
    } catch (err) { }
  };

  // Poll for messages even when closed to get the unread dot and sound
  useEffect(() => {
    fetchStaff();
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [open]);

  useEffect(() => {
    if (open) {
      setUnread(false);
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open]);

  const handleTextChange = (e) => {
    const val = e.target.value;
    setText(val);
    const lastWord = val.split(" ").pop();
    if (lastWord.startsWith("@")) {
      setMentionMode(true);
      setMentionQuery(lastWord.slice(1).toLowerCase());
    } else {
      setMentionMode(false);
    }
  };

  const insertMention = (staff) => {
    const words = text.split(" ");
    words.pop(); // remove the @...
    setText(words.join(" ") + (words.length > 0 ? " " : "") + `@${staff.name} `);
    setMentionMode(false);
    document.getElementById("chat-input").focus();
  };

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    
    // Check for mentions
    const mentions = [];
    staffList.forEach(s => {
      if (text.includes(`@${s.name}`)) {
        mentions.push(s.user_id || s.id);
      }
    });

    const msg = text;
    setText("");
    setMentionMode(false);
    
    try {
      await api.post("/chat/messages", { message: msg, mentions });
      fetchMessages();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteMessage = async (msgId, forEveryone) => {
    try {
      await api.delete(`/chat/messages/${msgId}?for_everyone=${forEveryone}`);
      setActiveMenu(null);
      fetchMessages();
    } catch (err) {
      console.error(err);
    }
  };

  const clearChat = async () => {
    if (!window.confirm("Are you sure you want to clear your chat history?")) return;
    try {
      await api.delete("/chat/clear");
      fetchMessages();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
      <button 
        onClick={() => setOpen(true)}
        className={`fixed bottom-6 right-6 w-14 h-14 bg-emerald-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-emerald-700 transition-transform hover:scale-105 z-50 ${open ? 'hidden' : ''}`}
      >
        <MessageCircle size={28} />
        {unread && (
          <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 border-2 border-white rounded-full"></span>
        )}
      </button>

      {open && (
        <div className="fixed bottom-6 right-6 w-[360px] h-[500px] bg-white rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden border border-slate-200 flex-col animate-in slide-in-from-bottom-5">
          <div className="h-14 bg-emerald-600 px-4 flex items-center justify-between text-white shadow-md z-10">
            <div className="flex items-center gap-2">
              <MessageCircle size={20} />
              <span className="font-heading font-semibold text-lg">Team Chat</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={clearChat} title="Clear Chat" className="text-emerald-100 hover:text-white transition-colors">
                <Trash2 size={18} />
              </button>
              <button onClick={() => setOpen(false)} className="text-emerald-100 hover:text-white transition-colors ml-1">
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 relative" onClick={() => setActiveMenu(null)}>
            {messages.map((m) => {
              const isMe = m.sender_id === user.id;
              const canDeleteEveryone = isMe || user.role === "admin";
              
              return (
                <div key={m.id} className={`flex flex-col relative group ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className={`flex items-center gap-2 mb-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                    <span className="text-[10px] font-semibold text-slate-500">{m.sender_name}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${m.sender_role === 'admin' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'}`}>
                      {m.sender_role}
                    </span>
                  </div>
                  
                  <div className={`flex items-center gap-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`max-w-[220px] rounded-2xl px-4 py-2 text-sm break-words ${isMe ? 'bg-emerald-600 text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none shadow-sm'}`}>
                      {m.message}
                    </div>
                    
                    <div className="relative">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === m.id ? null : m.id); }}
                        className={`text-slate-400 hover:text-slate-600 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${activeMenu === m.id ? 'opacity-100' : ''}`}
                      >
                        <MoreVertical size={16} />
                      </button>
                      
                      {activeMenu === m.id && (
                        <div className={`absolute top-full z-20 w-40 bg-white border border-slate-200 shadow-xl rounded-xl py-1 mt-1 ${isMe ? 'right-0' : 'left-0'}`}>
                          <button onClick={() => deleteMessage(m.id, false)} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                            Delete for me
                          </button>
                          {canDeleteEveryone && (
                            <button onClick={() => deleteMessage(m.id, true)} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-slate-50">
                              Delete for everyone
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <div className="relative border-t border-slate-200 bg-white p-3">
            {mentionMode && (
              <div className="absolute bottom-full mb-2 left-0 w-full bg-white border border-slate-200 shadow-xl rounded-xl max-h-48 overflow-y-auto z-20">
                {staffList.filter(s => s.name.toLowerCase().includes(mentionQuery)).map(staff => (
                  <button 
                    key={staff.id} 
                    type="button"
                    onClick={() => insertMention(staff)}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-sm"
                  >
                    <Avatar src={staff.photo} name={staff.name} size={24} />
                    <span className="font-medium text-slate-700">{staff.name}</span>
                    <span className="text-xs text-slate-400">{staff.designation}</span>
                  </button>
                ))}
              </div>
            )}
            <form onSubmit={send} className="flex items-center gap-2">
              <input
                id="chat-input"
                type="text"
                placeholder="Type a message (use @ to mention)..."
                value={text}
                onChange={handleTextChange}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none focus:border-emerald-500 text-sm"
                autoComplete="off"
              />
              <button 
                type="submit" 
                disabled={!text.trim()}
                className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 disabled:opacity-50 hover:bg-emerald-700 transition-colors"
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
