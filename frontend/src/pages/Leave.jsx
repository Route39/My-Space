import { useEffect, useState } from "react";
import { Plus, Check, X } from "lucide-react";
import { toast } from "sonner";
import api, { apiErr } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { StatusBadge, Avatar } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { shortDate, dateStr } from "@/lib/format";

const TYPES = ["Casual Leave", "Sick Leave", "Unpaid Leave", "Other"];

export default function Leave() {
  const { user } = useAuth();
  const isManager = user.role === "admin" || user.role === "team_leader";
  return isManager ? <ManagerLeave /> : <StaffLeave />;
}

function StaffLeave() {
  const [data, setData] = useState({ balance: null, leaves: [] });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ leave_type: "Casual Leave", from_date: "", to_date: "", reason: "", category: "Full Day", half_day_type: "1st Half", permission_hours: "1" });
  const [busy, setBusy] = useState(false);

  const load = async () => { const { data } = await api.get("/leaves/me"); setData(data); };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    setBusy(true);
    try {
      const payload = { ...form };
      if (payload.category !== "Full Day") payload.to_date = payload.from_date;
      await api.post("/leaves", payload);
      toast.success("Leave applied");
      setOpen(false);
      setForm({ leave_type: "Casual Leave", from_date: "", to_date: "", reason: "", category: "Full Day", half_day_type: "1st Half", permission_hours: "1" });
      load();
    } catch (e) { toast.error(apiErr(e.response?.data?.detail)); }
    setBusy(false);
  };

  const b = data.balance;
  const available = b ? (b.casual - b.used_casual) + (b.sick - b.used_sick) : 0;
  const used = b ? b.used_casual + b.used_sick : 0;
  const pending = data.leaves.filter((l) => l.status === "Pending").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-heading text-3xl font-bold text-slate-900 tracking-tight">Leave</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="apply-leave-btn" className="rounded-xl bg-emerald-600 hover:bg-emerald-700 h-10"><Plus className="w-4 h-4 mr-1" /> Apply Leave</Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl max-w-md">
            <DialogHeader><DialogTitle className="font-heading">Apply Leave</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Full Day">Full Day</SelectItem>
                      <SelectItem value="Half Day">Half Day</SelectItem>
                      <SelectItem value="Permission">Permission</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Leave type</Label>
                  <Select value={form.leave_type} onValueChange={(v) => setForm({ ...form, leave_type: v })}>
                    <SelectTrigger className="rounded-xl mt-1" data-testid="leave-type"><SelectValue /></SelectTrigger>
                    <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              {form.category === "Full Day" ? (
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>From</Label><Input type="date" className="rounded-xl mt-1" value={form.from_date} onChange={(e) => setForm({ ...form, from_date: e.target.value })} /></div>
                  <div><Label>To</Label><Input type="date" className="rounded-xl mt-1" value={form.to_date} onChange={(e) => setForm({ ...form, to_date: e.target.value })} /></div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Date</Label><Input type="date" className="rounded-xl mt-1" value={form.from_date} onChange={(e) => setForm({ ...form, from_date: e.target.value })} /></div>
                  {form.category === "Half Day" && (
                    <div><Label>Half Type</Label>
                      <Select value={form.half_day_type} onValueChange={(v) => setForm({ ...form, half_day_type: v })}>
                        <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="1st Half">1st Half</SelectItem><SelectItem value="2nd Half">2nd Half</SelectItem></SelectContent>
                      </Select>
                    </div>
                  )}
                  {form.category === "Permission" && (
                    <div><Label>Hours Early</Label>
                      <Input type="number" min="1" max="8" className="rounded-xl mt-1" value={form.permission_hours} onChange={(e) => setForm({ ...form, permission_hours: e.target.value })} />
                    </div>
                  )}
                </div>
              )}

              <div><Label>Reason</Label><Textarea className="rounded-xl mt-1" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button data-testid="leave-submit" onClick={submit} disabled={busy || !form.from_date || (form.category === "Full Day" && !form.to_date)} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">{busy ? "Applying…" : "Apply"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl bg-white border border-slate-200 p-5"><p className="text-sm text-slate-400">Available</p><p className="font-heading text-3xl font-bold text-emerald-600 mt-1">{available}</p></div>
        <div className="rounded-2xl bg-white border border-slate-200 p-5"><p className="text-sm text-slate-400">Used</p><p className="font-heading text-3xl font-bold text-slate-700 mt-1">{used}</p></div>
        <div className="rounded-2xl bg-white border border-slate-200 p-5"><p className="text-sm text-slate-400">Pending</p><p className="font-heading text-3xl font-bold text-amber-600 mt-1">{pending}</p></div>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100"><h2 className="font-heading font-semibold text-slate-800">My Leave</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-slate-500 text-xs">
              <th className="font-medium px-5 py-2">Type</th><th className="font-medium px-3 py-2">From</th>
              <th className="font-medium px-3 py-2">To</th><th className="font-medium px-3 py-2">Days</th>
              <th className="font-medium px-5 py-2">Status</th>
            </tr></thead>
            <tbody>
              {data.leaves.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">No leave applied yet</td></tr>}
              {data.leaves.map((l) => (
                <tr key={l.id} className="border-t border-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-700">
                    {l.leave_type}
                    <div className="text-xs text-slate-400 mt-0.5">
                      {l.category}{l.category === "Half Day" ? ` (${l.half_day_type})` : l.category === "Permission" ? ` (${l.permission_hours} hrs)` : ""}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-slate-600">{shortDate(l.from_date)}</td>
                  <td className="px-3 py-3 text-slate-600">{l.category === "Full Day" ? shortDate(l.to_date) : "-"}</td>
                  <td className="px-3 py-3 text-slate-600">{l.days}</td>
                  <td className="px-5 py-3"><StatusBadge status={l.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ManagerLeave() {
  const [leaves, setLeaves] = useState([]);
  const [search, setSearch] = useState("");
  const load = async () => { const { data } = await api.get("/leaves"); setLeaves(data); };
  useEffect(() => { load(); }, []);

  const act = async (id, action) => {
    await api.put(`/leaves/${id}/${action}`);
    toast.success(action === "approve" ? "Leave approved" : "Leave rejected");
    load();
  };

  const pending = leaves.filter((l) => l.status === "Pending");
  const others = leaves.filter((l) => l.status !== "Pending");

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl font-bold text-slate-900 tracking-tight">Leave Requests</h1>

      <div>
        <p className="text-sm font-medium text-slate-400 mb-2">Pending approval ({pending.length})</p>
        <div className="space-y-2">
          {pending.length === 0 && <div className="rounded-2xl bg-white border border-slate-200 p-8 text-center text-sm text-slate-400">No pending requests</div>}
          {pending.map((l) => (
            <div key={l.id} className="rounded-2xl bg-white border border-slate-200 p-4 flex items-center justify-between gap-3" data-testid={`leave-req-${l.id}`}>
              <div className="flex items-center gap-3">
                <Avatar name={l.employee_name} size={38} />
                <div>
                  <p className="font-medium text-slate-800">{l.employee_name}</p>
                  <p className="text-xs text-slate-400">
                    {l.leave_type} · {l.category}{l.category === "Half Day" ? ` (${l.half_day_type})` : l.category === "Permission" ? ` (${l.permission_hours} hrs)` : ""} · {dateStr(l.from_date)}{l.category === "Full Day" ? ` → ${dateStr(l.to_date)}` : ""}
                  </p>
                  {l.reason && <p className="text-xs text-slate-500 mt-0.5">"{l.reason}"</p>}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => act(l.id, "approve")} data-testid={`approve-${l.id}`} className="rounded-xl bg-emerald-600 hover:bg-emerald-700"><Check className="w-4 h-4" /></Button>
                <Button size="sm" variant="outline" onClick={() => act(l.id, "reject")} data-testid={`reject-${l.id}`} className="rounded-xl border-red-200 text-red-600 hover:bg-red-50"><X className="w-4 h-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-heading font-semibold text-slate-800">History</h2>
          <Input 
            placeholder="Search staff..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            className="w-48 h-8 text-sm rounded-lg"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-slate-500 text-xs">
              <th className="font-medium px-5 py-2">Employee</th><th className="font-medium px-3 py-2">Type</th>
              <th className="font-medium px-3 py-2">Dates</th><th className="font-medium px-3 py-2">Days</th>
              <th className="font-medium px-5 py-2">Status</th>
            </tr></thead>
            <tbody>
              {others
                .filter(l => !search || l.employee_name.toLowerCase().includes(search.toLowerCase()))
                .map((l) => (
                <tr key={l.id} className="border-t border-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-700">
                    {l.employee_name}
                  </td>
                  <td className="px-3 py-3 text-slate-600">
                    {l.leave_type}
                    <div className="text-xs text-slate-400 mt-0.5">
                      {l.category}{l.category === "Half Day" ? ` (${l.half_day_type})` : l.category === "Permission" ? ` (${l.permission_hours} hrs)` : ""}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-slate-600">
                    {shortDate(l.from_date)}{l.category === "Full Day" ? ` → ${shortDate(l.to_date)}` : ""}
                  </td>
                  <td className="px-3 py-3 text-slate-600">{l.days}</td>
                  <td className="px-5 py-3"><StatusBadge status={l.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
