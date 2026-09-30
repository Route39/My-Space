import { useEffect, useState, useRef } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  Users, Clock, KanbanSquare, Palmtree, Wallet, Settings, Bell, LogOut,
  Home, User, PanelLeftClose, PanelLeft, NotebookPen, MessageCircle, X
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { Avatar } from "@/components/common";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const ALL_NAV = [
  { to: "/", label: "Dashboard", icon: Home, roles: ["admin", "team_leader", "staff"] },
  { to: "/staff", label: "Staff", icon: Users, roles: ["admin", "team_leader"] },
  { to: "/attendance", label: "Attendance", icon: Clock, roles: ["admin", "team_leader", "staff"] },
  { to: "/tasks", label: "Tasks", icon: KanbanSquare, roles: ["admin", "team_leader", "staff"] },
  { to: "/myspace", label: "My Space", icon: NotebookPen, roles: ["admin", "team_leader", "staff"] },
  { to: "/leave", label: "Leave", icon: Palmtree, roles: ["admin", "team_leader", "staff"] },
  { to: "/chat", label: "Chat", icon: MessageCircle, roles: ["admin", "team_leader", "staff"] },
  { to: "/payroll", label: "Payslip", icon: Wallet, roles: ["admin", "team_leader"] },
  { to: "/payslip", label: "Payslip", icon: Wallet, roles: ["staff"] },
  { to: "/settings", label: "Settings", icon: Settings, roles: ["admin"] },
];

const TITLES = {
  "/": "Dashboard", "/staff": "Staff", "/attendance": "Attendance", "/tasks": "Tasks",
  "/leave": "Leave", "/chat": "Chat", "/payroll": "Payslip", "/payslip": "My Payslip", "/settings": "Settings", "/profile": "My Profile",
};

function NotificationBell() {
  const [items, setItems] = useState([]);
  const lastNoteIdRef = useRef(null);

  const load = async () => { 
    try { 
      const { data } = await api.get("/notifications"); 
      setItems(data); 
      
      if (data.length > 0) {
        const first = data[0];
        if (lastNoteIdRef.current && lastNoteIdRef.current !== first.id && !first.read) {
          if (first.type === "announcement") {
            const audio = new Audio("/ringtone/please_pay_attention.mp3");
            audio.play().catch(e => console.log("Audio play blocked"));
          }
        }
        lastNoteIdRef.current = first.id;
      }
    } catch (e) {} 
  };
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);
  const unread = items.filter((i) => !i.read).length;
  const markAll = async () => { await api.put("/notifications/read-all"); load(); };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button data-testid="notification-bell" className="relative p-2.5 rounded-xl hover:bg-slate-100 transition-colors">
          <Bell className="w-5 h-5 text-slate-600" strokeWidth={1.75} />
          {unread > 0 && <span className="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 rounded-full bg-emerald-500 text-white text-[10px] flex items-center justify-center font-medium">{unread}</span>}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <span className="font-heading font-semibold text-slate-800">Notifications</span>
          {unread > 0 && <button onClick={markAll} data-testid="mark-all-read" className="text-xs text-emerald-600 font-medium">Mark all read</button>}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 && <div className="px-4 py-10 text-center text-sm text-slate-400">You're all caught up 🎉</div>}
          {items.map((n) => (
            <div key={n.id} className={`px-4 py-3 border-b border-slate-50 flex gap-3 ${n.read ? "" : "bg-emerald-50/50"}`}>
              {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />}
              <div className={n.read ? "pl-4" : ""}>
                <p className="text-sm text-slate-700">{n.message}</p>
                <p className="text-xs text-slate-400 mt-0.5">{new Date(n.created_at).toLocaleString("en-IN")}</p>
              </div>
            </div>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ReminderDaemon() {
  const [activeReminders, setActiveReminders] = useState([]);
  const audioRef = useRef(null);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio("/ringtone/reminder.mp3");
      audioRef.current.loop = true;
    }
    
    const load = async () => {
      try {
        const { data } = await api.get("/myspace/active_reminders");
        setActiveReminders(data);
        if (data.length > 0) {
          if (audioRef.current.paused) {
            audioRef.current.play().catch(e => console.log("Audio block: user interaction needed"));
          }
        } else {
          if (!audioRef.current.paused) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
          }
        }
      } catch (e) {}
    };
    
    load();
    const t = setInterval(load, 10000); // check every 10s
    return () => clearInterval(t);
  }, []);

  const snooze = async (id) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setActiveReminders(prev => prev.filter(r => r.id !== id));
    
    await api.put(`/myspace/${id}/snooze`);
    const { data } = await api.get("/myspace/active_reminders");
    setActiveReminders(data);
  };

  const dismiss = async (id) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setActiveReminders(prev => prev.filter(r => r.id !== id));
    
    await api.put(`/myspace/${id}/dismiss`);
    const { data } = await api.get("/myspace/active_reminders");
    setActiveReminders(data);
  };

  if (activeReminders.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-6 md:left-[280px] z-[100] flex flex-col gap-3 max-w-sm w-full transition-all duration-300">
      {activeReminders.map(r => (
        <div key={r.id} className="bg-white rounded-2xl shadow-2xl border border-emerald-100 p-5 animate-in slide-in-from-bottom-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 animate-pulse"></div>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 mt-0.5">
              <Bell className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-slate-800 text-lg">Reminder</h3>
              <p className="text-sm text-slate-600 mt-0.5 font-medium">{r.title}</p>
              {r.content && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{r.content}</p>}
            </div>
          </div>
          <div className="flex gap-2 mt-4 ml-13 pl-12">
            <Button onClick={() => dismiss(r.id)} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs h-9">
              Open Now
            </Button>
            <Button onClick={() => snooze(r.id)} variant="outline" className="flex-1 rounded-xl text-xs h-9 border-slate-200 hover:bg-slate-50 text-slate-600">
              Snooze 5m
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
function formatTime12h(time24) {
  if (!time24) return "";
  const [h, m] = time24.split(":");
  let hours = parseInt(h, 10);
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${m} ${ampm}`;
}

function NoticeDaemon() {
  const { user } = useAuth();
  const [notices, setNotices] = useState([]);
  const [unseenNotices, setUnseenNotices] = useState([]);

  useEffect(() => {
    if (user?.role === "admin" || user?.role === "admin_staff") return;
    const load = async () => {
      try {
        const { data } = await api.get("/notices/active");
        setNotices(data);
        
        let seen = [];
        try { seen = JSON.parse(localStorage.getItem("seen_notices") || "[]"); } catch(e){}
        
        const unseen = data.filter(n => !seen.includes(n.id));
        setUnseenNotices(unseen);
      } catch (e) {}
    };
    load();
    const t = setInterval(load, 30000); // Check every 30s for brand new notices
    return () => clearInterval(t);
  }, [user?.role]);

  const handleDismiss = () => {
    let seen = [];
    try { seen = JSON.parse(localStorage.getItem("seen_notices") || "[]"); } catch(e){}
    const newSeen = [...new Set([...seen, ...unseenNotices.map(n => n.id)])];
    localStorage.setItem("seen_notices", JSON.stringify(newSeen));
    setUnseenNotices([]);
  };

  if (user?.role === "admin" || user?.role === "admin_staff" || unseenNotices.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(8px)'}}>
      <div className="relative w-full max-w-lg animate-in zoom-in-95 duration-300">
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute -top-3 -right-3 z-10 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:scale-110 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="rounded-3xl overflow-hidden shadow-2xl" style={{background: 'linear-gradient(135deg, #064e3b 0%, #047857 30%, #10b981 100%)'}}>
          {/* Header with Route 39 branding */}
          <div className="flex flex-col items-center pt-8 pb-4 px-6">
            <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-xl flex items-center justify-center shadow-lg mb-4 ring-4 ring-white/10 p-3">
              <img src="/favicon.svg" alt="Route 39" className="w-full h-full object-contain drop-shadow-md" />
            </div>
            <h2 className="text-white font-heading text-2xl font-bold tracking-tight">Route 39</h2>
            <p className="text-emerald-200 text-sm mt-1 font-medium">Important Notice</p>
          </div>

          {/* Divider sparkle */}
          <div className="flex items-center px-5 sm:px-8 gap-3">
            <div className="flex-1 h-px bg-white/20" />
            <div className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
            <div className="flex-1 h-px bg-white/20" />
          </div>

          {/* Message area */}
          <div className="px-5 sm:px-8 py-5 sm:py-6 max-h-[50vh] overflow-y-auto custom-scrollbar">
            {unseenNotices.map((n) => (
              <div key={n.id} className="bg-white/15 backdrop-blur-sm rounded-2xl p-5 mb-3 last:mb-0 border border-white/10">
                <p className="text-white text-base leading-relaxed whitespace-pre-wrap font-medium">{n.message}</p>
                {(n.from_date || n.to_date || n.from_time || n.to_time) && (
                  <div className="mt-4 pt-3 border-t border-white/20 flex flex-col gap-1">
                    {(n.from_date || n.to_date) && (
                      <p className="text-emerald-100 text-sm font-medium">📅 Date: <span className="text-white">
                        {[n.from_date, n.to_date].filter(Boolean).join(" to ")}
                      </span></p>
                    )}
                    {(n.from_time || n.to_time) && (
                      <p className="text-emerald-100 text-sm font-medium">🕒 Time: <span className="text-white">
                        {[n.from_time ? formatTime12h(n.from_time) : null, n.to_time ? formatTime12h(n.to_time) : null].filter(Boolean).join(" to ")}
                      </span></p>
                    )}
                  </div>
                )}
                <p className="text-emerald-200/70 text-xs mt-3">— {n.created_by} • Posted {new Date(n.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-5 sm:px-8 pb-5 sm:pb-6">
            <button
              onClick={handleDismiss}
              className="w-full py-3.5 rounded-2xl bg-white text-emerald-800 font-heading font-bold text-sm hover:bg-emerald-50 transition-all shadow-lg active:scale-[0.98]"
            >
              Got it, Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Layout({ children }) {
  const { user, employee, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(localStorage.getItem("myspace_collapsed") === "1");
  const [unreadChat, setUnreadChat] = useState(0);
  const isFirstLoadRef = useRef(true);
  const prevUnreadTimeRef = useRef(0);
  const soundDebounceRef = useRef(false);

  useEffect(() => {
    // Request desktop notification permission so it works flawlessly in background tabs
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    
    // Global debounced sound player to perfectly prevent multiple overlapping sounds
    window.playChatSound = () => {
      const now = Date.now();
      if (window.lastChatSoundTime && now - window.lastChatSoundTime < 2000) return;
      window.lastChatSoundTime = now;
      const audio = new Audio("/ringtone/text_message.mp3");
      audio.play().catch(e => console.log("Audio blocked"));
    };

    const fetchUnreadChat = async () => {
      try {
        const { data } = await api.get("/chat/unread_count");
        const count = data.count || 0;
        const newMsgTime = data.latest_time ? new Date(data.latest_time).getTime() : 0;
        
        // If there's a genuinely newer message, play the global sound
        if (!isFirstLoadRef.current && newMsgTime > prevUnreadTimeRef.current) {
          window.playChatSound?.();
          
          // Show a Desktop notification if they are in another tab!
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("New Message in MySpace", {
              body: "You have received a new chat message.",
              icon: "/favicon.ico"
            });
          }
        }
        
        isFirstLoadRef.current = false;
        prevUnreadTimeRef.current = newMsgTime;
        setUnreadChat(count);
      } catch (e) {}
    };
    fetchUnreadChat();
    const t = setInterval(fetchUnreadChat, 3000); // Poll every 3 seconds for exact instantaneous sound
    return () => clearInterval(t);
  }, [location.pathname]);

  const nav = ALL_NAV.filter((n) => n.roles.includes(user.role) || user.role === "admin_staff");
  const roleLabel = { admin: "Admin", admin_staff: "Admin", team_leader: "Team Leader", staff: "Staff" }[user.role];
  const title = TITLES[location.pathname] || (location.pathname.startsWith("/staff/") ? "Staff" : "MySpace");
  const payrollTo = user.role === "staff" ? "/payslip" : "/payroll";
  const MOBILE_NAV = [
    { to: "/", label: "Home", icon: Home },
    { to: "/attendance", label: "Attendance", icon: Clock },
    { to: "/tasks", label: "Tasks", icon: KanbanSquare },
    { to: "/myspace", label: "My Space", icon: NotebookPen },
    { to: "/profile", label: "Profile", icon: User },
  ];
  const toggle = () => { const v = !collapsed; setCollapsed(v); localStorage.setItem("myspace_collapsed", v ? "1" : "0"); };
  const sw = collapsed ? "md:w-20" : "md:w-64";
  const pad = collapsed ? "md:pl-20" : "md:pl-64";

  return (
    <div className="min-h-screen bg-[#F6F8FA]">
      <aside className={`hidden md:flex fixed inset-y-0 left-0 ${sw} bg-white border-r border-slate-200 flex-col z-30 transition-all duration-300`}>
        <div className={`px-5 py-6 flex items-center gap-2.5 ${collapsed ? "justify-center px-0" : ""}`}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/25 shrink-0">
            <Clock className="w-5 h-5 text-white" strokeWidth={2} />
          </div>
          {!collapsed && <div><p className="font-heading font-bold text-lg text-slate-900 leading-none">MySpace</p><p className="text-[10px] text-slate-400 mt-0.5">Attendance · Work · Payroll</p></div>}
        </div>
        <nav className="flex-1 px-3 space-y-1 mt-2">
          {nav.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 mx-3 rounded-xl transition-all duration-200 group relative ${isActive ? "bg-emerald-50 text-emerald-600 font-medium" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}
            >
              <item.icon className="w-5 h-5 shrink-0" strokeWidth={1.75} />
              {!collapsed && <span>{item.label}</span>}
              {collapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                  {item.label}
                </div>
              )}
              {item.label === "Chat" && unreadChat > 0 && (
                <span className={`absolute ${collapsed ? "top-1 right-1" : "right-3"} min-w-4 h-4 px-1 rounded-full bg-emerald-500 text-white text-[10px] flex items-center justify-center font-medium shadow-sm ring-2 ring-white`}>
                  {unreadChat}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-100 space-y-1">
          <button onClick={toggle} data-testid="sidebar-toggle" className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-100 w-full transition-colors ${collapsed ? "justify-center" : ""}`}>
            {collapsed ? <PanelLeft className="w-[18px] h-[18px]" /> : <><PanelLeftClose className="w-[18px] h-[18px]" /> Collapse</>}
          </button>
          <button onClick={() => { logout(); navigate("/login"); }} data-testid="logout-btn"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-red-50 hover:text-red-600 w-full transition-colors ${collapsed ? "justify-center" : ""}`}>
            <LogOut className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
            {!collapsed && "Logout"}
          </button>
        </div>
      </aside>

      <div className={`${pad} transition-all duration-300`}>
        <header className="sticky top-0 z-20 backdrop-blur-xl bg-white/75 border-b border-slate-200">
          <div className="flex items-center justify-between px-4 md:px-8 h-16">
            <div className="flex items-center gap-2">
              <div className="md:hidden w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center"><Clock className="w-4 h-4 text-white" /></div>
              <h1 className="font-heading text-lg font-semibold text-slate-800 hidden md:block">{title}</h1>
              <span className="font-heading font-bold text-slate-900 md:hidden">MySpace</span>
            </div>
            <div className="flex items-center gap-1">
              <NotificationBell />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button data-testid="profile-menu" className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-xl hover:bg-slate-100 transition-colors">
                    <Avatar src={employee?.photo} name={user.name} size={34} />
                    <div className="hidden sm:block text-left"><p className="text-sm font-medium text-slate-800 leading-none">{user.name}</p><p className="text-[11px] text-slate-400 mt-0.5">{roleLabel}</p></div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 rounded-2xl p-1">
                  <button onClick={() => navigate("/profile")} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100"><User className="w-4 h-4" /> My Profile</button>
                  <button onClick={() => { logout(); navigate("/login"); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50"><LogOut className="w-4 h-4" /> Logout</button>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="px-4 md:px-8 py-6 pb-28 md:pb-10 max-w-[1200px] mx-auto fade-in" key={location.pathname}>{children}</main>
      </div>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 backdrop-blur-xl bg-white/90 border-t border-slate-200">
        <div className="flex items-center justify-around px-1 py-2">
          {MOBILE_NAV.map((item) => (
            <NavLink key={item.label} to={item.to} end={item.to === "/"} data-testid={`mnav-${item.label.toLowerCase()}`}
              className={({ isActive }) => `relative flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg ${isActive ? "text-emerald-600" : "text-slate-400"}`}>
              <item.icon className="w-5 h-5" strokeWidth={1.75} />
              <span className="text-[10px] font-medium">{item.label}</span>
              {item.label === "Chat" && unreadChat > 0 && (
                <span className="absolute top-0 right-1 min-w-3.5 h-3.5 px-1 rounded-full bg-emerald-500 text-white text-[9px] flex items-center justify-center font-medium ring-2 ring-white">
                  {unreadChat}
                </span>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
      <ReminderDaemon />
      <NoticeDaemon />
    </div>
  );
}
