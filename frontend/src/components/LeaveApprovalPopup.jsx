import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Check, X, GripHorizontal } from "lucide-react";
import { Avatar } from "@/components/common";
import { dateStr } from "@/lib/format";
import { Button } from "@/components/ui/button";

export default function LeaveApprovalPopup() {
  const { user } = useAuth();
  const [pending, setPending] = useState([]);
  const [position, setPosition] = useState({ x: 20, y: 80 });

  const load = async () => {
    try {
      const { data } = await api.get("/leaves/pending");
      setPending(data);
    } catch (e) {
      // ignore silently to not spam logs
    }
  };

  const canApprove = user?.role === "admin" || user?.phone === "9626573939";

  useEffect(() => {
    if (!canApprove) return;
    load();
    const int = setInterval(load, 15000);
    return () => clearInterval(int);
  }, [user]);

  const act = async (id, action) => {
    try {
      await api.put(`/leaves/${id}/${action}`);
      toast.success(action === "approve" ? "Leave approved" : "Leave rejected");
      load();
    } catch (e) {
      toast.error("Action failed");
    }
  };

  const handleMouseDown = (e) => {
    const startX = e.clientX - position.x;
    const startY = e.clientY - position.y;
    
    const handleMouseMove = (moveEvent) => {
      setPosition({
        x: moveEvent.clientX - startX,
        y: moveEvent.clientY - startY
      });
    };
    
    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  if (!canApprove || pending.length === 0) return null;

  return createPortal(
    <div 
      className="fixed z-[9999] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden w-80 animate-in fade-in slide-in-from-bottom-4 duration-300"
      style={{ left: position.x, top: position.y }}
    >
      <div 
        className="bg-slate-50 border-b border-slate-100 p-2 flex items-center justify-between cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center text-slate-500 gap-1.5 px-1">
          <GripHorizontal className="w-4 h-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">Leave Requests ({pending.length})</span>
        </div>
      </div>
      <div className="max-h-96 overflow-y-auto p-3 space-y-3">
        {pending.map((l) => (
          <div key={l.id} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <div className="flex items-center gap-2 mb-2">
              <Avatar name={l.employee_name} size={28} />
              <div>
                <p className="text-sm font-semibold text-slate-800 leading-none">{l.employee_name}</p>
                <p className="text-[10px] text-slate-500 mt-1">{l.leave_type}</p>
              </div>
            </div>
            <p className="text-xs font-medium text-slate-700 bg-white p-2 rounded-lg border border-slate-200 mb-2 shadow-sm">
              {l.category} {l.category === "Half Day" ? `(${l.half_day_type})` : l.category === "Permission" ? `(${l.permission_hours} hrs)` : ""}
              <br/>
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
