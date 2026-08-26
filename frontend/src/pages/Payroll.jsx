import { useEffect, useState } from "react";
import { RefreshCw, Wallet, TrendingUp, Users } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { Avatar } from "@/components/common";
import { StatusBadge } from "@/components/common";
import { EmptyState } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { money } from "@/lib/format";

export default function Payroll() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = async () => { const { data } = await api.get("/payroll", { params: { month } }); setRows(data); };
  useEffect(() => { load(); }, [month]);

  const generate = async () => {
    setBusy(true);
    try { await api.post("/payroll/generate", null, { params: { month } }); toast.success("Payroll generated"); load(); }
    catch (e) { toast.error("Failed to generate"); }
    setBusy(false);
  };
  const setStatus = async (id, status) => { await api.put(`/payroll/${id}/status`, { status }); toast.success(`Marked ${status}`); load(); };

  const total = rows.reduce((s, r) => s + r.net, 0);
  const paid = rows.filter((r) => r.status === "Paid").length;
  const monthLabel = new Date(month + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><p className="text-slate-500">{monthLabel} payroll run</p></div>
        <div className="flex gap-2">
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} data-testid="payroll-month" className="rounded-xl w-40 bg-white" />
          <Button onClick={generate} disabled={busy} data-testid="generate-payroll" className="rounded-xl bg-emerald-600 hover:bg-emerald-700 h-10"><RefreshCw className={`w-4 h-4 mr-1 ${busy ? "animate-spin" : ""}`} /> Generate</Button>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="sm:col-span-1 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white">
          <div className="flex items-center gap-2 text-slate-300 text-sm mb-2"><Wallet className="w-4 h-4" /> Total Payroll</div>
          <p className="font-heading text-3xl font-bold">{money(total)}</p>
          <p className="text-xs text-slate-400 mt-1">{monthLabel}</p>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-6"><div className="flex items-center gap-2 text-slate-400 text-sm mb-2"><Users className="w-4 h-4" /> Employees</div><p className="font-heading text-3xl font-bold text-slate-900">{rows.length}</p></div>
        <div className="rounded-2xl bg-white border border-slate-200 p-6"><div className="flex items-center gap-2 text-slate-400 text-sm mb-2"><TrendingUp className="w-4 h-4" /> Paid</div><p className="font-heading text-3xl font-bold text-emerald-600">{paid}<span className="text-lg text-slate-300">/{rows.length}</span></p></div>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
        {rows.length === 0 ? <EmptyState icon={Wallet} title={`No payroll for ${monthLabel}`} subtitle="Click Generate to calculate salaries from attendance and leave." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-slate-500 text-xs">
                <th className="font-medium px-5 py-3">Employee</th><th className="font-medium px-3 py-3 text-right">Salary</th>
                <th className="font-medium px-3 py-3 text-right">LOP</th><th className="font-medium px-3 py-3 text-right">Overtime</th>
                <th className="font-medium px-3 py-3 text-right">Incentive</th><th className="font-medium px-3 py-3 text-right">Deduction</th>
                <th className="font-medium px-3 py-3 text-right">Net Salary</th><th className="font-medium px-5 py-3">Status</th>
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-50 hover:bg-slate-50/80 transition-colors" data-testid={`payroll-row-${r.employee_code}`}>
                    <td className="px-5 py-3"><div className="flex items-center gap-2.5"><Avatar name={r.employee_name} size={30} /><div><p className="font-medium text-slate-700 leading-tight">{r.employee_name}</p><p className="text-xs text-slate-400">{r.employee_code}</p></div></div></td>
                    <td className="px-3 py-3 text-right text-slate-600">{money(r.salary)}</td>
                    <td className="px-3 py-3 text-right text-red-500">{r.lop ? `-${money(r.lop)}` : "—"}</td>
                    <td className="px-3 py-3 text-right text-emerald-600">{r.overtime ? `+${money(r.overtime)}` : "—"}</td>
                    <td className="px-3 py-3 text-right text-emerald-600">{r.incentive ? `+${money(r.incentive)}` : "—"}</td>
                    <td className="px-3 py-3 text-right text-red-500">{r.deduction ? `-${money(r.deduction)}` : "—"}</td>
                    <td className="px-3 py-3 text-right font-semibold text-slate-900">{money(r.net)}</td>
                    <td className="px-5 py-3">
                      <Select value={r.status} onValueChange={(v) => setStatus(r.id, v)}>
                        <SelectTrigger className="rounded-lg h-8 w-28 text-xs" data-testid={`payroll-status-${r.employee_code}`}><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="Draft">Draft</SelectItem><SelectItem value="Approved">Approved</SelectItem><SelectItem value="Paid">Paid</SelectItem></SelectContent>
                      </Select>
                    </td>
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
