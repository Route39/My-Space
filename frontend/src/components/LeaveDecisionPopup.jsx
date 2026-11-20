import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { CheckCircle2, XCircle } from "lucide-react";
import { dateStr } from "@/lib/format";
import { Button } from "@/components/ui/button";

export default function LeaveDecisionPopup() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const load = async () => {
    try { const { data } = await api.get("/leaves/my-decisions"); setItems(Array.isArray(data) ? data : []); } catch (e) {}
  };
  useEffect(() => {
    if (!user) return;
    load();
    const int = setInterval(() => !document.hidden && load(), 30000);
    return () => clearInterval(int);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!user || !items.length) return null;
  const l = items[0];
  const ok = l.status === "Approved";
  const close = async () => {
    setItems((x) => x.slice(1));
    try { await api.put(`/leaves/${l.id}/seen`); } catch (e) {}
  };
  return createPortal(
    <div className="fixed inset-0 z-[10000] bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center animate-in fade-in zoom-in-95 duration-200">
        {ok ? <CheckCircle2 className="w-14 h-14 mx-auto text-emerald-600" /> : <XCircle className="w-14 h-14 mx-auto text-red-500" />}
        <h3 className="mt-3 text-lg font-bold text-slate-800">{l.postponed && l.status === "Approved" ? "Leave Postponed" : `Leave ${l.status}`}</h3>{l.postponed && l.postponed_from && <p className="text-xs text-amber-700 mt-1">Moved from {dateStr(l.postponed_from)}</p>}
        <p className="mt-1 text-sm text-slate-600">{l.leave_type} · {l.category}<br />{dateStr(l.from_date)}{l.to_date && l.to_date !== l.from_date ? ` → ${dateStr(l.to_date)}` : ""}</p>
        {l.decided_by && <p className="mt-2 text-xs text-slate-500">{l.status} by <b>{l.decided_by}</b></p>}
        {l.decision_reason && <p className="mt-3 text-sm bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-700 italic">Reason: {l.decision_reason}</p>}
        <Button onClick={close} className={`mt-5 w-full rounded-xl ${ok ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}>OK</Button>
        {items.length > 1 && <p className="mt-2 text-[11px] text-slate-400">{items.length - 1} more update(s)</p>}
      </div>
    </div>,
    document.body
  );
}
