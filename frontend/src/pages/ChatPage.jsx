import React, { useState, useEffect, useRef } from "react";
import { MessageCircle, Send, MoreVertical, Trash2, Users } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Avatar } from "@/components/common";
import { format } from "date-fns";

export default function ChatPage() {
  const { user } = useAuth();
  const [activeChat, setActiveChat] = useState("group"); // "group" or employee user_id
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [staffList, setStaffList] = useState([]);
  const [activeMenu, setActiveMenu] = useState(null);
  const [mentionMode, setMentionMode] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [drafts, setDrafts] = useState({});
  
  const messagesEndRef = useRef(null);
  const lastMsgIdRef = useRef(null);

  const fetchMessages = async () => {
    if (!activeChat) return;
    try {
      const { data } = await api.get(`/chat/messages?recipient_id=${activeChat}`);
      setMessages(data);
      await api.put(`/chat/read/${activeChat}`).catch(() => {});
      
      if (data.length > 0) {
        const lastMsg = data[data.length - 1];
        if (lastMsgIdRef.current && lastMsgIdRef.current !== lastMsg.id) {
          if (lastMsg.sender_id !== user.id) {
            const audio = new Audio("/ringtone/text_message.mp3");
            audio.play().catch(e => console.log("Audio play blocked"));
          }
        }
        lastMsgIdRef.current = lastMsg.id;
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStaff = async () => {
    try {
      const { data } = await api.get("/chat/contacts");
      setStaffList(data);
    } catch (err) { }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  // Poll for messages in the active chat
  useEffect(() => {
    lastMsgIdRef.current = null;
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [activeChat]);

  // Load draft when switching chats
  useEffect(() => {
    setText(drafts[activeChat] || "");
    setMentionMode(false);
  }, [activeChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleTextChange = (e) => {
    const val = e.target.value;
    setText(val);
    setDrafts(prev => ({ ...prev, [activeChat]: val }));
    
    if (activeChat === "group") {
      const lastWord = val.split(" ").pop();
      if (lastWord.startsWith("@")) {
        setMentionMode(true);
        setMentionQuery(lastWord.slice(1).toLowerCase());
      } else {
        setMentionMode(false);
      }
    } else {
      setMentionMode(false);
    }
  };

  const insertMention = (staff) => {
    const words = text.split(" ");
    words.pop();
    setText(words.join(" ") + (words.length > 0 ? " " : "") + `@${staff.name} `);
    setMentionMode(false);
    document.getElementById("chat-input")?.focus();
  };

  const playSendSound = () => {
    if (!window.sendAudioInstance) {
      window.sendAudioInstance = new Audio("/ringtone/ElevenLabs_Bubble_pop_new_message_sound,_playful_and_light.mp3");
    }
    window.sendAudioInstance.pause();
    window.sendAudioInstance.currentTime = 0;
    window.sendAudioInstance.play().catch(e => console.log("Audio play blocked"));
  };

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    
    const mentions = [];
    if (activeChat === "group") {
      staffList.forEach(s => {
        if (text.includes(`@${s.name}`)) {
          mentions.push(s.user_id || s.id);
        }
      });
    }

    const msg = text;
    setText("");
    setDrafts(prev => ({ ...prev, [activeChat]: "" }));
    setMentionMode(false);
    
    playSendSound();
    
    try {
      await api.post("/chat/messages", { 
        message: msg, 
        mentions: mentions, 
        recipient_id: activeChat 
      });
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
    if (!window.confirm("Are you sure you want to clear your chat history for this conversation?")) return;
    try {
      await api.delete(`/chat/clear?recipient_id=${activeChat}`);
      fetchMessages();
    } catch (err) {
      console.error(err);
    }
  };

  const activeUser = activeChat === "group" ? null : staffList.find(s => (s.user_id || s.id) === activeChat);

  return (
    <div className="h-[calc(100vh-6rem)] bg-white rounded-2xl border border-slate-200 overflow-hidden flex shadow-sm">
      {/* Sidebar - Contacts List */}
      <div className="w-1/3 md:w-80 border-r border-slate-200 flex flex-col bg-slate-50/50">
        <div className="p-4 border-b border-slate-200 bg-white">
          <h2 className="font-heading font-bold text-xl text-slate-800">Chats</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {/* Staff Group Chat */}
          <div 
            onClick={() => setActiveChat("group")}
            className={`p-4 flex items-center gap-3 cursor-pointer transition-colors border-b border-slate-100 ${activeChat === "group" ? "bg-emerald-50" : "hover:bg-slate-100"}`}
          >
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
              <Users size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-slate-800 truncate">Staff Group</h3>
              <p className="text-xs text-slate-500 truncate">All team members</p>
            </div>
          </div>

          {/* Individual Staff Members */}
          <div className="px-4 pt-4 pb-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Direct Messages</p>
          </div>
          {staffList.map(staff => {
            const uid = staff.user_id || staff.id;
            return (
              <div 
                key={uid}
                onClick={() => setActiveChat(uid)}
                className={`p-3 mx-2 rounded-xl flex items-center gap-3 cursor-pointer transition-colors ${activeChat === uid ? "bg-emerald-50" : "hover:bg-slate-100"}`}
              >
                <div className="relative shrink-0">
                  <Avatar name={staff.name} size={42} />
                  {/* Online/Offline indicator */}
                  <span className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-white rounded-full ${uid.charCodeAt(uid.length - 1) % 2 === 0 ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-slate-800 truncate">{staff.name}</h3>
                  <p className="text-xs text-slate-400 truncate">
                    {staff.role === "admin" ? "Admin" : (staff.designation || "Staff")}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-[#F0F2F5] relative">
        {/* Chat Header */}
        <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center gap-4">
            {activeChat === "group" ? (
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                <Users size={20} />
              </div>
            ) : (
              <Avatar name={activeUser?.name || "Unknown"} size={40} />
            )}
            <div>
              <h3 className="font-heading font-semibold text-slate-800 text-lg">
                {activeChat === "group" ? "Staff Group" : activeUser?.name}
              </h3>
              <p className="text-xs text-slate-500">
                {activeChat === "group" ? "Company-wide announcements & chat" : (activeUser?.role === "admin" ? "Admin" : (activeUser?.designation || "Staff"))}
              </p>
            </div>
          </div>
          <button onClick={clearChat} className="text-xs font-medium text-slate-500 hover:text-red-500 transition-colors bg-slate-100 hover:bg-red-50 px-3 py-1.5 rounded-lg">
            Clear Chat
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4" style={{ backgroundImage: 'url("https://web.whatsapp.com/img/bg-chat-tile-dark_a4be512e7195b6b733d9110b408f075d.png")', opacity: 0.9 }}>
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <div className="bg-white/80 backdrop-blur-sm px-6 py-3 rounded-full text-sm text-slate-500 font-medium shadow-sm">
                No messages yet. Send a message to start the conversation!
              </div>
            </div>
          )}
          {messages.map((msg, i) => {
            const isMe = msg.sender_id === user.id;
            const time = new Date(msg.created_at);
            const showName = !isMe && activeChat === "group" && (i === 0 || messages[i-1].sender_id !== msg.sender_id);
            
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className={`group relative max-w-[75%] rounded-2xl px-4 py-2 shadow-sm ${isMe ? 'bg-[#E7FFDB] text-slate-800 rounded-tr-sm' : 'bg-white text-slate-800 rounded-tl-sm'}`}>
                  {showName && (
                    <p className="text-[11px] font-semibold text-emerald-600 mb-1">{msg.sender_name}</p>
                  )}
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                  <p className="text-[10px] text-slate-400 text-right mt-1.5">{format(time, "HH:mm")}</p>

                  {/* Menu */}
                  <div className={`absolute top-1 ${isMe ? '-left-8' : '-right-8'} opacity-0 group-hover:opacity-100 transition-opacity`}>
                    <button onClick={() => setActiveMenu(activeMenu === msg.id ? null : msg.id)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100/50">
                      <MoreVertical size={16} />
                    </button>
                    {activeMenu === msg.id && (
                      <div className={`absolute top-8 ${isMe ? 'right-0' : 'left-0'} bg-white shadow-xl rounded-xl border border-slate-100 overflow-hidden z-20 min-w-[160px]`}>
                        <button onClick={() => deleteMessage(msg.id, false)} className="w-full px-4 py-2.5 text-left text-xs font-medium hover:bg-slate-50 flex items-center gap-2">
                          <Trash2 size={14} className="text-slate-400" /> Delete for me
                        </button>
                        {(isMe || user.role === "admin") && (
                          <button onClick={() => deleteMessage(msg.id, true)} className="w-full px-4 py-2.5 text-left text-xs font-medium hover:bg-red-50 text-red-600 flex items-center gap-2 border-t border-slate-50">
                            <Trash2 size={14} /> Delete for everyone
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

        {/* Input */}
        <div className="bg-[#F0F2F5] px-6 py-4 flex gap-4 shrink-0 relative">
          {/* Mention Dropdown */}
          {mentionMode && activeChat === "group" && (
            <div className="absolute bottom-full left-6 mb-2 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto w-64 z-20">
              {staffList.filter(s => s.name.toLowerCase().includes(mentionQuery)).map(s => (
                <div 
                  key={s.id} 
                  onClick={() => insertMention(s)}
                  className="px-4 py-2 hover:bg-slate-50 cursor-pointer flex items-center gap-3"
                >
                  <Avatar name={s.name} size={24} />
                  <span className="text-sm font-medium text-slate-700">{s.name}</span>
                </div>
              ))}
              {staffList.filter(s => s.name.toLowerCase().includes(mentionQuery)).length === 0 && (
                <div className="px-4 py-3 text-sm text-slate-400 text-center">No staff found</div>
              )}
            </div>
          )}
          
          <form onSubmit={send} className="flex-1 flex gap-3">
            <input 
              id="chat-input"
              type="text"
              className="flex-1 bg-white rounded-full px-6 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm border-none"
              placeholder="Type a message..."
              value={text}
              onChange={handleTextChange}
            />
            <button 
              type="submit"
              disabled={!text.trim()}
              className="w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center text-white shrink-0 shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              <Send size={18} className="ml-1" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
