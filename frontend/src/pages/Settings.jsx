import { apiErr } from "@/lib/api";
import { fmtHM, lateAfter } from "@/lib/format";
import { useEffect, useState } from "react";
import { Plus, Trash2, Save, Pencil, X, Check } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function Settings() {
  const [company, setCompany] = useState(null);
  const [depts, setDepts] = useState([]);
  const [desigs, setDesigs] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", start_time: "09:30", end_time: "18:30", grace_minutes: 10, auto_checkout_hours: 10 });
  const [locs, setLocs] = useState([]);
  const [newDept, setNewDept] = useState("");
  const [newDesig, setNewDesig] = useState("");
  const [newLoc, setNewLoc] = useState("");
  const [shiftForm, setShiftForm] = useState({ name: "", start_time: "09:30", end_time: "18:30", grace_minutes: 10 });

  const load = async () => {
    const [c, d, dg, s, loc_res] = await Promise.all([
      api.get("/company"), api.get("/departments"), api.get("/designations"), api.get("/shifts"),
      api.get("/locations").catch(() => ({ data: [] }))
    ]);
    setCompany(c.data); setDepts(d.data); setDesigs(dg.data); setShifts(s.data); setLocs(loc_res.data);
  };
  useEffect(() => { load(); }, []);

  const saveCompany = async () => {
    await api.put("/company", { name: company.name, address: company.address });
    toast.success("Company saved");
  };
  const addDept = async () => { if (!newDept.trim()) return; await api.post("/departments", { name: newDept }); setNewDept(""); load(); };
  const delDept = async (id) => { await api.delete(`/departments/${id}`); load(); };
  const addDesig = async () => { if (!newDesig.trim()) return; await api.post("/designations", { name: newDesig }); setNewDesig(""); load(); };
  const delDesig = async (id) => { await api.delete(`/designations/${id}`); load(); };
  const addLoc = async () => { if (!newLoc.trim()) return; await api.post("/locations", { name: newLoc }); setNewLoc(""); load(); };
  const delLoc = async (id) => { await api.delete(`/locations/${id}`); load(); };
  const startEdit = (s) => { setEditId(s.id); setEditForm({ name: s.name, start_time: s.start_time, end_time: s.end_time, grace_minutes: s.grace_minutes ?? 10, auto_checkout_hours: s.auto_checkout_hours ?? 10 }); };
  const saveEdit = async () => {
    try {
      await api.put(`/shifts/${editId}`, { ...editForm, grace_minutes: Number(editForm.grace_minutes), auto_checkout_hours: Number(editForm.auto_checkout_hours) });
      toast.success("Shift updated"); setEditId(null); load();
    } catch (e) { toast.error(apiErr(e.response?.data?.detail)); }
  };
  const delShift = async (id) => {
    if (!window.confirm("Delete this shift?")) return;
    try { await api.delete(`/shifts/${id}`); toast.success("Shift deleted"); load(); }
    catch (e) { toast.error(apiErr(e.response?.data?.detail)); }
  };
  const addShift = async () => {
    if (!shiftForm.name.trim()) return;
    await api.post("/shifts", { ...shiftForm, grace_minutes: Number(shiftForm.grace_minutes) });
    setShiftForm({ name: "", start_time: "09:30", end_time: "18:30", grace_minutes: 10 });
    toast.success("Shift added"); load();
  };

  if (!company) return null;

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl font-bold text-slate-900 tracking-tight">Settings</h1>
      <Tabs defaultValue="company">
        <TabsList className="rounded-xl bg-slate-100 flex-wrap h-auto">
          <TabsTrigger value="company" className="rounded-lg" data-testid="settings-company">Company</TabsTrigger>
          <TabsTrigger value="staff" className="rounded-lg" data-testid="settings-staff">Staff</TabsTrigger>
          <TabsTrigger value="attendance" className="rounded-lg" data-testid="settings-attendance">Attendance</TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="mt-4">
          <div className="rounded-2xl bg-white border border-slate-200 p-6 max-w-lg space-y-4">
            <div><Label>Company name</Label><Input className="rounded-xl mt-1" value={company.name || ""} onChange={(e) => setCompany({ ...company, name: e.target.value })} data-testid="company-name" /></div>
            <div><Label>Address</Label><Input className="rounded-xl mt-1" value={company.address || ""} onChange={(e) => setCompany({ ...company, address: e.target.value })} /></div>
            <Button onClick={saveCompany} className="rounded-xl bg-emerald-600 hover:bg-emerald-700" data-testid="save-company"><Save className="w-4 h-4 mr-2" /> Save</Button>
          </div>
        </TabsContent>

        <TabsContent value="staff" className="mt-4 grid md:grid-cols-2 gap-6">
          <ListEditor title="Departments" items={depts} val={newDept} setVal={setNewDept} onAdd={addDept} onDel={delDept} testid="dept" />
          <ListEditor title="Designations" items={desigs} val={newDesig} setVal={setNewDesig} onAdd={addDesig} onDel={delDesig} testid="desig" />
          <ListEditor title="Locations" items={locs} val={newLoc} setVal={setNewLoc} onAdd={addLoc} onDel={delLoc} testid="loc" />
        </TabsContent>

        <TabsContent value="attendance" className="mt-4 space-y-4">
          <div className="rounded-2xl bg-white border border-slate-200 p-5">
            <p className="font-heading font-semibold text-slate-800 mb-3">Shifts</p>
            <div className="space-y-2 mb-4">
              {shifts.map((s) => (
                editId === s.id ? (
                  <div key={s.id} className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end border border-emerald-200 bg-emerald-50/40 rounded-xl p-3">
                    <div><Label className="text-xs">Name</Label><Input className="rounded-xl mt-1" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></div>
                    <div><Label className="text-xs">Start</Label><Input type="time" className="rounded-xl mt-1" value={editForm.start_time} onChange={(e) => setEditForm({ ...editForm, start_time: e.target.value })} /></div>
                    <div><Label className="text-xs">End</Label><Input type="time" className="rounded-xl mt-1" value={editForm.end_time} onChange={(e) => setEditForm({ ...editForm, end_time: e.target.value })} /></div>
                    <div><Label className="text-xs">Grace (min)</Label><Input type="number" className="rounded-xl mt-1" value={editForm.grace_minutes} onChange={(e) => setEditForm({ ...editForm, grace_minutes: e.target.value })} /></div>
                    <div><Label className="text-xs">Auto checkout (hrs)</Label><Input type="number" className="rounded-xl mt-1" value={editForm.auto_checkout_hours} onChange={(e) => setEditForm({ ...editForm, auto_checkout_hours: e.target.value })} /></div>
                    <div className="flex gap-2">
                      <Button onClick={saveEdit} className="rounded-xl bg-emerald-600 hover:bg-emerald-700"><Check className="w-4 h-4" /></Button>
                      <Button onClick={() => setEditId(null)} variant="outline" className="rounded-xl"><X className="w-4 h-4" /></Button>
                    </div>
                  </div>
                ) : (
                  <div key={s.id} className="flex items-center justify-between text-sm border border-slate-100 rounded-xl px-4 py-2.5 gap-3">
                    <span className="font-medium text-slate-700">{s.name}</span>
                    <span className="text-slate-500 flex-1 text-right">
                      {fmtHM(s.start_time)} → {fmtHM(s.end_time)} · grace {s.grace_minutes}m · <span className="text-red-500">late after {lateAfter(s)}</span> · auto checkout {s.auto_checkout_hours ?? 10}h
                    </span>
                    <button onClick={() => startEdit(s)} className="text-slate-400 hover:text-emerald-600" title="Edit"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => delShift(s.id)} className="text-slate-400 hover:text-red-500" title="Delete"><Trash2 className="w-4 h-4" /></button>
                  </div>
                )
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
              <div><Label className="text-xs">Name</Label><Input className="rounded-xl mt-1" value={shiftForm.name} onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })} data-testid="shift-name" /></div>
              <div><Label className="text-xs">Start</Label><Input type="time" className="rounded-xl mt-1" value={shiftForm.start_time} onChange={(e) => setShiftForm({ ...shiftForm, start_time: e.target.value })} /></div>
              <div><Label className="text-xs">End</Label><Input type="time" className="rounded-xl mt-1" value={shiftForm.end_time} onChange={(e) => setShiftForm({ ...shiftForm, end_time: e.target.value })} /></div>
              <div className="flex gap-2">
                <div className="flex-1"><Label className="text-xs">Grace</Label><Input type="number" className="rounded-xl mt-1" value={shiftForm.grace_minutes} onChange={(e) => setShiftForm({ ...shiftForm, grace_minutes: e.target.value })} /></div>
                <Button onClick={addShift} className="rounded-xl bg-emerald-600 hover:bg-emerald-700" data-testid="add-shift"><Plus className="w-4 h-4" /></Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ListEditor({ title, items, val, setVal, onAdd, onDel, testid }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5">
      <p className="font-heading font-semibold text-slate-800 mb-3">{title}</p>
      <div className="space-y-1.5 mb-3">
        {items.map((it) => (
          <div key={it.id} className="flex items-center justify-between text-sm border border-slate-100 rounded-xl px-3 py-2">
            <span className="text-slate-700">{it.name}</span>
            <button onClick={() => onDel(it.id)} className="text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Input className="rounded-xl" placeholder={`Add ${title.toLowerCase().slice(0, -1)}`} value={val} onChange={(e) => setVal(e.target.value)} data-testid={`${testid}-input`} onKeyDown={(e) => e.key === "Enter" && onAdd()} />
        <Button onClick={onAdd} className="rounded-xl bg-emerald-600 hover:bg-emerald-700" data-testid={`${testid}-add`}><Plus className="w-4 h-4" /></Button>
      </div>
    </div>
  );
}
