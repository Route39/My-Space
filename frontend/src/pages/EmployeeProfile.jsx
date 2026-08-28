import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Mail, Phone, MapPin, Calendar, Building2, Save, Wallet, Briefcase, Trash2, Edit } from "lucide-react";
import { toast } from "sonner";
import api, { apiErr } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Avatar, StatusBadge } from "@/components/common";
import { EmptyState } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { money, dateStr, shortDate } from "@/lib/format";

export default function EmployeeProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [emp, setEmp] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [payroll, setPayroll] = useState([]);
  const [salary, setSalary] = useState("");
  
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(null);
  const [depts, setDepts] = useState([]);
  const [desigs, setDesigs] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [locs, setLocs] = useState([]);

  const load = async () => { 
    const { data } = await api.get(`/employees/${id}`); 
    setEmp(data); 
    setSalary(String(data.monthly_salary || ""));
    const [d, dg, s] = await Promise.all([
      api.get("/departments").catch(()=>({data:[]})),
      api.get("/designations").catch(()=>({data:[]})),
      api.get("/shifts").catch(()=>({data:[]}))
    ]);
    setDepts(d.data); setDesigs(dg.data); setShifts(s.data);
  };
  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    if (!emp) return;
    (async () => {
      const month = new Date().toISOString().slice(0, 7);
      const [t, l, p] = await Promise.all([
        api.get("/tasks").catch(() => ({ data: [] })),
        api.get("/leaves").catch(() => ({ data: [] })),
        api.get("/payroll", { params: { month } }).catch(() => ({ data: [] })),
      ]);
      setTasks(t.data.filter((x) => x.assignee_id === id));
      setLeaves(l.data.filter((x) => x.employee_id === id));
      setPayroll(p.data.filter((x) => x.employee_id === id));
    })();
  }, [emp, id]);

  const saveSalary = async () => { await api.put(`/employees/${id}/salary`, { monthly_salary: Number(salary) || 0, salary_type: "Monthly" }); toast.success("Salary updated"); load(); };

  const handleEdit = () => {
    setForm({ ...emp, password: "" });
    setEditOpen(true);
  };

  const submitEdit = async () => {
    setBusy(true);
    try {
      await api.put(`/employees/${id}`, { ...form, monthly_salary: Number(form.monthly_salary) || 0 });
      toast.success("Staff updated perfectly");
      setEditOpen(false);
      load();
    } catch (e) {
      toast.error(apiErr(e.response?.data?.detail));
    }
    setBusy(false);
  };

  const submitDelete = async () => {
    setBusy(true);
    try {
      await api.delete(`/employees/${id}`);
      toast.success("Staff deleted perfectly");
      navigate("/staff");
    } catch (e) {
      toast.error(apiErr(e.response?.data?.detail));
    }
    setBusy(false);
  };

  if (!emp) return <div className="h-64 flex items-center justify-center"><div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>;
  const isAdmin = user.role === "admin";
  const canEdit = isAdmin || user.id === emp.user_id;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate("/staff")} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"><ArrowLeft className="w-4 h-4" /> Back to Staff</button>
        <div className="flex items-center gap-3">
          {canEdit && (
            <Button variant="outline" onClick={handleEdit} className="rounded-xl border-slate-200 hover:bg-slate-50 h-9 px-4 text-slate-700">
              <Edit className="w-4 h-4 mr-1.5" /> Edit Staff
            </Button>
          )}
          {isAdmin && (
            <Button variant="outline" onClick={() => setDelOpen(true)} className="rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 h-9 px-4">
              <Trash2 className="w-4 h-4 mr-1.5" /> Delete
            </Button>
          )}
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="rounded-2xl max-w-lg max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader><DialogTitle className="font-heading">Edit Staff Details</DialogTitle></DialogHeader>
          {form && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Full name</Label><Input className="rounded-xl mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Email</Label><Input className="rounded-xl mt-1" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Phone (Username)</Label><Input className="rounded-xl mt-1" value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="col-span-2"><Label>Reset Password (leave blank to keep current)</Label><Input type="text" placeholder="New password" className="rounded-xl mt-1" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
              <div><Label>Department</Label>
                <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
                  <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{depts.map((d) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Designation</Label>
                <Select value={form.designation} onValueChange={(v) => setForm({ ...form, designation: v })}>
                  <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{desigs.map((d) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Monthly salary (₹)</Label><Input type="number" className="rounded-xl mt-1" value={form.monthly_salary} onChange={(e) => setForm({ ...form, monthly_salary: e.target.value })} /></div>
              <div><Label>Shift</Label>
                <Select value={form.shift_id} onValueChange={(v) => setForm({ ...form, shift_id: v })}>
                  <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{shifts.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Role</Label>
                <Select value={form.role || "staff"} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="staff">Staff</SelectItem><SelectItem value="team_leader">Team Leader</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Work Mode</Label>
                <Select value={form.work_mode || "Office"} onValueChange={(v) => setForm({ ...form, work_mode: v })}>
                  <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Office">Office</SelectItem><SelectItem value="Work from Home">Work from Home</SelectItem><SelectItem value="Hybrid">Hybrid</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Location</Label>
                <Select value={form.location} onValueChange={(v) => setForm({ ...form, location: v })}>
                  <SelectTrigger className="rounded-xl mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{locs.map((l) => <SelectItem key={l.id} value={l.name}>{l.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter><Button onClick={submitEdit} disabled={busy} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">{busy ? "Saving…" : "Save Changes"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={delOpen} onOpenChange={setDelOpen}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader><DialogTitle className="font-heading">Delete Staff</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-500">Are you absolutely sure you want to permanently delete {emp.name}? All their attendance, leaves, and payroll records will also be erased.</p>
          <DialogFooter><Button variant="outline" className="rounded-xl" onClick={() => setDelOpen(false)}>Cancel</Button><Button onClick={submitDelete} disabled={busy} className="rounded-xl bg-red-600 hover:bg-red-700 text-white">{busy ? "Deleting…" : "Yes, Delete"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-emerald-500 to-emerald-600" />
        <div className="px-6 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-10">
            <div className="ring-4 ring-white rounded-full w-fit"><Avatar src={emp.photo} name={emp.name} size={84} /></div>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap"><h1 className="font-heading text-2xl font-bold text-slate-900">{emp.name}</h1><StatusBadge status={emp.status} /></div>
              <p className="text-slate-500">{emp.designation} · {emp.department} · {emp.employee_code}</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-2 mt-5 text-sm">
            <Info icon={Mail} text={emp.email || "No email"} />
            <Info icon={Phone} text={emp.phone} />
            <Info icon={Calendar} text={`Joined ${dateStr(emp.joining_date)}`} />
            <Info icon={MapPin} text={emp.location} />
            <Info icon={Building2} text={emp.work_mode || "Office"} />
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-white border border-slate-200 p-5">
          <p className="text-sm text-slate-400 mb-1 flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" /> Monthly Salary</p>
          {isAdmin ? (
            <div className="flex items-center gap-2 mt-1">
              <Input type="number" value={salary} onChange={(e) => setSalary(e.target.value)} className="rounded-xl" data-testid="salary-input" />
              <Button size="sm" onClick={saveSalary} className="rounded-xl bg-emerald-600 hover:bg-emerald-700" data-testid="salary-save"><Save className="w-4 h-4" /></Button>
            </div>
          ) : <p className="font-heading text-2xl font-bold text-slate-900">{money(emp.monthly_salary)}</p>}
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-5"><p className="text-sm text-slate-400 mb-1 flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5" /> Salary Type</p><p className="font-heading text-xl font-semibold text-slate-800">{emp.salary_type}</p></div>
        <div className="rounded-2xl bg-white border border-slate-200 p-5"><p className="text-sm text-slate-400 mb-1 flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> Location</p><p className="font-heading text-xl font-semibold text-slate-800">{emp.location}</p></div>
      </div>

      <Tabs defaultValue="tasks">
        <TabsList className="rounded-xl bg-slate-100">
          <TabsTrigger value="tasks" className="rounded-lg" data-testid="tab-tasks">Tasks</TabsTrigger>
          <TabsTrigger value="leave" className="rounded-lg" data-testid="tab-leave">Leave</TabsTrigger>
          <TabsTrigger value="payroll" className="rounded-lg" data-testid="tab-payroll">Payroll</TabsTrigger>
          <TabsTrigger value="attendance" className="rounded-lg" data-testid="tab-attendance">Attendance</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="mt-4 space-y-2">
          {tasks.length === 0 && <div className="rounded-2xl bg-white border border-slate-200"><EmptyState title="No tasks assigned" /></div>}
          {tasks.map((t) => (
            <div key={t.id} className="rounded-xl bg-white border border-slate-200 p-4 flex items-center justify-between">
              <div><p className="font-medium text-slate-700">{t.title}</p><p className="text-xs text-slate-400">Due {shortDate(t.due_date)} · {t.priority}</p></div>
              <StatusBadge status={t.status === "todo" ? "Pending" : t.status === "in_progress" ? "Approved" : "Paid"} />
            </div>
          ))}
        </TabsContent>
        <TabsContent value="leave" className="mt-4 space-y-2">
          {leaves.length === 0 && <div className="rounded-2xl bg-white border border-slate-200"><EmptyState title="No leave records" /></div>}
          {leaves.map((l) => (
            <div key={l.id} className="rounded-xl bg-white border border-slate-200 p-4 flex items-center justify-between">
              <div><p className="font-medium text-slate-700">{l.leave_type}</p><p className="text-xs text-slate-400">{shortDate(l.from_date)} → {shortDate(l.to_date)} · {l.days}d</p></div>
              <StatusBadge status={l.status} />
            </div>
          ))}
        </TabsContent>
        <TabsContent value="payroll" className="mt-4 space-y-2">
          {payroll.length === 0 && <div className="rounded-2xl bg-white border border-slate-200"><EmptyState title="No payroll for this month yet" /></div>}
          {payroll.map((p) => (
            <div key={p.id} className="rounded-xl bg-white border border-slate-200 p-4 flex items-center justify-between">
              <div><p className="font-medium text-slate-700">{p.month}</p><p className="text-xs text-slate-400">Net {money(p.net)}</p></div>
              <StatusBadge status={p.status} />
            </div>
          ))}
        </TabsContent>
        <TabsContent value="attendance" className="mt-4">
          <div className="rounded-2xl bg-white border border-slate-200 p-5 text-sm text-slate-500">View full attendance history for this employee in the Attendance module.</div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

const Info = ({ icon: Icon, text }) => (<div className="flex items-center gap-2 text-slate-600"><Icon className="w-4 h-4 text-slate-400" /> {text}</div>);
