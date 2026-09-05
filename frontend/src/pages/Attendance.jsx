import { useEffect, useState } from "react";
import { LogIn, Coffee, Flag, CircleDot } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Avatar, StatusBadge } from "@/components/common";
import CheckInCard from "@/components/CheckInCard";
import { EmptyState } from "@/components/ui-bits";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { timeStr, shortDate } from "@/lib/format";

export default function Attendance() {
  const { user } = useAuth();
  const isAdmin = user.role === "admin" || user.role === "team_leader";
  return isAdmin ? <AdminAttendance user={user} /> : <StaffAttendance />;
}

function Timeline({ today, shift }) {
  if (!today?.check_in)
    return <EmptyState icon={LogIn} title="Your workday hasn't started yet." subtitle="Check in to begin tracking your day." />;
  const fmtShift = (hm) => { if (!hm) return "—"; const [h, m] = hm.split(":").map(Number); const ap = h >= 12 ? "PM" : "AM"; return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ap}`; };
  const events = [
    { time: timeStr(today.check_in), label: "Check In", icon: CircleDot, color: "text-emerald-500", bg: "bg-emerald-50" },
  ];
  if (today.check_out) {
    const co = { time: timeStr(today.check_out), label: "Check Out", icon: Flag, color: "text-red-500", bg: "bg-red-50" };
    const se = { time: fmtShift(shift?.end_time), label: "Shift End", icon: Flag, color: "text-slate-400", bg: "bg-slate-100" };
    const coHM = new Date(today.check_out).toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false });
    const coMin = parseInt(coHM.slice(0, 2)) * 60 + parseInt(coHM.slice(3, 5));
    let seMin = 24 * 60;
    if (shift?.end_time) { const [h, m] = shift.end_time.split(":").map(Number); seMin = h * 60 + m; }
    if (coMin <= seMin) { events.push(co); events.push(se); } else { events.push(se); events.push(co); }
  } else {
    events.push({ time: "Now", label: "Working", icon: CircleDot, color: "text-emerald-500", bg: "bg-emerald-50", live: true });
    events.push({ time: fmtShift(shift?.end_time), label: "Shift End", icon: Flag, color: "text-slate-400", bg: "bg-slate-100" });
  }
  return (
    <div className="relative pl-2">
      {events.map((e, i) => (
        <div key={i} className="flex gap-4 pb-6 last:pb-0 relative">
          {i < events.length - 1 && <span className="absolute left-[19px] top-9 bottom-0 w-px bg-slate-200" />}
          <div className={`w-10 h-10 rounded-full ${e.bg} flex items-center justify-center shrink-0 relative`}>
            <e.icon className={`w-4 h-4 ${e.color} ${e.live ? "pulse-dot" : ""}`} />
          </div>
          <div className="pt-1">
            <p className="font-medium text-slate-800">{e.label}</p>
            <p className="text-sm text-slate-400">{e.time}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function StaffAttendance() {
  const { employee } = useAuth();
  const [data, setData] = useState({ today: null, history: [] });
  const [shift, setShift] = useState(null);
  const [range, setRange] = useState("month");

  const load = async (r = range) => { const { data } = await api.get("/attendance/me", { params: { range: r } }); setData(data); };
  useEffect(() => { load(); }, []);
  useEffect(() => { if (employee?.shift_id) api.get("/shifts").then((res) => setShift(res.data.find((s) => s.id === employee.shift_id) || null)); }, [employee]);
  const onRange = (r) => { setRange(r); load(r); };

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl font-bold text-slate-900 tracking-tight md:hidden">Attendance</h1>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2"><CheckInCard today={data.today} shift={shift} onChange={() => load()} /></div>
        <div className="rounded-2xl bg-white border border-slate-200 p-5">
          <h2 className="font-heading font-semibold text-slate-800 mb-4">Workday Timeline</h2>
          <Timeline today={data.today} shift={shift} />
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-wrap gap-2">
          <h2 className="font-heading font-semibold text-slate-800">History</h2>
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
            {["today", "week", "month"].map((r) => (
              <button key={r} onClick={() => onRange(r)} data-testid={`range-${r}`}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${range === r ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}>
                {r === "today" ? "Today" : r === "week" ? "This Week" : "This Month"}
              </button>
            ))}
          </div>
        </div>
        {data.history.length === 0 ? <EmptyState icon={Coffee} title="No records for this period" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-slate-500 text-xs">
                <th className="font-medium px-5 py-2">Date</th><th className="font-medium px-3 py-2">Check In</th>
                <th className="font-medium px-3 py-2">Check Out</th><th className="font-medium px-3 py-2">Hours</th><th className="font-medium px-5 py-2">Status</th>
              </tr></thead>
              <tbody>
                {data.history.map((a) => (
                  <tr key={a.id} className="border-t border-slate-50 hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3 font-medium text-slate-700">{shortDate(a.date)}</td>
                    <td className="px-3 py-3 text-slate-600">{timeStr(a.check_in)}</td>
                    <td className="px-3 py-3 text-slate-600">{timeStr(a.check_out)}</td>
                    <td className="px-3 py-3 text-slate-600">{a.hours ? `${a.hours}h` : "—"}</td>
                    <td className="px-5 py-3"><StatusBadge status={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminAttendance({ user }) {
  const [rows, setRows] = useState([]);
  const [depts, setDepts] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [dept, setDept] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

  const load = async () => {
    const params = { date };
    if (dept !== "all") params.department = dept;
    if (status !== "all") params.status = status;
    const { data } = await api.get("/attendance", { params });
    setRows(data);
  };
  useEffect(() => { api.get("/departments").then((r) => setDepts(r.data)); }, []);
  useEffect(() => { load(); }, [date, dept, status]);

  const mark = async (empId, st) => { await api.post("/attendance/mark", null, { params: { employee_id: empId, date, status: st } }); toast.success("Attendance updated"); load(); };

  const counts = { Present: 0, Late: 0, "Half Day": 0, Permission: 0, Absent: 0, Leave: 0 };
  rows.forEach((r) => { if (counts[r.status] !== undefined) counts[r.status]++; });

  const filteredRows = rows.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
        {[["Present", "text-emerald-600"], ["Late", "text-red-600"], ["Half Day", "text-red-600"], ["Permission", "text-amber-600"], ["Absent", "text-red-600"], ["Leave", "text-blue-600"]].map(([k, c]) => (
          <div key={k} className="rounded-2xl bg-white border border-slate-200 p-4">
            <p className={`font-heading text-2xl font-bold ${c}`}>{counts[k]}</p>
            <p className="text-xs text-slate-500">{k}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="att-date" className="rounded-xl w-44 bg-white" />
        <Select value={dept} onValueChange={setDept}>
          <SelectTrigger className="rounded-xl w-40 bg-white" data-testid="att-dept"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Departments</SelectItem>{depts.map((d) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="rounded-xl w-36 bg-white" data-testid="att-status"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Status</SelectItem>{["Present", "Late", "Absent", "Leave", "Half Day"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
        <Input 
          placeholder="Search staff by name..." 
          value={search} 
          onChange={(e) => setSearch(e.target.value)} 
          className="rounded-xl w-64 bg-white"
        />
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-slate-500 text-xs">
              <th className="font-medium px-5 py-3">Employee</th><th className="font-medium px-3 py-3">Check In</th>
              <th className="font-medium px-3 py-3">Check Out</th><th className="font-medium px-3 py-3">Hours</th>
              <th className="font-medium px-3 py-3">Status</th>{user.role === "admin" && <th className="font-medium px-5 py-3">Mark</th>}
            </tr></thead>
            <tbody>
              {filteredRows.map((r) => (
                <tr key={r.employee_id} className="border-t border-slate-50 hover:bg-slate-50/80 transition-colors">
                  <td className="px-5 py-3"><div className="flex items-center gap-2.5"><Avatar src={r.photo} name={r.name} size={30} /><span className="font-medium text-slate-700">{r.name}</span></div></td>
                  <td className="px-3 py-3 text-slate-600">{timeStr(r.check_in)}</td>
                  <td className="px-3 py-3 text-slate-600">{timeStr(r.check_out)}</td>
                  <td className="px-3 py-3 text-slate-600">{r.hours ? `${r.hours}h` : "—"}</td>
                  <td className="px-3 py-3"><StatusBadge status={r.status} /></td>
                  {user.role === "admin" && (
                    <td className="px-5 py-3">
                      <Select value={r.status} onValueChange={(v) => mark(r.employee_id, v)}>
                        <SelectTrigger className="rounded-lg h-8 w-28 text-xs" data-testid={`mark-${r.employee_id}`}><SelectValue /></SelectTrigger>
                        <SelectContent>{["Present", "Late", "Absent", "Leave", "Half Day"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
