import { useEffect, useState } from "react";
import { LogIn, LogOut, CheckCircle2, Sun } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { timeStr } from "@/lib/format";
import { ProgressRing, Confetti } from "@/components/ui-bits";

function fmt(sec) {
  const s = Math.max(0, Math.floor(sec));
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${ss}`;
}
function shiftHours(shift) {
  if (!shift) return 9;
  const [sh, sm] = shift.start_time.split(":").map(Number);
  const [eh, em] = shift.end_time.split(":").map(Number);
  return Math.max(1, (eh * 60 + em - (sh * 60 + sm)) / 60);
}

export default function CheckInCard({ today, shift, onChange }) {
  const [, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const checkedIn = today?.check_in && !today?.check_out;
  const done = today?.check_in && today?.check_out;
  const shiftH = shiftHours(shift);

  const doCheckIn = async () => {
    setBusy(true);
    try { await api.post("/attendance/checkin"); toast.success("Checked in successfully"); onChange && onChange(); }
    catch (e) { toast.error(e.response?.data?.detail || "Check-in failed"); }
    setBusy(false);
  };
  const doCheckOut = async () => {
    setBusy(true);
    try {
      await api.post("/attendance/checkout");
      setCelebrate(true); setTimeout(() => setCelebrate(false), 1200);
      toast.success("Checked out. Have a good day!");
      onChange && onChange();
    } catch (e) { toast.error(e.response?.data?.detail || "Check-out failed"); }
    setBusy(false);
  };

  const workedSec = checkedIn ? (Date.now() - new Date(today.check_in).getTime()) / 1000 : (done ? today.hours * 3600 : 0);
  const ringMax = shiftH * 3600;

  return (
    <div className="relative rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 overflow-hidden">
      {celebrate && <Confetti />}
      <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-emerald-500/20 blur-2xl" />
      <div className="flex items-center gap-1.5 text-slate-300 text-sm relative">
        <Sun className="w-4 h-4 text-amber-400" /> Your Workday
      </div>

      <div className="flex items-center gap-6 mt-4 relative">
        <ProgressRing value={workedSec} max={ringMax} size={132} stroke={12}
          color={done ? "#10b981" : checkedIn ? "#10b981" : "#475569"} track="#334155">
          {done ? (
            <><CheckCircle2 className="w-6 h-6 text-emerald-400 mb-1" /><span className="text-xs text-slate-300">Complete</span></>
          ) : checkedIn ? (
            <><span className="font-mono text-lg font-semibold" data-testid="working-timer">{fmt(workedSec)}</span><span className="text-[10px] text-slate-400 mt-0.5">working</span></>
          ) : (
            <><span className="text-2xl font-heading font-bold text-slate-200">--:--</span><span className="text-[10px] text-slate-400 mt-1">not started</span></>
          )}
        </ProgressRing>

        <div className="flex-1 space-y-3">
          {done ? (
            <div>
              <p className="font-heading text-3xl font-bold">{Math.floor(today.hours)}h {Math.round((today.hours - Math.floor(today.hours)) * 60)}m</p>
              <p className="text-sm text-slate-300">Worked today</p>
            </div>
          ) : checkedIn ? (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 pulse-dot" />
              <span className="text-sm text-emerald-300 font-medium">Working now</span>
            </div>
          ) : (
            <p className="text-sm text-slate-300">You haven't checked in yet today.</p>
          )}

          <div className="flex gap-5 text-sm">
            <div>
              <p className="text-slate-400 text-xs">Check In</p>
              <p className="font-medium">{today?.check_in ? timeStr(today.check_in) : "—"}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs">{done ? "Check Out" : "Shift End"}</p>
              <p className="font-medium">{done ? timeStr(today.check_out) : (shift ? formatTime(shift.end_time) : "—")}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 relative">
        {done ? (
          <div className="w-full h-13 py-3.5 rounded-2xl bg-emerald-500/15 text-emerald-300 font-heading font-semibold flex items-center justify-center gap-2">
            <CheckCircle2 className="w-5 h-5" /> Attendance completed
          </div>
        ) : checkedIn ? (
          <button onClick={doCheckOut} disabled={busy} data-testid="check-out-btn"
            className="w-full py-4 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-heading font-semibold text-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-60 active:scale-[.99]">
            <LogOut className="w-5 h-5" /> Check Out
          </button>
        ) : (
          <button onClick={doCheckIn} disabled={busy} data-testid="check-in-btn"
            className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-heading font-semibold text-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-60 active:scale-[.99]">
            <LogIn className="w-5 h-5" /> Check In
          </button>
        )}
      </div>
    </div>
  );
}

function formatTime(hm) {
  const [h, m] = hm.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  const hh = h % 12 || 12;
  return `${hh}:${String(m).padStart(2, "0")} ${ap}`;
}
