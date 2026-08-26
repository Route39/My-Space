import { useEffect, useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Plus, Calendar, MessageSquare, CheckSquare, X, KanbanSquare } from "lucide-react";
import { toast } from "sonner";
import api, { apiErr } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Avatar } from "@/components/common";
import { MiniProgress, EmptyState } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PRIORITY, shortDate } from "@/lib/format";

const COLUMNS = [
  { id: "todo", label: "To Do", accent: "bg-slate-400" },
  { id: "in_progress", label: "In Progress", accent: "bg-blue-500" },
  { id: "completed", label: "Completed", accent: "bg-emerald-500" },
];

export default function Tasks() {
  const { user } = useAuth();
  const canCreate = user.role === "admin" || user.role === "team_leader";
  const [tasks, setTasks] = useState([]);
  const [emps, setEmps] = useState([]);
  const [active, setActive] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = async () => { const { data } = await api.get("/tasks"); setTasks(data); };
  useEffect(() => { load(); if (canCreate) api.get("/employees").then((r) => setEmps(r.data)); }, []);

  const onDragEnd = async (result) => {
    const { destination, draggableId, source } = result;
    if (!destination || destination.droppableId === source.droppableId) return;
    const newStatus = destination.droppableId;
    setTasks((prev) => prev.map((t) => (t.id === draggableId ? { ...t, status: newStatus } : t)));
    if (newStatus === "completed") toast.success("Task completed 🎉");
    try { await api.put(`/tasks/${draggableId}/status`, { status: newStatus }); load(); }
    catch (e) { toast.error("Failed to move task"); load(); }
  };
  const grouped = (col) => tasks.filter((t) => t.status === col);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="font-heading text-3xl font-bold text-slate-900 tracking-tight md:hidden">Tasks</h1><p className="text-slate-500 md:mt-0">My Team board</p></div>
        {canCreate && <CreateTask emps={emps} open={createOpen} setOpen={setCreateOpen} onCreated={load} />}
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid md:grid-cols-3 gap-4">
          {COLUMNS.map((col) => (
            <Droppable droppableId={col.id} key={col.id}>
              {(provided, snapshot) => (
                <div ref={provided.innerRef} {...provided.droppableProps} data-testid={`column-${col.id}`}
                  className={`rounded-2xl border p-3 min-h-[320px] transition-colors ${snapshot.isDraggingOver ? "bg-emerald-50/60 border-emerald-200" : "bg-slate-100/50 border-slate-100"}`}>
                  <div className="flex items-center gap-2 px-1 mb-3">
                    <span className={`w-2 h-2 rounded-full ${col.accent}`} />
                    <h3 className="font-heading font-semibold text-slate-700 text-sm">{col.label}</h3>
                    <span className="text-xs font-medium text-slate-500 bg-white rounded-full px-2 py-0.5 ml-auto">{grouped(col.id).length}</span>
                  </div>
                  <div className="space-y-2.5">
                    {grouped(col.id).map((t, i) => {
                      const done = t.checklist?.filter((c) => c.done).length || 0;
                      const total = t.checklist?.length || 0;
                      return (
                        <Draggable draggableId={t.id} index={i} key={t.id}>
                          {(prov, snap) => (
                            <div ref={prov.innerRef} {...prov.draggableProps} {...prov.dragHandleProps} onClick={() => setActive(t)} data-testid={`task-card-${t.id}`}
                              className={`bg-white rounded-xl border p-3.5 cursor-pointer transition-all ${snap.isDragging ? "scale-[.97] shadow-xl rotate-1 border-emerald-200" : "border-slate-200 hover:border-slate-300 hover:shadow-sm"}`}>
                              <div className="flex items-center justify-between mb-2">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${PRIORITY[t.priority].chip}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY[t.priority].dot}`} />{t.priority}
                                </span>
                                {t.assignee_name && <Avatar name={t.assignee_name} size={24} />}
                              </div>
                              <p className="font-medium text-slate-800 text-sm leading-snug">{t.title}</p>
                              {total > 0 && (
                                <div className="mt-3">
                                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1"><span>Checklist</span><span>{done}/{total}</span></div>
                                  <MiniProgress value={done} max={total} color={done === total ? "bg-emerald-500" : "bg-blue-500"} />
                                </div>
                              )}
                              <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
                                {t.due_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{shortDate(t.due_date)}</span>}
                                {t.comments?.length > 0 && <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{t.comments.length}</span>}
                                {total > 0 && <span className="flex items-center gap-1 ml-auto"><CheckSquare className="w-3 h-3" />{done}/{total}</span>}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                    {grouped(col.id).length === 0 && <p className="text-center text-xs text-slate-300 py-8">Drop tasks here</p>}
                  </div>
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>

      {tasks.length === 0 && <div className="rounded-2xl bg-white border border-slate-200"><EmptyState icon={KanbanSquare} title="You're all caught up 🎉" subtitle="No tasks yet. Create one to get your team moving." /></div>}
      {active && <TaskDetail task={active} setTask={setActive} onChange={load} canEdit={canCreate} />}
    </div>
  );
}

function CreateTask({ emps, open, setOpen, onCreated }) {
  const [form, setForm] = useState({ title: "", description: "", assignee_id: "", due_date: new Date().toISOString().slice(0, 10), priority: "Medium" });
  const [checklist, setChecklist] = useState([""]);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await api.post("/tasks", { ...form, checklist: checklist.filter((c) => c.trim()) });
      toast.success("Task created"); setOpen(false);
      setForm({ title: "", description: "", assignee_id: "", due_date: new Date().toISOString().slice(0, 10), priority: "Medium" });
      setChecklist([""]); onCreated();
    } catch (e) { toast.error(apiErr(e.response?.data?.detail)); }
    setBusy(false);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button data-testid="create-task-btn" className="rounded-xl bg-emerald-600 hover:bg-emerald-700 h-10"><Plus className="w-4 h-4 mr-1" /> Create Task</Button></DialogTrigger>
      <DialogContent className="rounded-2xl max-w-lg max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader><DialogTitle className="font-heading">Create Task</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Task title</Label><Input data-testid="task-title" className="rounded-xl mt-1" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><Label>Description</Label><Textarea className="rounded-xl mt-1" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Assign to</Label>
              <Select value={form.assignee_id} onValueChange={(v) => setForm({ ...form, assignee_id: v })}>
                <SelectTrigger className="rounded-xl mt-1" data-testid="task-assignee"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{emps.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{["Low", "Medium", "High"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Due date</Label><Input type="date" className="rounded-xl mt-1" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
          <div>
            <Label>Checklist</Label>
            <div className="space-y-2 mt-1">
              {checklist.map((c, i) => (
                <div key={i} className="flex gap-2">
                  <Input className="rounded-xl" value={c} placeholder={`Item ${i + 1}`} onChange={(e) => { const n = [...checklist]; n[i] = e.target.value; setChecklist(n); }} />
                  {checklist.length > 1 && <button onClick={() => setChecklist(checklist.filter((_, x) => x !== i))} className="text-slate-400"><X className="w-4 h-4" /></button>}
                </div>
              ))}
              <button onClick={() => setChecklist([...checklist, ""])} className="text-sm text-emerald-600 font-medium">+ Add item</button>
            </div>
          </div>
        </div>
        <DialogFooter><Button data-testid="task-save" onClick={submit} disabled={busy || !form.title} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">{busy ? "Creating…" : "Create Task"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TaskDetail({ task, setTask, onChange, canEdit }) {
  const [t, setT] = useState(task);
  const [comment, setComment] = useState("");
  const [newItem, setNewItem] = useState("");
  const refresh = async () => { const { data } = await api.get(`/tasks/${task.id}`); setT(data); onChange(); };
  const toggle = async (itemId, done) => { await api.put(`/tasks/${t.id}/checklist`, { item_id: itemId, done }); refresh(); };
  const addItem = async () => { if (!newItem.trim()) return; await api.post(`/tasks/${t.id}/checklist`, { text: newItem }); setNewItem(""); refresh(); };
  const addComment = async () => { if (!comment.trim()) return; await api.post(`/tasks/${t.id}/comments`, { text: comment }); setComment(""); refresh(); };
  const changeStatus = async (s) => { await api.put(`/tasks/${t.id}/status`, { status: s }); setT({ ...t, status: s }); onChange(); if (s === "completed") toast.success("Task completed 🎉"); };
  const del = async () => { await api.delete(`/tasks/${t.id}`); toast.success("Task deleted"); setTask(null); onChange(); };
  const doneCount = t.checklist.filter((c) => c.done).length;

  return (
    <Dialog open onOpenChange={() => setTask(null)}>
      <DialogContent className="rounded-2xl max-w-lg max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <span className={`self-start inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${PRIORITY[t.priority].chip}`}><span className={`w-1.5 h-1.5 rounded-full ${PRIORITY[t.priority].dot}`} />{t.priority}</span>
          <DialogTitle className="font-heading text-xl">{t.title}</DialogTitle>
        </DialogHeader>
        {t.description && <p className="text-sm text-slate-600">{t.description}</p>}
        <div className="flex items-center gap-4 text-sm text-slate-500">
          {t.assignee_name && <span className="flex items-center gap-2"><Avatar name={t.assignee_name} size={24} /> {t.assignee_name}</span>}
          {t.due_date && <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {shortDate(t.due_date)}</span>}
        </div>
        <Select value={t.status} onValueChange={changeStatus}>
          <SelectTrigger className="rounded-xl w-full" data-testid="detail-status"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="todo">To Do</SelectItem><SelectItem value="in_progress">In Progress</SelectItem><SelectItem value="completed">Completed</SelectItem></SelectContent>
        </Select>
        <div>
          <div className="flex items-center justify-between mb-2"><p className="text-sm font-medium text-slate-700">Checklist</p>{t.checklist.length > 0 && <span className="text-xs text-slate-400">{doneCount}/{t.checklist.length}</span>}</div>
          {t.checklist.length > 0 && <MiniProgress value={doneCount} max={t.checklist.length} className="mb-3" />}
          <div className="space-y-1.5">
            {t.checklist.map((c) => (
              <label key={c.id} className="flex items-center gap-2.5 text-sm cursor-pointer">
                <Checkbox checked={c.done} onCheckedChange={(v) => toggle(c.id, !!v)} data-testid={`check-${c.id}`} />
                <span className={c.done ? "line-through text-slate-400" : "text-slate-700"}>{c.text}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <Input className="rounded-xl h-9 text-sm" placeholder="Add item" value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addItem()} />
            <Button size="sm" variant="secondary" onClick={addItem} className="rounded-xl">Add</Button>
          </div>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">Comments</p>
          <div className="space-y-2 mb-2">
            {t.comments.map((c) => (<div key={c.id} className="bg-slate-50 rounded-xl p-2.5"><p className="text-sm text-slate-700">{c.text}</p><p className="text-[11px] text-slate-400 mt-0.5">{c.author}</p></div>))}
          </div>
          <div className="flex gap-2">
            <Input className="rounded-xl h-9 text-sm" placeholder="Write a comment…" value={comment} onChange={(e) => setComment(e.target.value)} data-testid="comment-input" onKeyDown={(e) => e.key === "Enter" && addComment()} />
            <Button size="sm" onClick={addComment} className="rounded-xl bg-emerald-600 hover:bg-emerald-700" data-testid="comment-send">Send</Button>
          </div>
        </div>
        {canEdit && <button onClick={del} className="text-sm text-red-500 font-medium self-start">Delete task</button>}
      </DialogContent>
    </Dialog>
  );
}
