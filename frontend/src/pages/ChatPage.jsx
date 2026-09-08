import React, { useState, useEffect, useRef } from "react";
import { MessageCircle, Send, MoreVertical, Trash2, Users, Settings } from "lucide-react";
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
  const [groups, setGroups] = useState([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupMembers, setNewGroupMembers] = useState([]);
  const [editGroupId, setEditGroupId] = useState(null);

  const messagesEndRef = useRef(null);
  const lastMsgIdsRef = useRef({});
  const activeChatRef = useRef(activeChat);

  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  const fetchMessages = async () => {
    const currentChat = activeChatRef.current;
    if (!currentChat) return;
    try {
      const { data } = await api.get(`/chat/messages?recipient_id=${activeChat}`);
      // Prevent state updates if we switched chats while the request was pending
      if (activeChatRef.current !== currentChat) return;

      setMessages(data);
      await api.put(`/chat/read/${currentChat}`).catch(() => { });

      if (data.length > 0) {
        const lastMsg = data[data.length - 1];
        const knownLastId = lastMsgIdsRef.current[currentChat];

        if (knownLastId && knownLastId !== lastMsg.id) {
          if (lastMsg.sender_id !== user.id) {
            window.playChatSound?.();
          }
        }
        lastMsgIdsRef.current[currentChat] = lastMsg.id;
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

  const fetchGroups = async () => {
    try {
      const { data } = await api.get("/chat/groups");
      setGroups(data);
      if (activeChat === "group") {
        if (data.length > 0) setActiveChat(data[0].id);
      }
    } catch (err) { }
  };

  useEffect(() => {
    fetchStaff();
    fetchGroups();
  }, []);

  // Poll for messages in the active chat
  useEffect(() => {
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
    if (activeChat === "group" || activeChat.startsWith("grp_")) {
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

  const saveGroup = async () => {
    if (!newGroupName.trim() || newGroupMembers.length === 0) return;
    try {
      if (editGroupId) {
        await api.put(`/chat/groups/${editGroupId}`, {
          name: newGroupName,
          members: newGroupMembers
        });
      } else {
        await api.post("/chat/groups", {
          name: newGroupName,
          members: newGroupMembers
        });
      }
      setShowCreateGroup(false);
      setNewGroupName("");
      setNewGroupMembers([]);
      setEditGroupId(null);
      fetchGroups();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteGroup = async () => {
    if (!window.confirm("Are you sure you want to permanently delete this group and all its messages?")) return;
    try {
      await api.delete(`/chat/groups/${editGroupId}`);
      setShowCreateGroup(false);
      setEditGroupId(null);
      setActiveChat("group"); 
      fetchGroups();
    } catch (err) {
      console.error(err);
    }
  };

  const openCreateGroup = () => {
    setEditGroupId(null);
    setNewGroupName("");
    setNewGroupMembers([]);
    setShowCreateGroup(true);
  };

  const activeUser = activeChat === "group" ? null : staffList.find(s => (s.user_id || s.id) === activeChat);
  const activeGroup = groups.find(g => g.id === activeChat);

  const openEditGroup = () => {
    if (!activeGroup) return;
    setEditGroupId(activeGroup.id);
    setNewGroupName(activeGroup.name);
    setNewGroupMembers(activeGroup.members);
    setShowCreateGroup(true);
  };

  return (
    <div className="h-[calc(100vh-6rem)] bg-white rounded-2xl border border-slate-200 overflow-hidden flex shadow-sm">
      {/* Sidebar - Contacts List */}
      <div className="w-1/3 md:w-80 border-r border-slate-200 flex flex-col bg-slate-50/50">
        <div className="p-4 border-b border-slate-200 bg-white">
          <h2 className="font-heading font-bold text-xl text-slate-800">Chats</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {/* Custom Groups */}
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Groups</p>
            {(user.role === "admin" || user.role === "admin_staff") && (
              <button
                onClick={openCreateGroup}
                className="text-xs text-emerald-600 font-medium hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-md transition-colors"
              >
                + New Group
              </button>
            )}
          </div>
          {groups.map(g => (
            <div
              key={g.id}
              onClick={() => setActiveChat(g.id)}
              className={`p-3 mx-2 rounded-xl flex items-center gap-3 cursor-pointer transition-colors ${activeChat === g.id ? "bg-emerald-50" : "hover:bg-slate-100"}`}
            >
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                <Users size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-800 truncate">{g.name}</h3>
                <p className="text-xs text-slate-500 truncate">{g.members.length} members</p>
              </div>
            </div>
          ))}
          {groups.length === 0 && (
            <div className="px-4 py-2 text-xs text-slate-400 italic">No groups yet</div>
          )}

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
            {activeGroup ? (
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                <Users size={20} />
              </div>
            ) : (
              <Avatar name={activeUser?.name || "Unknown"} size={40} />
            )}
            <div>
              <h3 className="font-heading font-semibold text-slate-800 text-lg flex items-center gap-2">
                {activeGroup ? activeGroup.name : activeUser?.name}
                {activeGroup && (user.role === "admin" || user.role === "admin_staff") && (
                  <button onClick={openEditGroup} className="text-slate-400 hover:text-emerald-600 transition-colors p-1" title="Group Settings">
                    <Settings size={16} />
                  </button>
                )}
              </h3>
              <p className="text-xs text-slate-500">
                {activeGroup ? `${activeGroup.members.length} members` : (activeUser?.role === "admin" ? "Admin" : (activeUser?.designation || "Staff"))}
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
            const isGroup = activeGroup || activeChat === "group";
            const showName = !isMe && isGroup && (i === 0 || messages[i - 1].sender_id !== msg.sender_id);

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
          {mentionMode && (activeGroup || activeChat === "group") && (
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

      {/* Create/Edit Group Modal */}
      {showCreateGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-heading font-semibold text-slate-800 text-lg">{editGroupId ? "Edit Group" : "Create New Group"}</h3>
              <button onClick={() => setShowCreateGroup(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <Trash2 size={18} className="rotate-45" />
                <span className="sr-only">Close</span>
              </button>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-slate-700 mb-1">Group Name</label>
              <input
                type="text"
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                placeholder="e.g. Marketing Team"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-5"
              />

              <label className="block text-sm font-medium text-slate-700 mb-2">Select Members</label>
              <div className="max-h-60 overflow-y-auto border border-slate-100 rounded-xl bg-slate-50/50 p-2 space-y-1">
                {staffList.map(staff => {
                  const uid = staff.user_id || staff.id;
                  const isSelected = newGroupMembers.includes(uid);
                  return (
                    <label key={uid} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) setNewGroupMembers([...newGroupMembers, uid]);
                          else setNewGroupMembers(newGroupMembers.filter(id => id !== uid));
                        }}
                        className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                      />
                      <Avatar name={staff.name} size={28} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{staff.name}</p>
                        <p className="text-xs text-slate-500 truncate">{staff.designation || staff.role}</p>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="mt-6 flex gap-3">
                {editGroupId && (
                  <button onClick={deleteGroup} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors">
                    Delete Group
                  </button>
                )}
                {!editGroupId && (
                  <button onClick={() => setShowCreateGroup(false)} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
                    Cancel
                  </button>
                )}
                <button
                  onClick={saveGroup}
                  disabled={!newGroupName.trim() || newGroupMembers.length === 0}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  {editGroupId ? "Save Changes" : "Create Group"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
