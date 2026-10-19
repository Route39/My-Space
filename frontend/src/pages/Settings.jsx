import { apiErr } from "@/lib/api";
import { fmtHM, lateAfter } from "@/lib/format";
import { useEffect, useRef, useState } from "react";
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
  const [shiftForm, setShiftForm] = useState({ name: "", start_time: "09:30", end_time: "18:30", grace_minutes: 10, auto_checkout_hours: 10 });

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
    if (!shiftForm.name.trim()) { toast.error("Enter a shift name"); return; }
    if (!shiftForm.start_time || !shiftForm.end_time) { toast.error("Select start and end time"); return; }
    try {
      await api.post("/shifts", {
        ...shiftForm,
        name: shiftForm.name.trim(),
        grace_minutes: Number(shiftForm.grace_minutes) || 0,
        auto_checkout_hours: Number(shiftForm.auto_checkout_hours) || 10,
      });
      setShiftForm({ name: "", start_time: "09:30", end_time: "18:30", grace_minutes: 10, auto_checkout_hours: 10 });
      toast.success("Shift saved"); load();
    } catch (e) { toast.error(apiErr(e.response?.data?.detail) || "Could not save shift"); }
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
          <OfficeLocations company={company} setCompany={setCompany} locs={locs} reload={load} />
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
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
              <div><Label className="text-xs">Name</Label><Input className="rounded-xl mt-1" placeholder="e.g. Night Shift" value={shiftForm.name} onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })} data-testid="shift-name" /></div>
              <div><Label className="text-xs">Start</Label><Input type="time" className="rounded-xl mt-1" value={shiftForm.start_time} onChange={(e) => setShiftForm({ ...shiftForm, start_time: e.target.value })} /></div>
              <div><Label className="text-xs">End</Label><Input type="time" className="rounded-xl mt-1" value={shiftForm.end_time} onChange={(e) => setShiftForm({ ...shiftForm, end_time: e.target.value })} /></div>
              <div><Label className="text-xs">Grace (min)</Label><Input type="number" className="rounded-xl mt-1" value={shiftForm.grace_minutes} onChange={(e) => setShiftForm({ ...shiftForm, grace_minutes: e.target.value })} /></div>
              <div><Label className="text-xs">Auto checkout (hrs)</Label><Input type="number" className="rounded-xl mt-1" value={shiftForm.auto_checkout_hours} onChange={(e) => setShiftForm({ ...shiftForm, auto_checkout_hours: e.target.value })} /></div>
            </div>
            <div className="flex justify-end mt-3">
              <Button type="button" onClick={addShift} className="rounded-xl bg-emerald-600 hover:bg-emerald-700" data-testid="add-shift">
                <Save className="w-4 h-4 mr-2" /> Save Shift
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OfficeLocations({ company, setCompany, locs, reload }) {
  const [rows, setRows] = useState({});
  const [busy, setBusy] = useState({});
  const inflight = useRef({});
  const [sugg, setSugg] = useState({});
  const timers = useRef({});
  const [showAdd, setShowAdd] = useState(false);
  const [newCity, setNewCity] = useState("");
  const [savingCity, setSavingCity] = useState(false);
  const cities = locs.filter((l) => (l.name || "").trim().toLowerCase() !== "remote");

  useEffect(() => {
    const m = {};
    locs.forEach((l) => {
      m[l.id] = {
        address: l.address ?? "",
        lat: l.lat ?? "",
        lng: l.lng ?? "",
        radius_m: l.radius_m ?? 150,
        branches: l.branches || [],
        hubs: l.hubs || [],
      };
    });
    setRows(m);
  }, [locs]);

  const setRow = (id, patch) => setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }));
  const setBusyFor = (k, v) => setBusy((b) => ({ ...b, [k]: v }));

  const suggest = (key, text) => {
    clearTimeout(timers.current[key]);
    const t = (text || "").trim();
    if (t.length < 3 || /^https?:/i.test(t) || /^-?\d{1,3}\.\d+\s*,\s*-?\d{1,3}\.\d+$/.test(t)) {
      setSugg((s) => ({ ...s, [key]: [] }));
      return;
    }
    timers.current[key] = setTimeout(async () => {
      try {
        const { data } = await api.post("/locations/suggest", { query: t });
        setSugg((s) => ({ ...s, [key]: data }));
      } catch (_) { setSugg((s) => ({ ...s, [key]: [] })); }
    }, 400);
  };

  const pickLocation = async (key, s, onSelect) => {
    setSugg((x) => ({ ...x, [key]: [] }));
    if (s.lat != null && s.lng != null) {
      onSelect(s.description, s.lat, s.lng);
      return;
    }
    onSelect(s.description, "", "");
    setBusyFor(key, true);
    try {
      const { data } = await api.post("/locations/place-details", { place_id: s.place_id });
      onSelect(data.address || s.description, data.lat, data.lng);
    } catch (e) { toast.error(apiErr(e.response?.data?.detail)); }
    setBusyFor(key, false);
  };

  const findCoords = (key, address, onResult) => {
    const addr = (address || "").trim();
    if (addr.length < 5) return Promise.resolve(null);
    if (inflight.current[key]) return inflight.current[key];
    setBusyFor(key, true);
    const p = api.post("/locations/geocode", { address: addr })
      .then(({ data }) => { onResult(data.lat, data.lng); return data; })
      .catch((e) => { onResult("", ""); toast.error(apiErr(e.response?.data?.detail)); return null; })
      .finally(() => { delete inflight.current[key]; setBusyFor(key, false); });
    inflight.current[key] = p;
    return p;
  };

  const here = (onResult) => {
    if (!navigator.geolocation) { toast.error("Location not supported in this browser"); return; }
    const toastId = toast.loading("Detecting current GPS coordinates…");
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const lat = p.coords.latitude, lng = p.coords.longitude;
        try {
          const { data } = await api.post("/locations/reverse", { lat, lng });
          onResult(data.address, lat, lng);
          toast.success("GPS location and address detected", { id: toastId });
        } catch (_) {
          onResult("", lat, lng);
          toast.message("GPS coordinates updated.", { id: toastId });
        }
      },
      () => toast.error("Could not read GPS location. Allow location permissions.", { id: toastId }),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const addCity = async () => {
    const name = newCity.trim();
    if (!name) { toast.error("Enter a city name"); return; }
    if (locs.some((x) => (x.name || "").trim().toLowerCase() === name.toLowerCase())) {
      toast.error("This city already exists"); return;
    }
    setSavingCity(true);
    try {
      await api.post("/locations", { name });
      toast.success(`Location "${name}" added`);
      setNewCity(""); setShowAdd(false);
      reload();
    } catch (e) { toast.error(apiErr(e.response?.data?.detail)); }
    setSavingCity(false);
  };

  const deleteCity = async (loc) => {
    if (!window.confirm(`Delete "${loc.name}" and all its office/hub geofences?`)) return;
    try {
      await api.delete(`/locations/${loc.id}`);
      toast.success(`"${loc.name}" deleted`);
      reload();
    } catch (e) { toast.error(apiErr(e.response?.data?.detail)); }
  };

  const toggle = async (checked) => {
    try {
      const { data } = await api.put("/company", { geofence_enabled: checked });
      setCompany(data);
      toast.success(checked ? "Physical Office Entry Geofence is ACTIVE" : "Office Geofence is OFF");
    } catch (e) { toast.error(apiErr(e.response?.data?.detail)); }
  };

  const save = async (id) => {
    const r = rows[id];
    let lat = r.lat, lng = r.lng;
    if ((r.address || "").trim() && (lat === "" || lng === "")) {
      const found = await findCoords(`${id}:main`, r.address, (la, ln) => { lat = la; lng = ln; });
      if (found) { lat = found.lat; lng = found.lng; }
    }
    if (!lat || !lng) {
      toast.error("Please configure the Main Office GPS coordinates first.");
      return;
    }
    try {
      await api.put(`/locations/${id}/geo`, {
        address: (r.address || "").trim(),
        lat: Number(lat),
        lng: Number(lng),
        radius_m: Number(r.radius_m) || 150,
        branches: (r.branches || []).map((b) => ({
          name: (b.name || "Office").trim(),
          address: (b.address || "").trim(),
          lat: b.lat === "" || b.lat == null ? null : Number(b.lat),
          lng: b.lng === "" || b.lng == null ? null : Number(b.lng),
          radius_m: Number(b.radius_m) || 150,
        })),
        hubs: (r.hubs || []).map((h) => ({
          name: (h.name || "Hub").trim(),
          address: (h.address || "").trim(),
          lat: h.lat === "" || h.lat == null ? null : Number(h.lat),
          lng: h.lng === "" || h.lng == null ? null : Number(h.lng),
          radius_m: Number(h.radius_m) || 150,
        })),
      });
      toast.success("Office & Hub Geofences saved successfully!");
      reload();
    } catch (e) { toast.error(apiErr(e.response?.data?.detail)); }
  };

  // Helpers to add additional offices or hubs
  const addBranch = (locId) => {
    const current = rows[locId]?.branches || [];
    setRow(locId, {
      branches: [...current, { name: `Branch ${current.length + 2}`, address: "", lat: "", lng: "", radius_m: 150 }]
    });
  };

  const removeBranch = (locId, idx) => {
    const current = [...(rows[locId]?.branches || [])];
    current.splice(idx, 1);
    setRow(locId, { branches: current });
  };

  const updateBranch = (locId, idx, patch) => {
    const current = [...(rows[locId]?.branches || [])];
    current[idx] = { ...current[idx], ...patch };
    setRow(locId, { branches: current });
  };

  const addHub = (locId) => {
    const current = rows[locId]?.hubs || [];
    setRow(locId, {
      hubs: [...current, { name: `Hub ${current.length + 1}`, address: "", lat: "", lng: "", radius_m: 150 }]
    });
  };

  const removeHub = (locId, idx) => {
    const current = [...(rows[locId]?.hubs || [])];
    current.splice(idx, 1);
    setRow(locId, { hubs: current });
  };

  const updateHub = (locId, idx, patch) => {
    const current = [...(rows[locId]?.hubs || [])];
    current[idx] = { ...current[idx], ...patch };
    setRow(locId, { hubs: current });
  };

  return (
    <div className="space-y-6">
      {/* Executive Clean Header with Toggle */}
      <div className="rounded-2xl bg-white border border-slate-200/80 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 font-heading">
              Biometric-Grade Physical Entry Check-in
            </h2>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live Google Maps Verified
            </span>
          </div>
          <p className="text-sm text-slate-500 max-w-2xl">
            Just like punching a physical biometric machine at the entrance, employees can <strong>only check in after physically stepping inside</strong> their assigned office or authorized hubs.
          </p>
        </div>

        {/* Big Clean Toggle */}
        <div className="flex items-center gap-4 bg-slate-50 border border-slate-200/80 px-5 py-3 rounded-2xl">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Geofence Policy</span>
            <span className={`text-sm font-bold ${company.geofence_enabled ? "text-emerald-600" : "text-slate-500"}`}>
              {company.geofence_enabled ? "Strict Entrance-Only (ACTIVE)" : "Off (Anywhere Allowed)"}
            </span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={!!company.geofence_enabled}
              onChange={(e) => toggle(e.target.checked)}
            />
            <div className="w-13 h-7 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-600 shadow-inner"></div>
          </label>
        </div>
      </div>

      {/* Offices List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-800 font-heading">Operating Cities & Office Complexes ({cities.length})</h3>
            <p className="text-xs text-slate-400">Search addresses on Google Maps. Add multiple offices or multiple hubs (+ Office / + Hub) per location.</p>
          </div>
          {!showAdd && (
            <Button
              type="button"
              onClick={() => setShowAdd(true)}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs h-9 px-4 shadow-sm"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Add Location
            </Button>
          )}
        </div>

        {/* Add Location Row */}
        {showAdd && (
          <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/70 p-4 shadow-sm transition-all animate-in fade-in flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[240px]">
              <Input
                className="rounded-xl bg-white border-emerald-300 focus:border-emerald-500 shadow-sm"
                placeholder="Enter city/location name (e.g. Coimbatore, Bangalore, Chennai)"
                autoFocus
                value={newCity}
                onChange={(e) => setNewCity(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addCity();
                  if (e.key === "Escape") { setShowAdd(false); setNewCity(""); }
                }}
              />
            </div>
            <Button
              type="button"
              disabled={savingCity}
              onClick={addCity}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs h-10 px-4"
            >
              <Save className="w-4 h-4 mr-1.5" /> Save Location
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl bg-white hover:bg-slate-50 text-xs h-10"
              onClick={() => { setShowAdd(false); setNewCity(""); }}
            >
              Cancel
            </Button>
          </div>
        )}

        {cities.length === 0 && (
          <div className="rounded-2xl bg-white border border-dashed border-slate-300 p-8 text-center">
            <p className="text-sm text-slate-500 mb-3">No office locations configured yet.</p>
            <Button onClick={() => setShowAdd(true)} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 mr-1.5" /> Add Location
            </Button>
          </div>
        )}

        {/* City Location Cards */}
        <div className="space-y-4">
          {cities.map((l) => {
            const row = rows[l.id] || {};
            const isMainConfigured = row.lat && row.lng;
            const branches = row.branches || [];
            const hubs = row.hubs || [];
            const totalPoints = (isMainConfigured ? 1 : 0) + branches.filter(b => b.lat && b.lng).length + hubs.filter(h => h.lat && h.lng).length;

            return (
              <div
                key={l.id}
                className="rounded-2xl bg-white border border-slate-200/90 p-5 shadow-sm hover:shadow-md transition-shadow space-y-5"
              >
                {/* Header: Location Name + Configured Count + Actions */}
                <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center font-heading text-sm shadow-sm">
                      {l.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-heading font-bold text-slate-900 text-lg">{l.name}</span>
                        {totalPoints > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {totalPoints} Check-in Point{totalPoints > 1 ? "s" : ""} Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Setup Required
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">Staff assigned to {l.name} can check in at any configured office or hub listed below.</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => addBranch(l.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-medium bg-slate-50 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Another Office
                    </button>
                    <button
                      type="button"
                      onClick={() => addHub(l.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-medium bg-slate-50 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Hub
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteCity(l)}
                      title="Delete location"
                      className="text-xs text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* 1. Main Office Point */}
                <div className="rounded-xl bg-slate-50/50 border border-slate-200/80 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-700 font-heading">
                        Main Office (Primary)
                      </span>
                    </div>
                    {isMainConfigured && (
                      <a
                        href={`https://www.google.com/maps?q=${row.lat},${row.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-emerald-600 hover:text-emerald-700 font-medium inline-flex items-center gap-1"
                      >
                        View Pin ↗
                      </a>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    <div className="md:col-span-8 relative">
                      <Label className="text-xs font-semibold text-slate-700 flex items-center justify-between mb-1">
                        <span>Office Address (Google Maps Search)</span>
                        {busy[`${l.id}:main`] && <span className="text-emerald-600 text-[11px] animate-pulse">Resolving GPS…</span>}
                      </Label>
                      <Input
                        className="rounded-xl bg-white h-10 text-sm"
                        placeholder="Type landmark, building, or street address on Google Maps…"
                        value={row.address || ""}
                        autoComplete="off"
                        onChange={(e) => {
                          setRow(l.id, { address: e.target.value, lat: "", lng: "" });
                          suggest(`${l.id}:main`, e.target.value);
                        }}
                        onBlur={() => {
                          setTimeout(() => setSugg((s) => ({ ...s, [`${l.id}:main`]: [] })), 150);
                          if (!row.lat) findCoords(`${l.id}:main`, row.address, (la, ln) => setRow(l.id, { lat: la, lng: ln }));
                        }}
                        onKeyDown={(e) => e.key === "Enter" && findCoords(`${l.id}:main`, row.address, (la, ln) => setRow(l.id, { lat: la, lng: ln }))}
                      />
                      {(sugg[`${l.id}:main`] || []).length > 0 && (
                        <ul className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-56 overflow-auto divide-y divide-slate-100">
                          {sugg[`${l.id}:main`].map((s, i) => (
                            <li
                              key={s.place_id || i}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                pickLocation(`${l.id}:main`, s, (addr, la, ln) => setRow(l.id, { address: addr, lat: la, lng: ln }));
                              }}
                              className="px-4 py-2.5 text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 cursor-pointer flex items-center gap-2 transition-colors"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                              <span className="line-clamp-1">{s.description}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="md:col-span-2">
                      <Label className="text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                        <span>Radius (m)</span>
                        <span className="text-[10px] text-emerald-600 font-medium">
                          {(row.radius_m || 50) <= 50 ? "Door / Entry" : (row.radius_m || 50) <= 100 ? "Whole Floor" : "Campus"}
                        </span>
                      </Label>
                      <Input
                        type="number"
                        className="rounded-xl bg-white h-10 text-sm font-semibold"
                        placeholder="e.g. 50"
                        value={row.radius_m || 50}
                        onChange={(e) => setRow(l.id, { radius_m: e.target.value })}
                      />
                      <div className="flex gap-1 mt-1">
                        <button type="button" onClick={() => setRow(l.id, { radius_m: 40 })} className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${row.radius_m == 40 ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>40m (Door)</button>
                        <button type="button" onClick={() => setRow(l.id, { radius_m: 80 })} className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${row.radius_m == 80 ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>80m (Floor)</button>
                        <button type="button" onClick={() => setRow(l.id, { radius_m: 150 })} className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${row.radius_m == 150 ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>150m</button>
                      </div>
                    </div>

                    <div className="md:col-span-2 flex items-center">
                      <button
                        type="button"
                        onClick={() => here((addr, la, ln) => setRow(l.id, { address: addr || row.address, lat: la, lng: ln }))}
                        className="w-full text-xs h-10 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-medium inline-flex items-center justify-center gap-1 shadow-sm"
                      >
                        📍 Use My GPS
                      </button>
                    </div>
                  </div>

                  {/* Exact Google Pin Display */}
                  {row.lat && row.lng && (
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60 text-slate-500">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span className="font-medium text-emerald-800">Exact Google Pin Verified:</span>
                        <span className="font-mono text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {Number(row.lat).toFixed(6)}, {Number(row.lng).toFixed(6)}
                        </span>
                      </div>
                      <a
                        href={`https://www.google.com/maps?q=${row.lat},${row.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-600 hover:text-emerald-700 font-medium inline-flex items-center gap-1 hover:underline"
                      >
                        Verify on Satellite Map ↗
                      </a>
                    </div>
                  )}
                </div>

                {/* 2. Additional Offices / Branches */}
                {branches.map((b, bIdx) => {
                  const bKey = `${l.id}:b:${bIdx}`;
                  const isBranchConfigured = b.lat && b.lng;
                  return (
                    <div key={bIdx} className="rounded-xl bg-slate-50/50 border border-slate-200/80 p-4 space-y-3 animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          <Input
                            className="h-7 w-48 text-xs font-bold text-slate-800 bg-transparent border-0 border-b border-transparent hover:border-slate-300 focus:border-blue-500 px-0"
                            value={b.name || `Office ${bIdx + 2}`}
                            onChange={(e) => updateBranch(l.id, bIdx, { name: e.target.value })}
                          />
                        </div>
                        <div className="flex items-center gap-3">
                          {isBranchConfigured && (
                            <a
                              href={`https://www.google.com/maps?q=${b.lat},${b.lng}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1"
                            >
                              View Pin ↗
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => removeBranch(l.id, bIdx)}
                            className="text-xs text-red-500 hover:text-red-700 inline-flex items-center gap-0.5"
                          >
                            <X className="w-3.5 h-3.5" /> Remove
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                        <div className="md:col-span-8 relative">
                          <Label className="text-xs font-semibold text-slate-700 flex items-center justify-between mb-1">
                            <span>Branch Address (Google Maps Search)</span>
                            {busy[bKey] && <span className="text-blue-600 text-[11px] animate-pulse">Resolving GPS…</span>}
                          </Label>
                          <Input
                            className="rounded-xl bg-white h-10 text-sm"
                            placeholder="Type branch location or landmark…"
                            value={b.address || ""}
                            autoComplete="off"
                            onChange={(e) => {
                              updateBranch(l.id, bIdx, { address: e.target.value, lat: "", lng: "" });
                              suggest(bKey, e.target.value);
                            }}
                            onBlur={() => {
                              setTimeout(() => setSugg((s) => ({ ...s, [bKey]: [] })), 150);
                              if (!b.lat) findCoords(bKey, b.address, (la, ln) => updateBranch(l.id, bIdx, { lat: la, lng: ln }));
                            }}
                            onKeyDown={(e) => e.key === "Enter" && findCoords(bKey, b.address, (la, ln) => updateBranch(l.id, bIdx, { lat: la, lng: ln }))}
                          />
                          {(sugg[bKey] || []).length > 0 && (
                            <ul className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-56 overflow-auto divide-y divide-slate-100">
                              {sugg[bKey].map((s, i) => (
                                <li
                                  key={s.place_id || i}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    pickLocation(bKey, s, (addr, la, ln) => updateBranch(l.id, bIdx, { address: addr, lat: la, lng: ln }));
                                  }}
                                  className="px-4 py-2.5 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-900 cursor-pointer flex items-center gap-2 transition-colors"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                                  <span className="line-clamp-1">{s.description}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <div className="md:col-span-2">
                          <Label className="text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                            <span>Radius (m)</span>
                            <span className="text-[10px] text-blue-600 font-medium">
                              {(b.radius_m || 50) <= 50 ? "Door / Entry" : "Floor"}
                            </span>
                          </Label>
                          <Input
                            type="number"
                            className="rounded-xl bg-white h-10 text-sm font-semibold"
                            value={b.radius_m || 50}
                            onChange={(e) => updateBranch(l.id, bIdx, { radius_m: e.target.value })}
                          />
                        </div>

                        <div className="md:col-span-2 flex items-center">
                          <button
                            type="button"
                            onClick={() => here((addr, la, ln) => updateBranch(l.id, bIdx, { address: addr || b.address, lat: la, lng: ln }))}
                            className="w-full text-xs h-10 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-medium inline-flex items-center justify-center gap-1 shadow-sm"
                          >
                            📍 Use My GPS
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* 3. Hubs / Warehouses */}
                {hubs.map((h, hIdx) => {
                  const hKey = `${l.id}:h:${hIdx}`;
                  const isHubConfigured = h.lat && h.lng;
                  return (
                    <div key={hIdx} className="rounded-xl bg-amber-50/40 border border-amber-200/80 p-4 space-y-3 animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          <Input
                            className="h-7 w-48 text-xs font-bold text-amber-950 bg-transparent border-0 border-b border-transparent hover:border-amber-300 focus:border-amber-500 px-0"
                            value={h.name || `Hub ${hIdx + 1}`}
                            onChange={(e) => updateHub(l.id, hIdx, { name: e.target.value })}
                          />
                        </div>
                        <div className="flex items-center gap-3">
                          {isHubConfigured && (
                            <a
                              href={`https://www.google.com/maps?q=${h.lat},${h.lng}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-amber-700 hover:text-amber-800 font-medium inline-flex items-center gap-1"
                            >
                              View Pin ↗
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => removeHub(l.id, hIdx)}
                            className="text-xs text-red-500 hover:text-red-700 inline-flex items-center gap-0.5"
                          >
                            <X className="w-3.5 h-3.5" /> Remove
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                        <div className="md:col-span-8 relative">
                          <Label className="text-xs font-semibold text-slate-700 flex items-center justify-between mb-1">
                            <span>Hub / Warehouse Address (Google Maps Search)</span>
                            {busy[hKey] && <span className="text-amber-600 text-[11px] animate-pulse">Resolving GPS…</span>}
                          </Label>
                          <Input
                            className="rounded-xl bg-white h-10 text-sm"
                            placeholder="Type hub location, warehouse, or depot address…"
                            value={h.address || ""}
                            autoComplete="off"
                            onChange={(e) => {
                              updateHub(l.id, hIdx, { address: e.target.value, lat: "", lng: "" });
                              suggest(hKey, e.target.value);
                            }}
                            onBlur={() => {
                              setTimeout(() => setSugg((s) => ({ ...s, [hKey]: [] })), 150);
                              if (!h.lat) findCoords(hKey, h.address, (la, ln) => updateHub(l.id, hIdx, { lat: la, lng: ln }));
                            }}
                            onKeyDown={(e) => e.key === "Enter" && findCoords(hKey, h.address, (la, ln) => updateHub(l.id, hIdx, { lat: la, lng: ln }))}
                          />
                          {(sugg[hKey] || []).length > 0 && (
                            <ul className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-56 overflow-auto divide-y divide-slate-100">
                              {sugg[hKey].map((s, i) => (
                                <li
                                  key={s.place_id || i}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    pickLocation(hKey, s, (addr, la, ln) => updateHub(l.id, hIdx, { address: addr, lat: la, lng: ln }));
                                  }}
                                  className="px-4 py-2.5 text-xs text-slate-700 hover:bg-amber-100 hover:text-amber-950 cursor-pointer flex items-center gap-2 transition-colors"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                                  <span className="line-clamp-1">{s.description}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <div className="md:col-span-2">
                          <Label className="text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                            <span>Radius (m)</span>
                            <span className="text-[10px] text-amber-700 font-medium">
                              {(h.radius_m || 50) <= 50 ? "Depot Entry" : "Compound"}
                            </span>
                          </Label>
                          <Input
                            type="number"
                            className="rounded-xl bg-white h-10 text-sm font-semibold"
                            value={h.radius_m || 50}
                            onChange={(e) => updateHub(l.id, hIdx, { radius_m: e.target.value })}
                          />
                        </div>

                        <div className="md:col-span-2 flex items-center">
                          <button
                            type="button"
                            onClick={() => here((addr, la, ln) => updateHub(l.id, hIdx, { address: addr || h.address, lat: la, lng: ln }))}
                            className="w-full text-xs h-10 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-medium inline-flex items-center justify-center gap-1 shadow-sm"
                          >
                            📍 Use My GPS
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Footer Save Button for this city */}
                <div className="pt-2 flex justify-end">
                  <Button
                    type="button"
                    onClick={() => save(l.id)}
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs h-10 px-6 shadow-sm shadow-emerald-600/20"
                  >
                    <Save className="w-4 h-4 mr-1.5" /> Save All {l.name} Check-in Locations
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
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
