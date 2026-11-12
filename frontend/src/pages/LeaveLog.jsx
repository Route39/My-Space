import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { StatusBadge } from "@/components/common";

const fmt = (v) => v ? new Date(v).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
const fmtDay = (v) => v ? new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "";

export default function LeaveLog() {
  const [rows, setRows] = useState([]);
  const [tab, setTab] = useState("All");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.get("/leaves/log").then(({ data }) => setRows(data || [])).finally(() => setLoading(false)); }, []);
  const list = useMemo(() => rows.filter((l) => (tab === "All" || l.status === tab) &&
    (!q.trim() || (l.employee_name || "").toLowerCase().includes(q.trim().toLowerCase()))), [rows, tab, q]);
  const count = (s) => rows.filter((l) => s === "All" || l.status === s).length;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Leave Log</h1>
        <p className="text-sm text-slate-500">Who applied, and who approved or rejected each leave.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {["All", "Pending", "Approved", "Rejected"].map((s) => (
          <button key={s} onClick={() => setTab(s)} className={`rounded-full px-4 py-1.5 text-sm font-medium ${tab === s ? "bg-emerald-600 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>{s} ({count(s)})</button>
        ))}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search employee..." className="ml-auto w-56 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>{["Employee", "Leave type", "Dates", "Applied on", "Status", "Approved / Rejected by", "When"].map((h) => <th key={h} className="px-5 py-3 font-semibold">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? <tr><td colSpan={7} className="px-5 py-8 text-center text-slate-400">Loading…</td></tr>
              : list.length === 0 ? <tr><td colSpan={7} className="px-5 py-8 text-center text-slate-400">No leaves found</td></tr>
              : list.map((l) => (
                <tr key={l.id}>
                  <td className="px-5 py-3 font-medium text-slate-800">{l.employee_name}</td>
                  <td className="px-5 py-3">{l.leave_type}{l.category && l.category !== l.leave_type ? ` · ${l.category}` : ""}</td>
                  <td className="px-5 py-3">{fmtDay(l.from_date)}{l.to_date && l.to_date !== l.from_date ? ` – ${fmtDay(l.to_date)}` : ""}</td>
                  <td className="px-5 py-3 text-slate-500">{fmt(l.created_at)}</td>
                  <td className="px-5 py-3"><StatusBadge status={l.status} /></td>
                  <td className="px-5 py-3">{l.decided_by ? <b>{l.decided_by}</b> : "—"}</td>
                  <td className="px-5 py-3 text-slate-500">{fmt(l.decided_at)}</td>
                </tr>))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
