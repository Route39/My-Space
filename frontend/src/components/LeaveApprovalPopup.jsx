import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Check, X, GripHorizontal, CalendarClock } from "lucide-react";
import { Avatar } from "@/components/common";
import { dateStr } from "@/lib/format";
import { Button } from "@/components/ui/button";

const MARGIN = 8;
const BUBBLE = 56;

const readPos = (key, fallback) => {
  try {
    const p = JSON.parse(localStorage.getItem(key));
    if (p && typeof p.x === "number" && typeof p.y === "number") return p;
  } catch (e) {}
  return fallback;
};
const savePos = (key, p) => { try { localStorage.setItem(key, JSON.stringify(p)); } catch (e) {} };

function useDraggable(storageKey, fallback, ref) {
  const [pos, setPos] = useState(() => readPos(storageKey, fallback()));
  const drag = useRef(null);
  const clamp = (p) => {
    const w = ref.current ? ref.current.offsetWidth : BUBBLE;
    const h = ref.current ? ref.current.offsetHeight : BUBBLE;
    return {
      x: Math.min(Math.max(MARGIN, p.x), Math.max(MARGIN, window.innerWidth - w - MARGIN)),
      y: Math.min(Math.max(MARGIN, p.y), Math.max(MARGIN, window.innerHeight - h - MARGIN)),
    };
  };
  useEffect(() => {
    const onResize = () => setPos((p) => clamp(p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlers = {
    onPointerDown: (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      if (e.target.closest("[data-nodrag]")) return;
      drag.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y, id: e.pointerId, moved: false };
    },
    onPointerMove: (e) => {
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
      if (!d.moved) {
        if (Math.abs(dx) + Math.abs(dy) < 5) return;
        d.moved = true;
        e.currentTarget.setPointerCapture?.(d.id);
      }
      e.preventDefault();
      setPos(clamp({ x: d.ox + dx, y: d.oy + dy }));
    },
    onPointerUp: (e) => {
      const d = drag.current;
      drag.current = null;
      if (d?.moved) {
        e.currentTarget.releasePointerCapture?.(d.id);
        setPos((p) => { savePos(storageKey, p); return p; });
      }
      return d ? d.moved : false;
    },
    onPointerCancel: () => { drag.current = null; },
  };
  return { pos, setPos, clamp, handlers };
}

export default function LeaveApprovalPopup() {
  const { user } = useAuth();
  const location = useLocation();
  const isDashboard = location.pathname === "/";
  const [pending, setPending] = useState([]);
  const [open, setOpen] = useState(isDashboard);
  const panelRef = useRef(null);
  const bubbleRef = useRef(null);
  const panel = useDraggable("leave_popup_pos", () => ({ x: 20, y: 80 }), panelRef);
  const bubble = useDraggable("leave_bubble_pos", () => ({ x: window.innerWidth - BUBBLE - 24, y: window.innerHeight - BUBBLE - 90 }), bubbleRef);

  const canApprove = user?.role === "admin" || user?.role === "admin_staff" || user?.phone === "9626573939";

  const load = async () => {
    try {
      const { data } = await api.get("/leaves/pending");
      setPending(data);
    } catch (e) {}
  };

  useEffect(() => {
    if (!canApprove) return;
    load();
    const int = setInterval(load, 15000);
    return () => clearInterval(int);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setOpen(isDashboard); }, [isDashboard]);

  useEffect(() => {
    if (!pending.length) return;
    panel.setPos((p) => panel.clamp(p));
    bubble.setPos((p) => bubble.clamp(p));
  }, [pending.length, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (id, action) => {
    try {
      await api.put(`/leaves/${id}/${action}`);
      toast.success(action === "approve" ? "Leave approved" : "Leave rejected");
      load();
    } catch (e) {
      toast.error("Action failed");
    }
  };

  if (!canApprove || pending.length === 0) return null;

  if (!open) {
    return createPortal(
      <div
        ref={bubbleRef}
        role="button"
        aria-label={`Leave requests (${pending.length})`}
        data-testid="leave-bubble"
        {...bubble.handlers}
        onPointerUp={(e) => { if (!bubble.handlers.onPointerUp(e)) setOpen(true); }}
        style={{ left: bubble.pos.x, top: bubble.pos.y, width: BUBBLE, height: BUBBLE, touchAction: "none" }}
        className="fixed z-[9999] rounded-full bg-emerald-600 text-white shadow-xl shadow-emerald-600/30 flex items-center justify-center cursor-grab active:cursor-grabbing select-none hover:bg-emerald-700 transition-colors"
      >
        <CalendarClock className="w-6 h-6 pointer-events-none" />
        <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center border-2 border-white pointer-events-none">
          {pending.length}
        </span>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div
      ref={panelRef}
      {...panel.handlers}
      className="fixed z-[9999] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden w-80 max-w-[calc(100vw-16px)] cursor-grab active:cursor-grabbing select-none animate-in fade-in slide-in-from-bottom-4 duration-300"
      style={{ left: panel.pos.x, top: panel.pos.y, touchAction: "none" }}
    >
      <div className="bg-slate-50 border-b border-slate-100 p-2 flex items-center justify-between">
        <div className="flex items-center text-slate-500 gap-1.5 px-1">
          <GripHorizontal className="w-4 h-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">Leave Requests ({pending.length})</span>
        </div>
        <button type="button" data-nodrag aria-label="Minimise" onClick={() => setOpen(false)}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-800">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="max-h-96 overflow-y-auto p-3 space-y-3 snap-y snap-mandatory">
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
            <div className="flex gap-2" data-nodrag>
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
