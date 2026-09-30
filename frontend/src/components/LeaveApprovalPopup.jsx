import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Check, X, GripHorizontal, CalendarClock } from "lucide-react";
import { Avatar } from "@/components/common";
import { dateStr } from "@/lib/format";
import { Button } from "@/components/ui/button";

const BUBBLE = 56;
const MARGIN = 12;
const POS_KEY = "leave_bubble_pos";

const clamp = (pos, w, h) => ({
  x: Math.min(Math.max(MARGIN, pos.x), Math.max(MARGIN, window.innerWidth - w - MARGIN)),
  y: Math.min(Math.max(MARGIN, pos.y), Math.max(MARGIN, window.innerHeight - h - MARGIN)),
});

const defaultPos = () => ({ x: window.innerWidth - BUBBLE - 20, y: window.innerHeight - BUBBLE - 90 });

const loadPos = () => {
  try {
    const p = JSON.parse(localStorage.getItem(POS_KEY));
    if (p && typeof p.x === "number" && typeof p.y === "number") return clamp(p, BUBBLE, BUBBLE);
  } catch (e) {}
  return clamp(defaultPos(), BUBBLE, BUBBLE);
};

export default function LeaveApprovalPopup() {
  const { user } = useAuth();
  const [pending, setPending] = useState([]);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(loadPos);
  const [pulse, setPulse] = useState(false);
  const prevCount = useRef(0);
  const drag = useRef(null);

  const canApprove = user?.role === "admin" || user?.role === "admin_staff" || user?.phone === "9626573939";

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/leaves/pending");
      setPending(data);
      if (data.length > prevCount.current) {
        setPulse(true);
        setTimeout(() => setPulse(false), 2500);
      }
      prevCount.current = data.length;
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (!canApprove) return;
    load();
    const int = setInterval(load, 15000);
    return () => clearInterval(int);
  }, [canApprove, load]);

  useEffect(() => {
    const onResize = () => setPos((p) => clamp(p, BUBBLE, BUBBLE));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (pending.length === 0) setOpen(false);
  }, [pending.length]);

  const savePos = (p) => {
    try { localStorage.setItem(POS_KEY, JSON.stringify(p)); } catch (e) {}
  };

  const act = async (id, action) => {
    try {
      await api.put(`/leaves/${id}/${action}`);
      toast.success(action === "approve" ? "Leave approved" : "Leave rejected");
      load();
    } catch (e) {
      toast.error("Action failed");
    }
  };

  const onPointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    drag.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) < 6) return;
    d.moved = true;
    setPos(clamp({ x: d.ox + dx, y: d.oy + dy }, BUBBLE, BUBBLE));
  };

  const onPointerUp = (e) => {
    const d = drag.current;
    drag.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    if (!d) return;
    if (d.moved) setPos((p) => { savePos(p); return p; });
    else setOpen(true);
  };

  if (!canApprove || pending.length === 0) return null;

  if (!open) {
    return createPortal(
      <button
        type="button"
        aria-label={`Leave requests (${pending.length})`}
        data-testid="leave-bubble"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { drag.current = null; }}
        style={{ left: pos.x, top: pos.y, width: BUBBLE, height: BUBBLE, touchAction: "none" }}
        className={`fixed z-[9999] rounded-full bg-emerald-600 text-white shadow-xl shadow-emerald-600/30 flex items-center justify-center cursor-grab active:cursor-grabbing select-none hover:bg-emerald-700 transition-colors ${pulse ? "animate-bounce" : ""}`}
      >
        <CalendarClock className="w-6 h-6 pointer-events-none" />
        <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center border-2 border-white pointer-events-none">
          {pending.length}
        </span>
      </button>,
      document.body
    );
  }

  const panelW = Math.min(320, window.innerWidth - MARGIN * 2);
  const panelH = Math.min(480, window.innerHeight - MARGIN * 2);
  const panelPos = clamp({ x: pos.x + BUBBLE - panelW, y: pos.y + BUBBLE - panelH }, panelW, panelH);

  return createPortal(
    <div
      data-testid="leave-panel"
      className="fixed z-[9999] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
      style={{ left: panelPos.x, top: panelPos.y, width: panelW, maxHeight: panelH }}
    >
      <div className="bg-slate-50 border-b border-slate-100 p-2 flex items-center justify-between select-none">
        <div className="flex items-center text-slate-500 gap-1.5 px-1">
          <GripHorizontal className="w-4 h-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">Leave Requests ({pending.length})</span>
        </div>
        <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-800">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="overflow-y-auto p-3 space-y-3 snap-y snap-mandatory overscroll-contain">
        {pending.map((l) => (
          <div key={l.id} className="snap-start bg-slate-50 rounded-xl p-3 border border-slate-100">
            <div className="flex items-center gap-2 mb-2">
              <Avatar name={l.employee_name} size={28} />
              <div>
                <p className="text-sm font-semibold text-slate-800 leading-none">{l.employee_name}</p>
                <p className="text-[10px] text-slate-500 mt-1">{l.leave_type}</p>
              </div>
            </div>
            <p className="text-xs font-medium text-slate-700 bg-white p-2 rounded-lg border border-slate-200 mb-2 shadow-sm">
              {l.category} {l.category === "Half Day" ? `(${l.half_day_type})` : l.category === "Permission" ? `(${l.permission_hours} hrs)` : ""}
              <br />
              <span className="text-slate-500 font-normal mt-0.5 inline-block">
                {dateStr(l.from_date)}{l.category === "Full Day" ? ` → ${dateStr(l.to_date)}` : ""}
              </span>
            </p>
            {l.reason && <p className="text-xs text-slate-600 mb-3 italic">"{l.reason}"</p>}
            <div className="flex gap-2">
              <Button size="sm" onClick={() => act(l.id, "approve")} className="flex-1 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs">
                <Check className="w-3.5 h-3.5 mr-1" /> Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => act(l.id, "reject")} className="flex-1 h-8 rounded-lg border-red-200 text-red-600 hover:bg-red-50 text-xs">
                <X className="w-3.5 h-3.5 mr-1" /> Reject
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>,
    document.body
  );
}
