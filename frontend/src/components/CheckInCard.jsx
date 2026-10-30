import { useEffect, useState } from "react";
import { LogIn, LogOut, CheckCircle2, Sun, MapPin, AlertTriangle, ShieldAlert, Navigation } from "lucide-react";
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
    // Browsers silently block geolocation on non-HTTPS pages
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      return reject(new Error("Location needs a secure (https) connection. Please open the app using its https:// link."));
    }
    if (!navigator.geolocation) {
      return reject(new Error("Location is not supported on this device/browser"));
    }

    let settled = false;
    let watchdog = null;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(watchdog);
      fn(value);
    };
    const ok = (pos) => finish(resolve, pos);
    const fail = (msg) => finish(reject, new Error(msg));

    // Some mobile browsers never fire either callback; don't leave the button stuck.
    watchdog = setTimeout(
      () => fail("Location request timed out. Please turn on GPS / Wi-Fi, allow location for this site and try again."),
      45000
    );

    const onFinalError = (e) => {
      if (e && e.code === 1 /* PERMISSION_DENIED */) {
        fail("Location permission is blocked for this site. Tap the lock/site-settings icon in the browser address bar, set Location to 'Allow', then reload and try again. (Also make sure phone Location/GPS is ON.)");
      } else if (e && e.code === 3 /* TIMEOUT */) {
        fail("Location request timed out. Please turn on GPS / Wi-Fi and try again.");
      } else {
        fail("Unable to retrieve device location. Turn on Location services in your phone settings and try again.");
      }
    };

    // The browser itself is the source of truth for permission, so call it directly
    // (the prompt appears here if needed) instead of trusting navigator.permissions.query.
    navigator.geolocation.getCurrentPosition(
      ok,
      (err) => {
        if (settled) return;
        if (err && err.code === 1) return onFinalError(err);
        // GPS timed out / unavailable -> fall back to network / Wi-Fi positioning
        navigator.geolocation.getCurrentPosition(
          ok,
          onFinalError,
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
        );
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 }
    );
  });
}

export default function CheckInCard({ today, shift, onChange, isOnLeaveToday }) {
  const [, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [skewMs, setSkewMs] = useState(0);

  useEffect(() => {
    if (today?.server_now) {
      setSkewMs(new Date(today.server_now).getTime() - Date.now());
    }
  }, [today?.server_now]);
  const [statusText, setStatusText] = useState("");
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const checkedIn = today?.check_in && !today?.check_out;
  const done = today?.check_in && today?.check_out;
  const shiftH = shiftHours(shift);

  const [geoAlert, setGeoAlert] = useState(null);

  const doCheckIn = async () => {
    setBusy(true);
    setGeoAlert(null);
    setStatusText("Getting GPS…");
    let locError = null;
    try {
      let loc = {};
      try {
        const pos = await getPosition();
        loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
      } catch (err) {
        locError = err.message;
        setGeoAlert({ type: "gps_error", message: locError });
        toast.error(locError);
        return;
      }
      setStatusText("Verifying Geofence…");
      const { data } = await api.post("/attendance/checkin", loc);
      setGeoAlert(null);
      toast.success(data?.check_in_office ? `Checked in at ${data.check_in_office}` : "Checked in successfully");
      onChange && onChange();
    }
    catch (e) {
      const serverMsg = e.response?.data?.detail;
      if (serverMsg === "Already checked in") {
        toast.info("You are already checked in. Refreshing…");
        onChange && onChange();
        return;
      }
      const msg = serverMsg || locError || "Check-in failed";
      setGeoAlert({ type: "geofence_denied", message: msg });
      toast.error(msg);
    }
    finally {
      setBusy(false);
      setStatusText("");
    }
  };
  const doCheckOut = async () => {
    setBusy(true);
    try {
      let loc = {};
      try { const pos = await getPosition(); loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }; } catch (_) { /* checkout without GPS */ }
      await api.post("/attendance/checkout", loc);
      setCelebrate(true); setTimeout(() => setCelebrate(false), 1200);
      toast.success("Checked out. Have a good day!");
      onChange && onChange();
    } catch (e) { toast.error(e.response?.data?.detail || "Check-out failed"); }
    setBusy(false);
  };

  const ringMax = shiftH * 3600;
  const nowMs = Date.now() + skewMs;
  const rawSec = checkedIn ? (nowMs - new Date(today.check_in).getTime()) / 1000 : (done ? today.hours * 3600 : 0);
  const workedSec = Math.min(Math.max(0, rawSec), ringMax * 2);

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

      {geoAlert && !checkedIn && (
        <div className="mt-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 p-3.5 text-amber-200 text-xs space-y-1.5 animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-2 font-semibold text-amber-300">
            {geoAlert.type === "gps_error" ? (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span>{geoAlert.type === "gps_error" ? "GPS Location Required" : "Outside Office Geofence"}</span>
          </div>
          <p className="leading-relaxed text-slate-200">{geoAlert.message}</p>
          <div className="flex items-center gap-1.5 text-[11px] text-amber-400/90 font-medium pt-0.5">
            <Navigation className="w-3 h-3" />
            <span>Enter physically inside the entrance door (within 40m) to enable check in.</span>
          </div>
        </div>
      )}

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
