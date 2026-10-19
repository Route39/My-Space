import { useEffect, useState } from "react";
import { LogIn, LogOut, CheckCircle2, Sun, MapPin } from "lucide-react";
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
  let diff = eh * 60 + em - (sh * 60 + sm);
  if (diff <= 0) diff += 24 * 60; // overnight shift (ends 12:00 AM or later)
  return Math.max(1, diff / 60);
}

function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      return reject(new Error("Location is not supported on this device/browser"));
    }

    const requestCoordinates = () => {
      // 1. High-accuracy GPS first (10s timeout)
      navigator.geolocation.getCurrentPosition(
        resolve,
        (err) => {
          // If GPS times out indoors on Android/iOS APK, fallback to network/Wi-Fi positioning
          if (err.code === 3 /* TIMEOUT */ || err.code === 2 /* POSITION_UNAVAILABLE */) {
            navigator.geolocation.getCurrentPosition(
              resolve,
              (fallbackErr) => {
                const msg = fallbackErr.code === 1
                  ? "Location permission is off. Please tap 'Allow' when your device asks for location permission."
                  : fallbackErr.code === 3
                  ? "Location request timed out. Please turn on GPS / Wi-Fi and try again."
                  : "Unable to retrieve device location. Turn on location services in device settings.";
                reject(new Error(msg));
              },
              { enableHighAccuracy: false, timeout: 10000, maximumAge: 30000 }
            );
          } else if (err.code === 1 /* PERMISSION_DENIED */) {
            reject(new Error("Location permission denied. Please allow location access in your device settings to check in."));
          } else {
            reject(err);
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    };

    // Pre-check permission status if supported by modern Android WebViews
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: "geolocation" }).then((result) => {
        if (result.state === "denied") {
          reject(new Error("Location access is blocked. Please open app info in device settings and enable Location."));
        } else {
          requestCoordinates();
        }
      }).catch(() => requestCoordinates());
    } else {
      requestCoordinates();
    }
  });
}

export default function CheckInCard({ today, shift, onChange, isOnLeaveToday }) {
  const [, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [statusText, setStatusText] = useState("");
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
    setStatusText("Getting GPS…");
    let locError = null;
    try {
      let loc = {};
      try {
        const pos = await getPosition();
        loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
      } catch (err) {
        locError = err.message;
        toast.error(locError);
        return;
      }
      setStatusText("Checking in…");
      const { data } = await api.post("/attendance/checkin", loc);
      toast.success(data?.check_in_office ? `Checked in at ${data.check_in_office}` : "Checked in successfully");
      onChange && onChange();
    }
    catch (e) {
      const serverMsg = e.response?.data?.detail;
      toast.error(serverMsg || locError || "Check-in failed");
    }
    finally {
      setBusy(false);
      setStatusText("");
    }
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
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 pulse-dot" />
                <span className="text-sm text-emerald-300 font-medium">Working now</span>
              </div>
              {today?.check_in_office && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-300 bg-white/10 rounded-lg px-2 py-0.5 w-fit">
                  <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span>{today.check_in_office}{today.check_in_distance_m !== undefined && today.check_in_distance_m !== null ? ` (${today.check_in_distance_m}m)` : ""}</span>
                </div>
              )}
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
              <p className="font-medium">{done ? timeStr(today.check_out) : "—"}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 relative">
        {isOnLeaveToday ? (
          <div className="w-full h-13 py-3.5 rounded-2xl bg-amber-500/15 text-amber-500 font-heading font-semibold flex items-center justify-center gap-2">
             You are on leave today
          </div>
        ) : done ? (
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
            <LogIn className="w-5 h-5" /> {statusText || "Check In"}
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
