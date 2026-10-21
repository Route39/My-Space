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
      m[l.id] = { address: l.address ?? "", lat: l.lat ?? "", lng: l.lng ?? "", radius_m: l.radius_m ?? 150,
                  hub_address: l.hub_address ?? "", hub_lat: l.hub_lat ?? "", hub_lng: l.hub_lng ?? "" };
    });
    setRows(m);
  }, [locs]);

  const setRow = (id, patch) => setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }));
  const setBusyFor = (id, v) => setBusy((b) => ({ ...b, [id]: v }));

  // field names for each kind: [address, lat, lng]
  const FIELDS = { office: ["address", "lat", "lng"], hub: ["hub_address", "hub_lat", "hub_lng"] };
  const bk = (id, kind) => (kind === "hub" ? `${id}:hub` : id);

  // typed text -> suggestions list (waits 400ms after typing stops)
  const suggest = (id, text, kind = "office") => {
    const k = bk(id, kind);
    clearTimeout(timers.current[k]);
    const t = (text || "").trim();
    if (t.length < 3 || /^https?:/i.test(t) || /^-?\d{1,3}\.\d+\s*,\s*-?\d{1,3}\.\d+$/.test(t)) {
      setSugg((s) => ({ ...s, [k]: [] }));
      return;
    }
    timers.current[k] = setTimeout(async () => {
      try {
        const { data } = await api.post("/locations/suggest", { query: t });
        setSugg((s) => ({ ...s, [k]: data }));
      } catch (_) { setSugg((s) => ({ ...s, [k]: [] })); }
    }, 400);
  };

  // user clicked a suggestion
  const pick = async (id, s, kind = "office") => {
    const k = bk(id, kind);
    const [fa, fl, fn] = FIELDS[kind];
    setSugg((x) => ({ ...x, [k]: [] }));
    if (s.lat != null && s.lng != null) {
      setRow(id, { [fa]: s.description, [fl]: s.lat, [fn]: s.lng });
      return;
    }
    setRow(id, { [fa]: s.description, [fl]: "", [fn]: "" });
    setBusyFor(k, true);
    try {
      const { data } = await api.post("/locations/place-details", { place_id: s.place_id });
      setRow(id, { [fa]: data.address || s.description, [fl]: data.lat, [fn]: data.lng });
    } catch (e) { toast.error(apiErr(e.response?.data?.detail)); }
    setBusyFor(k, false);
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
      toast.success("City added");
      setNewCity(""); setShowAdd(false);
      reload();
    } catch (e) { toast.error(apiErr(e.response?.data?.detail)); }
    setSavingCity(false);
  };

  const deleteCity = async (loc) => {
    if (!window.confirm(`Delete "${loc.name}" and its office/hub location?`)) return;
    try {
      await api.delete(`/locations/${loc.id}`);
      toast.success("City deleted");
      reload();
    } catch (e) { toast.error(apiErr(e.response?.data?.detail)); }
  };

  const toggle = async (checked) => {
    try {
      const { data } = await api.put("/company", { geofence_enabled: checked });
      setCompany(data);
      toast.success(checked ? "Office-only check-in is ON" : "Office-only check-in is OFF");
    } catch (e) { toast.error(apiErr(e.response?.data?.detail)); }
  };

  // address -> latitude/longitude (shares one request if it is already running)
  const findCoords = (id, address, kind = "office") => {
    const [, fl, fn] = FIELDS[kind];
    const k = bk(id, kind);
    const addr = (address || "").trim();
    if (addr.length < 5) return Promise.resolve(null);
    const key = `${k}|${addr}`;
    if (inflight.current[key]) return inflight.current[key];
    setBusyFor(k, true);
    const p = api.post("/locations/geocode", { address: addr })
      .then(({ data }) => { setRow(id, { [fl]: data.lat, [fn]: data.lng }); return data; })
      .catch((e) => { setRow(id, { [fl]: "", [fn]: "" }); toast.error(apiErr(e.response?.data?.detail)); return null; })
      .finally(() => { delete inflight.current[key]; setBusyFor(k, false); });
    inflight.current[key] = p;
    return p;
  };

  const here = (id, kind = "office") => {
    const [fa, fl, fn] = FIELDS[kind];
    if (!navigator.geolocation) { toast.error("Location not supported in this browser"); return; }
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const lat = p.coords.latitude, lng = p.coords.longitude;
        setRow(id, { [fl]: lat, [fn]: lng });
        try {
          const { data } = await api.post("/locations/reverse", { lat, lng });
          setRow(id, { [fa]: data.address });
        } catch (_) {
          setRow(id, { [fa]: "" });
          toast.message("Location set, but the address could not be found. Type the address if you want it saved.");
        }
      },
      () => toast.error("Could not get your location. Allow location access."),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const save = async (id) => {
    const r = rows[id];
    let lat = r.lat, lng = r.lng, hlat = r.hub_lat, hlng = r.hub_lng;
    if ((r.address || "").trim() && (lat === "" || lng === "")) {
      const found = await findCoords(id, r.address, "office");
      if (!found) return;
      lat = found.lat; lng = found.lng;
    }
    if ((r.hub_address || "").trim() && (hlat === "" || hlng === "")) {
      const foundH = await findCoords(id, r.hub_address, "hub");
      if (!foundH) return;
      hlat = foundH.lat; hlng = foundH.lng;
    }
    try {
      await api.put(`/locations/${id}/geo`, {
        address: (r.address || "").trim(),
        lat: lat === "" ? null : Number(lat),
        lng: lng === "" ? null : Number(lng),
        radius_m: Number(r.radius_m) || 150,
        hub_address: (r.hub_address || "").trim(),
        hub_lat: hlat === "" ? null : Number(hlat),
        hub_lng: hlng === "" ? null : Number(hlng),
      });
      toast.success("Office location saved"); reload();
    } catch (e) { toast.error(apiErr(e.response?.data?.detail)); }
  };

  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5">
      <p className="font-heading font-semibold text-slate-800">Office check-in (by city)</p>
      <label className="flex items-center gap-2 text-sm text-slate-700 mt-2">
        <input type="checkbox" checked={!!company.geofence_enabled} onChange={(e) => toggle(e.target.checked)} />
        Allow check-in only at the employee's city office
      </label>
      <p className="text-xs text-slate-500 mt-2 mb-3">
        Enter each office's full address. Latitude and longitude are filled in automatically. Staff with Work Mode "Office" must be
        within the radius of their city's office. Staff whose location is "Remote" can check in from anywhere.
      </p>
      <div className="space-y-3">
        {cities.map((l) => rows[l.id] && (
          <div key={l.id} className="rounded-xl border border-slate-100 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-800">{l.name}</span>
              <div className="flex items-center gap-4">
                {rows[l.id].lat !== "" && rows[l.id].lng !== "" && (
                  <a href={`https://www.google.com/maps?q=${rows[l.id].lat},${rows[l.id].lng}`} target="_blank" rel="noreferrer"
                     className="text-xs text-emerald-600 hover:underline">View on map ↗</a>
                )}
                <button type="button" onClick={() => deleteCity(l)} title="Delete city"
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500">
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-2 relative">
                <Label className="text-xs">Office address/Latitude,Longitude</Label>
                <Input className="rounded-xl mt-1" placeholder="Building, street, area, city, pincode" value={rows[l.id].address}
                  autoComplete="off"
                  onChange={(e) => { setRow(l.id, { address: e.target.value, lat: "", lng: "" }); suggest(l.id, e.target.value); }}
                  onBlur={() => {
                    setTimeout(() => setSugg((s) => ({ ...s, [l.id]: [] })), 150);
                    if (rows[l.id].lat === "") findCoords(l.id, rows[l.id].address);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && findCoords(l.id, rows[l.id].address)} />
                {(sugg[l.id] || []).length > 0 && (
                  <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-auto">
                    {sugg[l.id].map((s, i) => (
                      <li key={s.place_id || i}
                          onMouseDown={(e) => { e.preventDefault(); pick(l.id, s); }}
                          className="px-3 py-2 text-sm text-slate-700 hover:bg-emerald-50 cursor-pointer border-b border-slate-50 last:border-0">
                        {s.description}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <Label className="text-xs">Latitude</Label>
                <Input readOnly tabIndex={-1} className="rounded-xl mt-1 bg-slate-50 text-slate-600 cursor-not-allowed"
                  placeholder={busy[l.id] ? "Finding…" : "Auto"}
                  value={rows[l.id].lat === "" ? "" : Number(rows[l.id].lat).toFixed(6)} />
              </div>
              <div>
                <Label className="text-xs">Longitude</Label>
                <Input readOnly tabIndex={-1} className="rounded-xl mt-1 bg-slate-50 text-slate-600 cursor-not-allowed"
                  placeholder={busy[l.id] ? "Finding…" : "Auto"}
                  value={rows[l.id].lng === "" ? "" : Number(rows[l.id].lng).toFixed(6)} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-2 relative">
                <Label className="text-xs">Hub location/Latitude,Longitude</Label>
                <Input className="rounded-xl mt-1" placeholder="Hub building, street, area, city, pincode (optional)" value={rows[l.id].hub_address}
                  autoComplete="off"
                  onChange={(e) => { setRow(l.id, { hub_address: e.target.value, hub_lat: "", hub_lng: "" }); suggest(l.id, e.target.value, "hub"); }}
                  onBlur={() => {
                    setTimeout(() => setSugg((s) => ({ ...s, [`${l.id}:hub`]: [] })), 150);
                    if (rows[l.id].hub_lat === "") findCoords(l.id, rows[l.id].hub_address, "hub");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && findCoords(l.id, rows[l.id].hub_address, "hub")} />
                {(sugg[`${l.id}:hub`] || []).length > 0 && (
                  <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-auto">
                    {sugg[`${l.id}:hub`].map((s, i) => (
                      <li key={s.place_id || i}
                          onMouseDown={(e) => { e.preventDefault(); pick(l.id, s, "hub"); }}
                          className="px-3 py-2 text-sm text-slate-700 hover:bg-emerald-50 cursor-pointer border-b border-slate-50 last:border-0">
                        {s.description}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <Label className="text-xs">Latitude</Label>
                <Input readOnly tabIndex={-1} className="rounded-xl mt-1 bg-slate-50 text-slate-600 cursor-not-allowed"
                  placeholder={busy[`${l.id}:hub`] ? "Finding…" : "Auto"}
                  value={rows[l.id].hub_lat === "" ? "" : Number(rows[l.id].hub_lat).toFixed(6)} />
              </div>
              <div>
                <Label className="text-xs">Longitude</Label>
                <Input readOnly tabIndex={-1} className="rounded-xl mt-1 bg-slate-50 text-slate-600 cursor-not-allowed"
                  placeholder={busy[`${l.id}:hub`] ? "Finding…" : "Auto"}
                  value={rows[l.id].hub_lng === "" ? "" : Number(rows[l.id].hub_lng).toFixed(6)} />
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-40">
                <Label className="text-xs">Radius (m)</Label>
                <Input type="number" className="rounded-xl mt-1" value={rows[l.id].radius_m}
                  onChange={(e) => setRow(l.id, { radius_m: e.target.value })} />
              </div>
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => here(l.id)}>Use my location (office)</Button>
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => here(l.id, "hub")}>Use my location (hub)</Button>
              <Button type="button" disabled={busy[l.id] || busy[`${l.id}:hub`]} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 ml-auto"
                onClick={() => save(l.id)}>Save</Button>
            </div>
          </div>
        ))}
        {cities.length === 0 && <p className="text-sm text-slate-400">No cities yet. Click "+ Add" to add your first city.</p>}

        {showAdd ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[220px]">
              <Label className="text-xs">Enter city</Label>
              <Input className="rounded-xl mt-1 bg-white" placeholder="e.g. Coimbatore" autoFocus value={newCity}
                onChange={(e) => setNewCity(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addCity(); if (e.key === "Escape") { setShowAdd(false); setNewCity(""); } }} />
            </div>
            <Button type="button" disabled={savingCity} onClick={addCity} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
              <Save className="w-4 h-4 mr-2" /> Save
            </Button>
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => { setShowAdd(false); setNewCity(""); }}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex justify-end">
            <Button type="button" className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setShowAdd(true)}>
              <Plus className="w-4 h-4 mr-2" /> Add
            </Button>
          </div>
        )}
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
