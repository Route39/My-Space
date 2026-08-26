import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Clock3, ArrowRight, ListTodo, CheckCircle2, Wallet, Activity } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Avatar, StatusBadge } from "@/components/common";
import CheckInCard from "@/components/CheckInCard";
import { ProgressRing, MiniProgress, AvatarGroup, CardSkeleton, RowsSkeleton } from "@/components/ui-bits";
import { money, timeStr, shortDate } from "@/lib/format";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening";
}

export default function Dashboard() {
  const { user, employee } = useAuth();
  const [data, setData] = useState(null);
  const [today, setToday] = useState(null);
  const [shift, setShift] = useState(null);
  const navigate = useNavigate();

  const load = async () => {
    const [d, att] = await Promise.all([api.get("/dashboard"), api.get("/attendance/me", { params: { range: "today" } }).catch(() => ({ data: { today: null } }))]);
    setData(d.data); setToday(att.data.today);
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

      {isAdmin ? <AdminHome data={data} today={today} shift={shift} navigate={navigate} /> : <StaffHome data={data} today={today} shift={shift} reload={load} navigate={navigate} />}
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

function StaffHome({ data, today, shift, reload, navigate }) {
  const tc = data.task_counts;
  const total = tc.todo + tc.in_progress + tc.completed || 1;
  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6 rise" style={{ animationDelay: "60ms" }}>
        <CheckInCard today={today} shift={shift} onChange={reload} />
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
  );
}

const Legend = ({ color, label, value }) => (
  <div className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${color}`} /><span className="text-slate-500">{label}</span><span className="font-medium text-slate-800 ml-auto">{value}</span></div>
);
const TaskLegend = ({ color, dot, label, v }) => (
  <div className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${dot}`} /><span className="text-slate-500">{label}</span><span className={`font-bold ml-auto ${color}`}>{v}</span></div>
);
