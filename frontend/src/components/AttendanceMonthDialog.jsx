import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import api from "@/lib/api";
import { Avatar } from "@/components/common";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { timeStr } from "@/lib/format";

const DAY_STYLE = {
  Present: "bg-emerald-50 border-emerald-200 text-emerald-700",
  Late: "bg-amber-50 border-amber-200 text-amber-700",
  "Half Day": "bg-orange-50 border-orange-200 text-orange-700",
  Permission: "bg-yellow-50 border-yellow-200 text-yellow-700",
  "Work from Home": "bg-purple-50 border-purple-200 text-purple-700",
  Absent: "bg-red-50 border-red-200 text-red-600",
  Leave: "bg-blue-50 border-blue-200 text-blue-700",
  Holiday: "bg-sky-50 border-sky-200 text-sky-700",
};
const SHORT = { Present: "P", Late: "L", "Half Day": "HD", Permission: "PR", "Work from Home": "WFH", Absent: "A", Leave: "LV", Holiday: "H" };
const SUMMARY = [
  ["Present", "text-emerald-600"], ["Absent", "text-red-600"], ["Leave", "text-blue-600"], ["Holiday", "text-sky-600"],
  ["Late", "text-amber-600"], ["Half Day", "text-orange-600"], ["Permission", "text-yellow-600"], ["Work from Home", "text-purple-600"],
];

const thisMonth = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 7);
const shiftMonth = (m, delta) => {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export default function AttendanceMonthDialog({ employee, onClose }) {
  const [month, setMonth] = useState(thisMonth());
  const [data, setData] = useState(null);

  useEffect(() => { if (employee) setMonth(thisMonth()); }, [employee]);

  useEffect(() => {
    if (!employee || !month) return;
    setData(null);
    api.get(`/attendance/employee/${employee.employee_id}`, { params: { month } })
      .then((r) => setData(r.data))
      .catch(() => setData({ days: [], summary: {} }));
  }, [employee, month]);

  const [y, mo] = month.split("-").map(Number);
  const lead = new Date(y, mo - 1, 1).getDay();
  const monthLabel = new Date(y, mo - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const isCurrent = month >= thisMonth();

  return (
    <Dialog open={!!employee} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="rounded-2xl max-w-2xl max-h-[92vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2.5">
            {employee && <Avatar src={employee.photo} name={employee.name} size={32} />}
            <span>{employee?.name}</span>
            <span className="text-xs font-normal text-slate-400">{employee?.employee_code}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => setMonth((m) => shiftMonth(m, -1))} className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50" aria-label="Previous month"><ChevronLeft className="w-4 h-4" /></button>
          <div className="flex items-center gap-2">
            <span className="font-heading font-semibold text-slate-800 hidden sm:inline">{monthLabel}</span>
            <Input type="month" value={month} max={thisMonth()} onChange={(e) => e.target.value && setMonth(e.target.value)} className="rounded-xl w-44 bg-white" data-testid="att-month-picker" />
          </div>
          <button type="button" disabled={isCurrent} onClick={() => setMonth((m) => shiftMonth(m, 1))} className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 disabled:opacity-30" aria-label="Next month"><ChevronRight className="w-4 h-4" /></button>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {SUMMARY.map(([k, c]) => (
            <div key={k} className="rounded-xl border border-slate-200 bg-white p-2.5">
              <p className={`font-heading text-xl font-bold ${c}`}>{data ? (data.summary?.[k] || 0) : "–"}</p>
              <p className="text-[11px] text-slate-500 leading-tight">{k}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5 text-center">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="text-[11px] font-medium text-slate-400 py-1">{d}</div>)}
          {Array.from({ length: lead }).map((_, i) => <div key={`e${i}`} />)}
          {!data
            ? Array.from({ length: 30 }).map((_, i) => <div key={i} className="h-14 rounded-lg bg-slate-100 animate-pulse" />)
            : data.days.map((d) => {
                const day = Number(d.date.slice(8, 10));
                const style = d.status ? DAY_STYLE[d.status] || "bg-slate-50 border-slate-200 text-slate-600" : "bg-white border-slate-100 text-slate-300";
                const tip = d.status ? `${d.status}${d.check_in ? ` · In ${timeStr(d.check_in)}` : ""}${d.check_out ? ` · Out ${timeStr(d.check_out)}` : ""}${d.hours ? ` · ${d.hours}h` : ""}` : "No record";
                return (
                  <div key={d.date} title={tip} className={`h-14 rounded-lg border flex flex-col items-center justify-center ${style}`}>
                    <span className="text-sm font-semibold">{day}</span>
                    <span className="text-[10px] font-medium">{d.status ? SHORT[d.status] || d.status : ""}</span>
                  </div>
                );
              })}
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
          {Object.entries(SHORT).map(([k, s]) => <span key={k}><b>{s}</b> = {k}</span>)}
        </div>
      </DialogContent>
    </Dialog>
  );
}
