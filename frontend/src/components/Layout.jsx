import { useEffect, useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  Users, Clock, KanbanSquare, Palmtree, Wallet, Settings, Bell, LogOut,
  Home, User, PanelLeftClose, PanelLeft, NotebookPen,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { Avatar } from "@/components/common";
import ChatWidget from "./ChatWidget";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ALL_NAV = [
  { to: "/", label: "Dashboard", icon: Home, roles: ["admin", "team_leader", "staff"] },
  { to: "/staff", label: "Staff", icon: Users, roles: ["admin", "team_leader"] },
  { to: "/attendance", label: "Attendance", icon: Clock, roles: ["admin", "team_leader", "staff"] },
  { to: "/tasks", label: "Tasks", icon: KanbanSquare, roles: ["admin", "team_leader", "staff"] },
  { to: "/myspace", label: "My Space", icon: NotebookPen, roles: ["admin", "team_leader", "staff"] },
  { to: "/leave", label: "Leave", icon: Palmtree, roles: ["admin", "team_leader", "staff"] },
  { to: "/payroll", label: "Payroll", icon: Wallet, roles: ["admin", "team_leader"] },
  { to: "/payslip", label: "Payslip", icon: Wallet, roles: ["staff"] },
  { to: "/settings", label: "Settings", icon: Settings, roles: ["admin"] },
];

const TITLES = {
  "/": "Dashboard", "/staff": "Staff", "/attendance": "Attendance", "/tasks": "Tasks",
  "/leave": "Leave", "/payroll": "Payroll", "/payslip": "My Payslip", "/settings": "Settings", "/profile": "My Profile",
};

function NotificationBell() {
  const [items, setItems] = useState([]);
  const load = async () => { try { const { data } = await api.get("/notifications"); setItems(data); } catch (e) {} };
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

export default function Layout({ children }) {
  const { user, employee, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(localStorage.getItem("myspace_collapsed") === "1");
  const nav = ALL_NAV.filter((n) => n.roles.includes(user.role));
  const roleLabel = { admin: "Admin", team_leader: "Team Leader", staff: "Staff" }[user.role];
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
            <NavLink key={item.to} to={item.to} end={item.to === "/"} data-testid={`nav-${item.label.toLowerCase()}`}
              title={item.label}
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${collapsed ? "justify-center" : ""} ${isActive ? "bg-emerald-50 text-emerald-700" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"}`}>
              <item.icon className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              {!collapsed && item.label}
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
              className={({ isActive }) => `flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg ${isActive ? "text-emerald-600" : "text-slate-400"}`}>
              <item.icon className="w-5 h-5" strokeWidth={1.75} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
      <ChatWidget />
    </div>
  );
}
