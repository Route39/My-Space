import { useEffect, useState, useRef, useCallback } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useAuth } from "@/context/AuthContext";
import {
  Plus, Search, FileText, Bell, CheckSquare, Table as TableIcon, Paperclip,
  Pin, Trash2, Bold, Italic, List, ListOrdered, Heading, Link2, Image as ImageIcon,
  X, Download, GripVertical, ArrowUpDown, NotebookPen, LayoutGrid, Columns3,
} from "lucide-react";
import { toast } from "sonner";
import api, { apiErr } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState, MiniProgress } from "@/components/ui-bits";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { shortDate } from "@/lib/format";

const TYPES = {
  note: { icon: FileText, label: "Note", tint: "bg-amber-50 text-amber-600" },
  reminder: { icon: Bell, label: "Reminder", tint: "bg-rose-50 text-rose-600" },
  checklist: { icon: CheckSquare, label: "Checklist", tint: "bg-emerald-50 text-emerald-600" },
  table: { icon: TableIcon, label: "Table", tint: "bg-blue-50 text-blue-600" },
  file: { icon: Paperclip, label: "File / Image", tint: "bg-violet-50 text-violet-600" },
};
const FILTERS = [["all", "All"], ["pinned", "Pinned"], ["note", "Notes"], ["reminder", "Reminders"], ["checklist", "Checklists"], ["table", "Tables"], ["file", "Files"]];
const STATUSES = {
  new: { label: "New", dot: "bg-slate-400", chip: "bg-slate-100 text-slate-600" },
  in_progress: { label: "In Progress", dot: "bg-amber-500", chip: "bg-amber-50 text-amber-700" },
  completed: { label: "Completed", dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700" },
};
const COLUMNS = [["new", "New"], ["in_progress", "In Progress"], ["completed", "Completed"]];
const uid = () => Math.random().toString(36).slice(2, 10);

const blank = (type) => ({
  type, title: "", content: "", visibility: "private", status: "new", pinned: false,
  reminder_date: new Date().toISOString().slice(0, 10), reminder_time: "09:00", repeat: "none",
  checklist: type === "checklist" ? [{ id: uid(), text: "", done: false }] : [],
  table_data: type === "table" ? { columns: [{ key: uid(), name: "Name", type: "text" }, { key: uid(), name: "Amount", type: "number" }], rows: [] } : { columns: [], rows: [] },
  attachments: [],
});

export default function MySpace() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState(localStorage.getItem("myspace_view") || "grid");

  const setViewPref = (v) => { setView(v); localStorage.setItem("myspace_view", v); };

  const load = useCallback(async () => {
    const { data } = await api.get("/myspace", { params: { filter, q: q || undefined } });
    setItems(data);
    setLoading(false);
  }, [filter, q]);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);

  const create = (type) => setEditing(blank(type));
  const pinned = items.filter((i) => i.pinned);
  const recent = items.filter((i) => !i.pinned);

  const togglePin = async (e, item) => { e.stopPropagation(); await api.put(`/myspace/${item.id}/pin`); load(); };
  const remove = async (e, item) => { e.stopPropagation(); if (!window.confirm("Delete this item?")) return; await api.delete(`/myspace/${item.id}`); toast.success("Deleted"); load(); };

  const onDragEnd = async (result) => {
    const { destination, draggableId, source } = result;
    if (!destination || destination.droppableId === source.droppableId) return;
    const newStatus = destination.droppableId;
    const prev = items;
    setItems((list) => list.map((i) => (i.id === draggableId ? { ...i, status: newStatus } : i)));
    if (newStatus === "completed") toast.success("Marked completed 🎉");
    try { await api.put(`/myspace/${draggableId}`, { status: newStatus }); }
    catch (err) { toast.error("Could not move item"); setItems(prev); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold text-slate-900 tracking-tight">My Space</h1>
          <p className="text-slate-500 mt-1">Keep your notes, ideas and everyday work in one place.</p>
        </div>
        <CreateMenu onPick={create} testid="create-desktop" />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input data-testid="myspace-search" placeholder="Search your space…" value={q} onChange={(e) => setQ(e.target.value)} className="rounded-xl pl-9 h-10 bg-white" />
        </div>
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 overflow-x-auto no-scrollbar">
          {FILTERS.map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} data-testid={`filter-${k}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${filter === k ? "bg-emerald-50 text-emerald-700" : "text-slate-500 hover:bg-slate-50"}`}>{l}</button>
          ))}
        </div>
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 ml-auto">
          <button onClick={() => setViewPref("grid")} data-testid="view-grid" title="Grid" className={`p-1.5 rounded-lg ${view === "grid" ? "bg-emerald-50 text-emerald-700" : "text-slate-400 hover:bg-slate-50"}`}><LayoutGrid className="w-4 h-4" /></button>
          <button onClick={() => setViewPref("board")} data-testid="view-board" title="Board" className={`p-1.5 rounded-lg ${view === "board" ? "bg-emerald-50 text-emerald-700" : "text-slate-400 hover:bg-slate-50"}`}><Columns3 className="w-4 h-4" /></button>
        </div>
      </div>

      {loading ? null : items.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200"><EmptyState icon={NotebookPen} title="Your space is empty" subtitle="Create a note, reminder, checklist, table or upload a file to get started." /></div>
      ) : view === "board" ? (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex md:grid md:grid-cols-3 gap-4 overflow-x-auto pb-2 snap-x">
            {COLUMNS.map(([sid, label]) => {
              const colItems = items.filter((i) => (i.status || "new") === sid);
              return (
                <Droppable droppableId={sid} key={sid}>
                  {(provided, snap) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} data-testid={`board-col-${sid}`}
                      className={`rounded-2xl border p-3 min-h-[320px] min-w-[82%] sm:min-w-[320px] md:min-w-0 snap-start transition-colors ${snap.isDraggingOver ? "bg-emerald-50/60 border-emerald-200" : "bg-slate-100/50 border-slate-100"}`}>
                      <div className="flex items-center gap-2 px-1 mb-3">
                        <span className={`w-2 h-2 rounded-full ${STATUSES[sid].dot}`} />
                        <h3 className="font-heading font-semibold text-slate-700 text-sm">{label}</h3>
                        <span className="text-xs font-medium text-slate-500 bg-white rounded-full px-2 py-0.5 ml-auto">{colItems.length}</span>
                      </div>
                      <div className="space-y-2.5">
                        {colItems.map((it, i) => (
                          <Draggable draggableId={it.id} index={i} key={it.id}>
                            {(prov, s) => (
                              <div ref={prov.innerRef} {...prov.draggableProps} {...prov.dragHandleProps}
                                className={s.isDragging ? "opacity-90" : ""}>
                                <ItemCard it={it} me={user.id} board onOpen={() => setEditing(it)} onPin={togglePin} onDelete={remove} />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        {colItems.length === 0 && <p className="text-center text-xs text-slate-300 py-8">Drop items here</p>}
                      </div>
                    </div>
                  )}
                </Droppable>
              );
            })}
          </div>
        </DragDropContext>
      ) : (
        <div className="space-y-6">
          {pinned.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1"><Pin className="w-3 h-3" /> Pinned</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {pinned.map((it) => <ItemCard key={it.id} it={it} me={user.id} onOpen={() => setEditing(it)} onPin={togglePin} onDelete={remove} />)}
              </div>
            </div>
          )}
          {recent.length > 0 && (
            <div>
              {pinned.length > 0 && <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Recent</p>}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {recent.map((it) => <ItemCard key={it.id} it={it} me={user.id} onOpen={() => setEditing(it)} onPin={togglePin} onDelete={remove} />)}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="md:hidden fixed right-5 bottom-24 z-30">
        <CreateMenu onPick={create} floating testid="create-mobile" />
      </div>

      {editing && <Editor item={editing} me={user.id} onClose={() => { setEditing(null); load(); }} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function CreateMenu({ onPick, floating, testid }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {floating ? (
          <button data-testid={testid} className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/30 flex items-center justify-center"><Plus className="w-6 h-6" /></button>
        ) : (
          <Button data-testid={testid} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 h-10"><Plus className="w-4 h-4 mr-1" /> Create</Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-2xl p-1 w-48">
        {Object.entries(TYPES).map(([k, t]) => (
          <DropdownMenuItem key={k} onClick={() => onPick(k)} data-testid={`create-${k}`} className="rounded-lg cursor-pointer gap-2.5 py-2">
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${t.tint}`}><t.icon className="w-4 h-4" /></span>{t.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ItemCard({ it, me, board, onOpen, onPin, onDelete }) {
  const T = TYPES[it.type] || TYPES.note;
  const S = STATUSES[it.status] || STATUSES.new;
  const owned = it.owner_id === me;
  const done = (it.checklist || []).filter((c) => c.done).length;
  const total = (it.checklist || []).length;
  return (
    <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }} data-testid={`item-${it.id}`} className="w-full text-left rounded-2xl bg-white border border-slate-200 p-4 card-hover flex flex-col min-h-[130px] cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-200">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${T.tint}`}><T.icon className="w-4 h-4" /></span>
          {it.pinned && board && <Pin className="w-3.5 h-3.5 text-amber-500" fill="currentColor" />}
        </div>
        {owned && (
          <div className="flex items-center gap-1">
            <span onClick={(e) => onPin(e, it)} data-testid={`pin-${it.id}`} className={`p-1.5 rounded-lg hover:bg-slate-100 ${it.pinned ? "text-amber-500" : "text-slate-300"}`}><Pin className="w-4 h-4" fill={it.pinned ? "currentColor" : "none"} /></span>
            <span onClick={(e) => onDelete(e, it)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></span>
          </div>
        )}
      </div>
      <p className="font-heading font-semibold text-slate-800 mt-3 leading-tight">{it.title || "Untitled"}</p>
      {it.type === "note" && it.content && <p className="text-xs text-slate-500 mt-1 line-clamp-2" dangerouslySetInnerHTML={{ __html: it.content.replace(/<[^>]+>/g, " ").slice(0, 120) }} />}
      {it.type === "checklist" && total > 0 && <div className="mt-2"><p className="text-[11px] text-slate-400 mb-1">{done}/{total} done</p><MiniProgress value={done} max={total} /></div>}
      {it.type === "reminder" && <p className="text-xs text-rose-500 mt-1">{shortDate(it.reminder_date)}{it.reminder_date ? `, ${new Date(it.reminder_date).getFullYear()}` : ""} · {it.reminder_time}</p>}
      {it.type === "table" && <p className="text-xs text-slate-400 mt-1">{(it.table_data?.rows || []).length} rows · {(it.table_data?.columns || []).length} cols</p>}
      {it.type === "file" && <p className="text-xs text-slate-400 mt-1">{(it.attachments || []).length} file(s)</p>}
      <div className="mt-auto pt-3 flex items-center justify-between text-[11px] text-slate-400">
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-medium ${S.chip}`}><span className={`w-1.5 h-1.5 rounded-full ${S.dot}`} />{S.label}</span>
        <span className="capitalize">{it.visibility}</span>
      </div>
    </div>
  );
}

function Editor({ item, me, onClose, onSaved }) {
  const [f, setF] = useState({ ...item });
  const [busy, setBusy] = useState(false);
  const isNew = !item.id;
  const owned = isNew || item.owner_id === me;
  const set = (k, v) => { if (owned) setF((x) => ({ ...x, [k]: v })); };

  const save = async () => {
    setBusy(true);
    try {
      if (isNew) await api.post("/myspace", f);
      else await api.put(`/myspace/${item.id}`, f);
      toast.success("Saved");
      onSaved();
    } catch (e) { toast.error(apiErr(e.response?.data?.detail)); }
    setBusy(false);
  };

  const T = TYPES[f.type];
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="rounded-2xl max-w-2xl max-h-[92vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${T.tint}`}><T.icon className="w-4 h-4" /></span>
            <DialogTitle className="font-heading">{isNew ? `New ${T.label}` : T.label}</DialogTitle>
          </div>
        </DialogHeader>

        <Input data-testid="editor-title" placeholder="Title" value={f.title} onChange={(e) => set("title", e.target.value)} className="rounded-xl font-medium" />

        <div className="flex items-center gap-2">
          <Label className="text-xs text-slate-500">Status</Label>
          <Select value={f.status || "new"} onValueChange={(v) => { set("status", v); if (!isNew && owned) api.put(`/myspace/${item.id}`, { status: v }).then(() => toast.success("Status updated")); }} disabled={!owned}>
            <SelectTrigger className="rounded-xl h-9 w-40" data-testid="editor-status">
              <span className={`w-2 h-2 rounded-full mr-1.5 ${STATUSES[f.status || "new"].dot}`} /><SelectValue />
            </SelectTrigger>
            <SelectContent><SelectItem value="new">New</SelectItem><SelectItem value="in_progress">In Progress</SelectItem><SelectItem value="completed">Completed</SelectItem></SelectContent>
          </Select>
        </div>

        {f.type === "note" && <NoteEditor value={f.content} onChange={(v) => set("content", v)} readOnly={!owned} />}
        {f.type === "reminder" && <ReminderEditor f={f} set={set} />}
        {f.type === "checklist" && <ChecklistEditor value={f.checklist} onChange={(v) => set("checklist", v)} />}
        {f.type === "table" && <TableEditor value={f.table_data} onChange={(v) => set("table_data", v)} />}
        {(f.type === "file" || f.type === "note") && <Attachments value={f.attachments} onChange={(v) => set("attachments", v)} label={f.type === "file" ? "Files & Images" : "Attachments"} />}

        <div className="flex items-center justify-between gap-3 pt-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-slate-500">Visibility</Label>
            <Select value={f.visibility} onValueChange={(v) => set("visibility", v)}>
              <SelectTrigger className="rounded-xl h-9 w-32" data-testid="editor-visibility"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="private">Private</SelectItem><SelectItem value="team">Team</SelectItem><SelectItem value="company">Company</SelectItem></SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          {owned && !isNew && <span className="text-xs text-slate-400 mr-auto self-center">Owned by you</span>}
          {!owned && <span className="text-xs text-slate-400 mr-auto self-center">Shared by {item.owner_name} · view only</span>}
          <Button variant="outline" onClick={onClose} className="rounded-xl">{owned ? "Cancel" : "Close"}</Button>
          {owned && <Button data-testid="editor-save" onClick={save} disabled={busy} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">{busy ? "Saving…" : "Save"}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NoteEditor({ value, onChange, readOnly }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value || ""; }, []);
  const cmd = (c, v = null) => { document.execCommand(c, false, v); ref.current.focus(); onChange(ref.current.innerHTML); };
  const addLink = () => { const url = window.prompt("Link URL"); if (url) cmd("createLink", url); };
  const insertImg = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const fd = new FormData(); fd.append("file", file);
    const { data } = await api.post("/myspace/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
    document.execCommand("insertImage", false, data.data_url); onChange(ref.current.innerHTML);
  };
  const btn = "p-2 rounded-lg hover:bg-slate-100 text-slate-600";
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-0.5 border-b border-slate-100 px-2 py-1.5 flex-wrap">
        <button type="button" className={btn} onClick={() => cmd("bold")}><Bold className="w-4 h-4" /></button>
        <button type="button" className={btn} onClick={() => cmd("italic")}><Italic className="w-4 h-4" /></button>
        <button type="button" className={btn} onClick={() => cmd("formatBlock", "<h3>")}><Heading className="w-4 h-4" /></button>
        <button type="button" className={btn} onClick={() => cmd("insertUnorderedList")}><List className="w-4 h-4" /></button>
        <button type="button" className={btn} onClick={() => cmd("insertOrderedList")}><ListOrdered className="w-4 h-4" /></button>
        <button type="button" className={btn} onClick={addLink}><Link2 className="w-4 h-4" /></button>
        <label className={`${btn} cursor-pointer`}><ImageIcon className="w-4 h-4" /><input type="file" accept="image/*" className="hidden" onChange={insertImg} /></label>
      </div>
      <div ref={ref} contentEditable={!readOnly} data-testid="note-body" onInput={(e) => onChange(e.currentTarget.innerHTML)}
        className="min-h-[160px] max-h-[320px] overflow-y-auto p-3 text-sm text-slate-700 focus:outline-none prose-sm [&_h3]:font-semibold [&_h3]:text-base [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-emerald-600 [&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-2" />
    </div>
  );
}

function ReminderEditor({ f, set }) {
  return (
    <div className="space-y-3">
      <textarea placeholder="Description" value={f.content} onChange={(e) => set("content", e.target.value)} className="w-full rounded-xl border border-slate-200 p-3 text-sm min-h-[70px] focus:outline-none focus:ring-2 focus:ring-emerald-200" />
      <div className="grid grid-cols-3 gap-3">
        <div><Label className="text-xs">Date</Label><Input type="date" data-testid="reminder-date" value={f.reminder_date} onChange={(e) => set("reminder_date", e.target.value)} className="rounded-xl mt-1" /></div>
        <div><Label className="text-xs">Time</Label><Input type="time" data-testid="reminder-time" value={f.reminder_time} onChange={(e) => set("reminder_time", e.target.value)} className="rounded-xl mt-1" /></div>
        <div><Label className="text-xs">Repeat</Label>
          <Select value={f.repeat} onValueChange={(v) => set("repeat", v)}>
            <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem></SelectContent>
          </Select>
        </div>
      </div>
      <p className="text-xs text-slate-400">You&apos;ll get an Attendy notification when the reminder is due.</p>
    </div>
  );
}

function ChecklistEditor({ value, onChange }) {
  const items = value || [];
  const upd = (i, patch) => onChange(items.map((it, x) => x === i ? { ...it, ...patch } : it));
  const done = items.filter((i) => i.done).length;
  const move = (i, dir) => { const n = [...items]; const j = i + dir; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; onChange(n); };
  return (
    <div>
      {items.length > 0 && <div className="mb-3"><p className="text-xs text-slate-400 mb-1">{done}/{items.length} completed</p><MiniProgress value={done} max={items.length} /></div>}
      <div className="space-y-1.5">
        {items.map((it, i) => (
          <div key={it.id} className="flex items-center gap-2 group">
            <div className="flex flex-col text-slate-300"><button type="button" onClick={() => move(i, -1)} className="hover:text-slate-500"><GripVertical className="w-4 h-4" /></button></div>
            <input type="checkbox" checked={it.done} onChange={(e) => upd(i, { done: e.target.checked })} data-testid={`cl-check-${i}`} className="w-4 h-4 accent-emerald-600" />
            <input value={it.text} placeholder="List item" onChange={(e) => upd(i, { text: e.target.value })} className={`flex-1 text-sm bg-transparent focus:outline-none border-b border-transparent focus:border-slate-200 py-1 ${it.done ? "line-through text-slate-400" : "text-slate-700"}`} />
            <button type="button" onClick={() => onChange(items.filter((_, x) => x !== i))} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><X className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => onChange([...items, { id: uid(), text: "", done: false }])} data-testid="cl-add" className="text-sm text-emerald-600 font-medium mt-2">+ Add item</button>
    </div>
  );
}

function TableEditor({ value, onChange }) {
  const cols = value?.columns || [];
  const rows = value?.rows || [];
  const [sort, setSort] = useState(null);
  const setRows = (r) => onChange({ columns: cols, rows: r });
  const setCols = (c) => onChange({ columns: c, rows });
  const editCell = (ri, key, v) => setRows(rows.map((r, i) => i === ri ? { ...r, [key]: v } : r));
  const addRow = () => setRows([...rows, cols.reduce((a, c) => ({ ...a, [c.key]: "" }), { _id: uid() })]);
  const addCol = () => setCols([...cols, { key: uid(), name: `Column ${cols.length + 1}`, type: "text" }]);
  const totals = cols.map((c) => c.type === "number" ? rows.reduce((s, r) => s + (parseFloat(r[c.key]) || 0), 0) : null);
  const sorted = sort ? [...rows].sort((a, b) => { const x = a[sort.key] || "", y = b[sort.key] || ""; return sort.dir * (isNaN(x) ? String(x).localeCompare(String(y)) : x - y); }) : rows;
  return (
    <div className="border border-slate-200 rounded-xl overflow-x-auto">
      <table className="w-full text-sm min-w-[400px]">
        <thead>
          <tr className="bg-slate-50">
            {cols.map((c, ci) => (
              <th key={c.key} className="px-2 py-1.5 text-left">
                <div className="flex items-center gap-1">
                  <input value={c.name} onChange={(e) => setCols(cols.map((x, i) => i === ci ? { ...x, name: e.target.value } : x))} className="font-medium text-slate-600 bg-transparent w-full focus:outline-none text-xs" />
                  <button type="button" onClick={() => setSort({ key: c.key, dir: sort?.key === c.key ? -sort.dir : 1 })}><ArrowUpDown className="w-3 h-3 text-slate-400" /></button>
                  <select value={c.type} onChange={(e) => setCols(cols.map((x, i) => i === ci ? { ...x, type: e.target.value } : x))} className="text-[10px] text-slate-400 bg-transparent">
                    <option value="text">Aa</option><option value="number">#</option><option value="date">📅</option>
                  </select>
                  <button type="button" onClick={() => setCols(cols.filter((_, i) => i !== ci))} className="text-slate-300 hover:text-red-500"><X className="w-3 h-3" /></button>
                </div>
              </th>
            ))}
            <th className="px-2"><button type="button" onClick={addCol} data-testid="tbl-add-col" className="text-emerald-600"><Plus className="w-4 h-4" /></button></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, ri) => {
            const realIdx = rows.indexOf(r);
            return (
              <tr key={r._id || ri} className="border-t border-slate-100">
                {cols.map((c) => (
                  <td key={c.key} className="px-1 py-0.5">
                    <input type={c.type === "number" ? "number" : c.type === "date" ? "date" : "text"} value={r[c.key] || ""} onChange={(e) => editCell(realIdx, c.key, e.target.value)} className="w-full px-1.5 py-1 text-slate-700 bg-transparent focus:outline-none focus:bg-slate-50 rounded" />
                  </td>
                ))}
                <td className="px-2"><button type="button" onClick={() => setRows(rows.filter((_, i) => i !== realIdx))} className="text-slate-300 hover:text-red-500"><X className="w-3 h-3" /></button></td>
              </tr>
            );
          })}
          {totals.some((t) => t !== null) && (
            <tr className="border-t border-slate-200 bg-slate-50 font-medium">
              {cols.map((c, i) => <td key={c.key} className="px-2.5 py-1.5 text-slate-700">{totals[i] !== null ? `Σ ${totals[i].toLocaleString("en-IN")}` : i === 0 ? "Total" : ""}</td>)}
              <td />
            </tr>
          )}
        </tbody>
      </table>
      <div className="p-2 border-t border-slate-100"><button type="button" onClick={addRow} data-testid="tbl-add-row" className="text-sm text-emerald-600 font-medium">+ Add row</button></div>
    </div>
  );
}

function Attachments({ value, onChange, label }) {
  const items = value || [];
  const upload = async (e) => {
    const files = Array.from(e.target.files || []);
    let next = [...items];
    for (const file of files) {
      const fd = new FormData(); fd.append("file", file);
      try {
        const { data } = await api.post("/myspace/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
        next = [...next, { file_id: data.file_id, name: data.name, type: data.type, size: data.size }];
        onChange(next);
      } catch (err) { toast.error(apiErr(err.response?.data?.detail)); }
    }
    e.target.value = "";
  };
  const view = async (a) => {
    const { data } = await api.get(`/myspace/file/${a.file_id}`);
    const link = document.createElement("a"); link.href = data.data_url; link.download = a.name; link.click();
  };
  const isImg = (t) => (t || "").startsWith("image/");
  const [previews, setPreviews] = useState({});
  useEffect(() => {
    items.filter((a) => isImg(a.type) && !previews[a.file_id]).forEach(async (a) => {
      try { const { data } = await api.get(`/myspace/file/${a.file_id}`); setPreviews((p) => ({ ...p, [a.file_id]: data.data_url })); } catch (e) { /* preview unavailable */ }
    });
  }, [items]);
  return (
    <div>
      <Label className="text-xs text-slate-500">{label}</Label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1.5">
        {items.map((a) => (
          <div key={a.file_id} className="relative rounded-xl border border-slate-200 p-2 group">
            {isImg(a.type) && previews[a.file_id] ? (
              <img src={previews[a.file_id]} alt={a.name} className="w-full h-20 object-cover rounded-lg" />
            ) : (
              <div className="h-20 flex items-center justify-center bg-slate-50 rounded-lg"><Paperclip className="w-5 h-5 text-slate-400" /></div>
            )}
            <p className="text-[11px] text-slate-600 truncate mt-1">{a.name}</p>
            <p className="text-[10px] text-slate-400">{a.size < 1024 ? `${a.size} B` : `${Math.round(a.size / 1024)} KB`}</p>
            <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100">
              <button type="button" onClick={() => view(a)} className="p-1 rounded bg-white/90 shadow text-slate-500"><Download className="w-3 h-3" /></button>
              <button type="button" onClick={() => onChange(items.filter((x) => x.file_id !== a.file_id))} className="p-1 rounded bg-white/90 shadow text-red-500"><X className="w-3 h-3" /></button>
            </div>
          </div>
        ))}
        <label className="rounded-xl border-2 border-dashed border-slate-200 h-[104px] flex flex-col items-center justify-center cursor-pointer text-slate-400 hover:border-emerald-300 hover:text-emerald-500" data-testid="attach-upload">
          <Plus className="w-5 h-5" /><span className="text-[11px] mt-1">Upload</span>
          <input type="file" multiple className="hidden" onChange={upload} />
        </label>
      </div>
    </div>
  );
}
