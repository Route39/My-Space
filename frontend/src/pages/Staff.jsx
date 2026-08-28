import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Mail, Phone, Calendar, ArrowRight, Users } from "lucide-react";
import { toast } from "sonner";
import api, { apiErr } from "@/lib/api";
import { Avatar, StatusBadge } from "@/components/common";
import { EmptyState } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { money, dateStr } from "@/lib/format";

export default function Staff() {
  const navigate = useNavigate();
  const [emps, setEmps] = useState([]);
  const [statusMap, setStatusMap] = useState({});
  const [depts, setDepts] = useState([]);
  const [desigs, setDesigs] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [drawer, setDrawer] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", department: "", designation: "", monthly_salary: "", shift_id: "", location: "Bengaluru", role: "staff" });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const [e, d, dg, s, att] = await Promise.all([
      api.get("/employees"), api.get("/departments"), api.get("/designations"), api.get("/shifts"),
      api.get("/attendance", { params: { date: today } }).catch(() => ({ data: [] })),
    ]);
    setEmps(e.data); setDepts(d.data); setDesigs(dg.data); setShifts(s.data);
    const m = {}; att.data.forEach((r) => { m[r.employee_id] = r.status; }); setStatusMap(m);
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    setBusy(true);
    try {
      await api.post("/employees", { ...form, monthly_salary: Number(form.monthly_salary) || 0 });
      toast.success("Staff added"); setOpen(false);
      setForm({ name: "", email: "", phone: "", password: "", department: "", designation: "", monthly_salary: "", shift_id: "", location: "Bengaluru", role: "staff" });
      load();
    } catch (e) { toast.error(apiErr(e.response?.data?.detail)); }
    setBusy(false);
  };

  const filtered = emps.filter((e) => [e.name, e.employee_code, e.department, e.designation].join(" ").toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="font-heading text-3xl font-bold text-slate-900 tracking-tight md:hidden">Staff</h1><p className="text-slate-500">{emps.length} team members</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button data-testid="add-staff-btn" className="rounded-xl bg-emerald-600 hover:bg-emerald-700 h-10"><Plus className="w-4 h-4 mr-1" /> Add Staff</Button></DialogTrigger>
          <DialogContent className="rounded-2xl max-w-lg max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
            <DialogHeader><DialogTitle className="font-heading">Add Staff</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Full name</Label><Input data-testid="staff-name" className="rounded-xl mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Email (Optional)</Label><Input data-testid="staff-email" className="rounded-xl mt-1" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Username / Phone</Label><Input className="rounded-xl mt-1" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required /></div>
              <div className="col-span-2"><Label>Password</Label><Input type="text" placeholder="Set staff password" className="rounded-xl mt-1" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></div>
              <div><Label>Department</Label>
                <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
                  <SelectTrigger className="rounded-xl mt-1" data-testid="staff-department"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{depts.map((d) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Designation</Label>
                <Select value={form.designation} onValueChange={(v) => setForm({ ...form, designation: v })}>
                  <SelectTrigger className="rounded-xl mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{desigs.map((d) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Monthly salary (₹)</Label><Input type="number" className="rounded-xl mt-1" value={form.monthly_salary} onChange={(e) => setForm({ ...form, monthly_salary: e.target.value })} /></div>
              <div><Label>Shift</Label>
                <Select value={form.shift_id} onValueChange={(v) => setForm({ ...form, shift_id: v })}>
                  <SelectTrigger className="rounded-xl mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{shifts.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="staff">Staff</SelectItem><SelectItem value="team_leader">Team Leader</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter><Button data-testid="staff-save" onClick={submit} disabled={busy || !form.name || !form.phone || !form.password} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">{busy ? "Saving…" : "Add Staff"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-xs">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <Input data-testid="staff-search" placeholder="Search staff…" value={q} onChange={(e) => setQ(e.target.value)} className="rounded-xl pl-9 h-10 bg-white" />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200"><EmptyState icon={Users} title="No staff found" subtitle="Try a different search or add a new team member." /></div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((e) => (
            <button key={e.id} data-testid={`staff-row-${e.employee_code}`} onClick={() => setDrawer(e)}
              className="text-left rounded-2xl bg-white border border-slate-200 p-5 card-hover">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar src={e.photo} name={e.name} size={44} />
                  <div>
                    <p className="font-heading font-semibold text-slate-800 leading-tight">{e.name}</p>
                    <p className="text-xs text-slate-400">{e.designation}</p>
                  </div>
                </div>
                <StatusBadge status={statusMap[e.id] || "Active"} />
              </div>
              <div className="flex items-center justify-between mt-4 text-xs text-slate-500">
                <span className="px-2 py-1 rounded-lg bg-slate-50">{e.department}</span>
                <span className="text-slate-400">{e.employee_code}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <Sheet open={!!drawer} onOpenChange={(o) => !o && setDrawer(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto" aria-describedby={undefined}>
          <SheetTitle className="sr-only">Employee profile</SheetTitle>
          {drawer && (
            <div className="space-y-6 pt-2">
              <div className="flex flex-col items-center text-center">
                <Avatar src={drawer.photo} name={drawer.name} size={84} />
                <h2 className="font-heading text-xl font-bold text-slate-900 mt-3">{drawer.name}</h2>
                <p className="text-slate-500 text-sm">{drawer.designation} · {drawer.department}</p>
                <div className="mt-2"><StatusBadge status={statusMap[drawer.id] || "Active"} /></div>
              </div>
              <div className="space-y-3 text-sm">
                <Info icon={Mail} text={drawer.email} />
                <Info icon={Phone} text={drawer.phone} />
                <Info icon={Calendar} text={`Joined ${dateStr(drawer.joining_date)}`} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-400">Monthly Salary</p><p className="font-heading text-lg font-bold text-slate-900">{money(drawer.monthly_salary)}</p></div>
                <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-400">Employee ID</p><p className="font-heading text-lg font-bold text-slate-900">{drawer.employee_code}</p></div>
              </div>
              <Button onClick={() => navigate(`/staff/${drawer.id}`)} className="w-full rounded-xl bg-slate-900 hover:bg-slate-800">View full profile <ArrowRight className="w-4 h-4 ml-2" /></Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

const Info = ({ icon: Icon, text }) => (<div className="flex items-center gap-2.5 text-slate-600"><Icon className="w-4 h-4 text-slate-400" /> {text || "—"}</div>);
