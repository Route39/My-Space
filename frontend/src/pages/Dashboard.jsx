import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Users, Clock3, ArrowRight, ListTodo, CheckCircle2, Wallet, Activity, Megaphone, Send, X, Trash2, Plus } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Avatar, StatusBadge } from "@/components/common";
import CheckInCard from "@/components/CheckInCard";
import AnnouncementsSection from "@/components/Announcements";
import { ProgressRing, MiniProgress, AvatarGroup, CardSkeleton, RowsSkeleton } from "@/components/ui-bits";
import { money, timeStr, shortDate } from "@/lib/format";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening";
}

export default function Dashboard() {
  const { user, employee } = useAuth();
  const [data, setData] = useState(null);
  const [today, setToday] = useState(null);
  const [shift, setShift] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [activeNotices, setActiveNotices] = useState([]);
  const navigate = useNavigate();

  const load = async () => {
    const [d, att] = await Promise.all([
      api.get("/dashboard"), 
      api.get("/attendance/me", { params: { range: "today" } }).catch(() => ({ data: { today: null } }))
    ]);
    setData(d.data); 
    setToday(att.data.today);

    api.get("/announcements")
      .then((res) => setAnnouncements(res.data))
      .catch(() => setAnnouncements([]));

    api.get("/notices/active")
      .then((res) => setActiveNotices(res.data))
      .catch(() => setActiveNotices([]));
  };
  useEffect(() => {
    load();
    if (employee?.shift_id) api.get("/shifts").then((r) => setShift(r.data.find((s) => s.id === employee.shift_id) || null));
  }, [employee]);

  if (!data)
    return (
      <div className="space-y-6">
        <div className="skeleton h-10 w-64 rounded-xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[0, 1, 2, 3].map((i) => <CardSkeleton key={i} />)}</div>
        <RowsSkeleton />
      </div>
    );

  const isAdmin = data.role === "admin" || data.role === "team_leader";

  return (
    <div className="space-y-6">
      <div className="rise">
        <h1 className="font-heading text-3xl font-bold text-slate-900 tracking-tight">{greeting()}, {user.name.split(" ")[0]} 👋</h1>
        <p className="text-slate-500 mt-1">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
      </div>

      <div className={`grid gap-8 rise ${activeNotices.length > 0 || isAdmin ? "lg:grid-cols-2" : ""}`} style={{ animationDelay: "30ms" }}>
        {(activeNotices.length > 0 || isAdmin) && (
          <div className="w-full">
            <ActiveNoticeBanner notices={activeNotices} isAdmin={isAdmin} reload={load} />
          </div>
        )}
        <div className="w-full">
          <AnnouncementsSection announcements={announcements} isAdmin={isAdmin} reload={load} />
        </div>
      </div>

      {user.role === "admin_staff" ? (
        <div className="space-y-6">
          <StaffHome data={data} today={today} shift={shift} reload={load} navigate={navigate} />
          <hr className="border-slate-200 border-2 rounded-xl my-8" />
          <AdminHome data={data} today={today} shift={shift} navigate={navigate} />
        </div>
      ) : isAdmin ? <AdminHome data={data} today={today} shift={shift} navigate={navigate} /> : <StaffHome data={data} today={today} shift={shift} reload={load} navigate={navigate} />}
    </div>
  );
}

function AdminHome({ data, today, shift, navigate }) {
  const { employees, present, late, on_leave } = data.stats;
  const absent = Math.max(0, employees - present - on_leave);
  const tc = data.task_counts;
  const totalTasks = tc.todo + tc.in_progress + tc.completed || 1;
  const presentPeople = data.attendance_today.filter((r) => r.status === "Present" || r.status === "Late");

  return (
    <>
      <div className="grid lg:grid-cols-3 gap-4 rise" style={{ animationDelay: "60ms" }}>
        <div className="rounded-2xl bg-white border border-slate-200 p-5 card-hover" data-testid="stat-employees">
          <p className="text-sm text-slate-500 mb-3">Attendance today</p>
          <div className="flex items-center gap-4">
            <ProgressRing value={present} max={employees} size={92} stroke={9} color="#059669">
              <span className="font-heading text-xl font-bold text-slate-900">{Math.round((present / (employees || 1)) * 100)}%</span>
            </ProgressRing>
            <div className="space-y-1.5 text-sm">
              <Legend color="bg-emerald-500" label="Present" value={present - late} />
              <Legend color="bg-amber-500" label="Late" value={late} />
              <Legend color="bg-red-400" label="Absent" value={absent} />
              <Legend color="bg-blue-400" label="On Leave" value={on_leave} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-5 card-hover" data-testid="stat-employees-total">
          <div className="flex items-center justify-between mb-3"><p className="text-sm text-slate-500">Team</p><Users className="w-4 h-4 text-slate-300" /></div>
          <p className="font-heading text-4xl font-bold text-slate-900">{employees}</p>
          <p className="text-sm text-slate-400 mt-1">Total employees</p>
          <div className="mt-3"><AvatarGroup people={presentPeople.map((p) => ({ name: p.name, photo: p.photo }))} max={6} /></div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-5 text-white card-hover">
          <div className="flex items-center justify-between mb-3"><p className="text-sm text-emerald-50">Payroll · this month</p><Wallet className="w-4 h-4 text-emerald-100" /></div>
          <p className="font-heading text-3xl font-bold">{money(data.payroll_total)}</p>
          <button onClick={() => navigate("/payroll")} className="text-emerald-50 text-sm mt-3 flex items-center gap-1 hover:gap-2 transition-all">Open payroll <ArrowRight className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 rise" style={{ animationDelay: "120ms" }}>
        <div className="lg:col-span-2 rounded-2xl bg-white border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-heading font-semibold text-slate-800">Today's Attendance</h2>
            <button onClick={() => navigate("/attendance")} className="text-sm text-emerald-600 font-medium flex items-center gap-1">View all <ArrowRight className="w-3.5 h-3.5" /></button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-slate-500 text-xs">
                <th className="font-medium px-5 py-2">Employee</th><th className="font-medium px-3 py-2">Check In</th>
                <th className="font-medium px-3 py-2">Check Out</th><th className="font-medium px-5 py-2">Status</th>
              </tr></thead>
              <tbody>
                {data.attendance_today.slice(0, 8).map((r) => (
                  <tr key={r.employee_id} className="border-t border-slate-50 hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3"><div className="flex items-center gap-2.5"><Avatar src={r.photo} name={r.name} size={30} /><span className="font-medium text-slate-700">{r.name}</span></div></td>
                    <td className="px-3 py-3 text-slate-600">{timeStr(r.check_in)}</td>
                    <td className="px-3 py-3 text-slate-600">{timeStr(r.check_out)}</td>
                    <td className="px-5 py-3"><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl bg-white border border-slate-200 p-5">
            <h2 className="font-heading font-semibold text-slate-800 mb-4">Tasks</h2>
            <div className="flex items-center gap-4 mb-4">
              <ProgressRing value={tc.completed} max={totalTasks} size={72} stroke={8} color="#3b82f6">
                <span className="font-heading text-sm font-bold text-slate-800">{Math.round((tc.completed / totalTasks) * 100)}%</span>
              </ProgressRing>
              <div className="flex-1 space-y-2 text-sm">
                <TaskLegend color="text-slate-500" dot="bg-slate-400" label="To Do" v={tc.todo} />
                <TaskLegend color="text-blue-600" dot="bg-blue-500" label="In Progress" v={tc.in_progress} />
                <TaskLegend color="text-emerald-600" dot="bg-emerald-500" label="Completed" v={tc.completed} />
                <TaskLegend color="text-red-600" dot="bg-red-500" label="Overdue" v={tc.overdue} />
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-white border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-3"><Activity className="w-4 h-4 text-emerald-500" /><h2 className="font-heading font-semibold text-slate-800">Recent Activity</h2></div>
            <div className="space-y-3">
              {data.activities.map((a) => (
                <div key={a.id} className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <div className="flex-1"><p className="text-sm text-slate-600 leading-tight">{a.message}</p><p className="text-[11px] text-slate-400 mt-0.5">{new Date(a.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</p></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
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

function ActiveNoticeBanner({ notices, isAdmin, reload }) {
  const [showModal, setShowModal] = useState(false);
  const [msg, setMsg] = useState("");
  const [hours, setHours] = useState(24);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [fromTime, setFromTime] = useState("");
  const [toTime, setToTime] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!msg.trim()) return;
    setBusy(true);
    try {
      await api.post("/notices", { 
        message: msg.trim(), 
        duration_hours: hours,
        from_date: fromDate || null,
        to_date: toDate || null,
        from_time: fromTime || null,
        to_time: toTime || null
      });
      toast.success("Notice published globally!");
      setMsg(""); setHours(24); setFromDate(""); setToDate(""); setFromTime(""); setToTime("");
      setShowModal(false);
      reload();
    } catch (e) {
      toast.error("Failed to post notice");
    }
    setBusy(false);
  };

  const remove = async (id) => {
    if(!window.confirm("Remove notice?")) return;
    try { await api.delete(`/notices/${id}`); reload(); } catch(e){}
  };

  if (!isAdmin && (!notices || notices.length === 0)) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-[1.125rem]">
        <div className="flex items-center gap-2 text-slate-900">
          <Megaphone className="w-5 h-5 text-emerald-500" fill="currentColor" />
          <h2 className="font-heading font-bold text-xl">Active Notice</h2>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowModal(true)} className="bg-slate-900 hover:bg-slate-800 text-white rounded-full px-5 py-2 h-auto text-sm gap-1.5 shadow-md">
            <Plus className="w-4 h-4" /> Post
          </Button>
        )}
      </div>

      {(!notices || notices.length === 0) ? (
        <p className="text-sm text-slate-400 italic">No active notices.</p>
      ) : (
        notices.map(n => (
          <div key={n.id} className="rounded-3xl border border-white/10 shadow-2xl overflow-hidden relative group" style={{background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(8px)'}}>
            {isAdmin && (
              <button onClick={() => remove(n.id)} className="absolute top-5 right-5 text-white/50 hover:text-red-400 z-20 opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 hover:bg-black/40 p-2 rounded-full">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
            
            <div className="p-6">
              <div className="flex items-center justify-between mb-4 relative z-10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/10">
                    <img src="/favicon.svg" alt="logo" className="w-4 h-4" style={{filter: 'brightness(0) invert(1)'}} />
                  </div>
                  <h3 className="text-white font-heading font-semibold text-lg">MySpace Notice</h3>
                </div>
              </div>
              
              <p className="text-white text-base leading-relaxed whitespace-pre-wrap font-medium relative z-10">{n.message}</p>
              
              {(n.from_date || n.to_date || n.from_time || n.to_time) && (
                <div className="mt-5 pt-4 border-t border-white/10 flex flex-col gap-1.5 relative z-10">
                  {(n.from_date || n.to_date) && (
                    <p className="text-emerald-300 text-sm font-medium">📅 Date: <span className="text-white">
                      {[n.from_date, n.to_date].filter(Boolean).join(" to ")}
                    </span></p>
                  )}
                  {(n.from_time || n.to_time) && (
                    <p className="text-emerald-300 text-sm font-medium">🕒 Time: <span className="text-white">
                      {[n.from_time ? formatTime12h(n.from_time) : null, n.to_time ? formatTime12h(n.to_time) : null].filter(Boolean).join(" to ")}
                    </span></p>
                  )}
                </div>
              )}
              
              <p className="text-slate-400 text-xs mt-4 relative z-10">— {n.created_by} • Posted {new Date(n.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
            </div>
          </div>
        ))
      )}

      {/* Send Notice Modal */}
      {showModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(6px)'}} onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <Megaphone className="w-5 h-5 text-emerald-600" />
                </div>
                <h3 className="font-heading font-bold text-slate-900 text-lg">Send Notice</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Message</label>
                <textarea
                  value={msg}
                  onChange={e => setMsg(e.target.value)}
                  placeholder="Type your notice message here..."
                  rows={4}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">From Date <span className="text-slate-400 font-normal">(optional)</span></label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={e => setFromDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">To Date <span className="text-slate-400 font-normal">(optional)</span></label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={e => setToDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">From Time <span className="text-slate-400 font-normal">(optional)</span></label>
                  <input
                    type="time"
                    value={fromTime}
                    onChange={e => setFromTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">To Time <span className="text-slate-400 font-normal">(optional)</span></label>
                  <input
                    type="time"
                    value={toTime}
                    onChange={e => setToTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Duration (how long the notice stays active)</label>
                <select
                  value={hours}
                  onChange={e => setHours(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value={1}>1 Hour</option>
                  <option value={2}>2 Hours</option>
                  <option value={4}>4 Hours</option>
                  <option value={8}>8 Hours</option>
                  <option value={12}>12 Hours</option>
                  <option value={24}>24 Hours</option>
                  <option value={48}>2 Days</option>
                  <option value={72}>3 Days</option>
                </select>
              </div>
            </div>
            <div className="px-6 pb-6">
              <button
                onClick={send}
                disabled={busy || !msg.trim()}
                className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-heading font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" /> {busy ? "Sending..." : "Send to All Staff"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function StaffHome({ data, today, shift, reload, navigate }) {
  const tc = data.task_counts;
  const total = tc.todo + tc.in_progress + tc.completed || 1;
  return (
    <div className="w-full">
      <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6 rise" style={{ animationDelay: "60ms" }}>
        <CheckInCard today={today} shift={shift} onChange={reload} isOnLeaveToday={data.is_on_leave_today} />
        {data.latest_task && (
          <div className="rounded-2xl bg-white border border-slate-200 p-5 card-hover cursor-pointer" data-testid="latest-task-card" onClick={() => navigate("/tasks")}>
            <p className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">Latest Task</p>
            <div className="flex items-center justify-between">
              <div><p className="font-heading font-semibold text-slate-800">{data.latest_task.title}</p><p className="text-xs text-slate-400 mt-0.5">Due {shortDate(data.latest_task.due_date)}</p></div>
              <ArrowRight className="w-5 h-5 text-emerald-500" />
            </div>
          </div>
        )}
      </div>
      <div className="space-y-6 rise" style={{ animationDelay: "120ms" }}>
        <div className="rounded-2xl bg-white border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4"><ListTodo className="w-4 h-4 text-blue-500" /><p className="font-heading font-semibold text-slate-800">My Tasks</p></div>
          <div className="grid grid-cols-3 gap-2 text-center mb-4">
            <div><p className="font-heading text-2xl font-bold text-slate-700">{tc.todo}</p><p className="text-[11px] text-slate-400">To Do</p></div>
            <div><p className="font-heading text-2xl font-bold text-blue-600">{tc.in_progress}</p><p className="text-[11px] text-slate-400">In Progress</p></div>
            <div><p className="font-heading text-2xl font-bold text-emerald-600">{tc.completed}</p><p className="text-[11px] text-slate-400">Completed</p></div>
          </div>
          <MiniProgress value={tc.completed} max={total} />
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-5 flex items-center gap-4">
          <ProgressRing value={data.leave_available} max={20} size={72} stroke={8} color="#8b5cf6">
            <span className="font-heading text-lg font-bold text-slate-800">{data.leave_available}</span>
          </ProgressRing>
          <div className="flex-1">
            <p className="text-sm text-slate-500">Leave available</p>
            <p className="text-xs text-slate-400 mb-2">days remaining</p>
            <button onClick={() => navigate("/leave")} className="px-3 py-1.5 rounded-xl bg-violet-50 text-violet-700 text-sm font-medium hover:bg-violet-100 transition-colors">Apply leave</button>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

const Legend = ({ color, label, value }) => (
  <div className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${color}`} /><span className="text-slate-500">{label}</span><span className="font-medium text-slate-800 ml-auto">{value}</span></div>
);
const TaskLegend = ({ color, dot, label, v }) => (
  <div className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${dot}`} /><span className="text-slate-500">{label}</span><span className={`font-bold ml-auto ${color}`}>{v}</span></div>
);

