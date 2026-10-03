export const money = (n) =>
  "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

export const initials = (name = "") =>
  name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

export const timeStr = (iso) =>
  iso
    ? new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })
    : "—";

export const dateStr = (iso) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "—";

export const shortDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" }) : "—";

export const STATUS_COLORS = {
  Present: "bg-emerald-100 text-emerald-700",
  Late: "bg-red-100 text-red-600",
  Absent: "bg-red-100 text-red-600",
  Leave: "bg-blue-100 text-blue-700",
  "Half Day": "bg-red-100 text-red-600",
  Pending: "bg-amber-100 text-amber-700",
  Approved: "bg-emerald-100 text-emerald-700",
  Rejected: "bg-red-100 text-red-600",
  Draft: "bg-slate-100 text-slate-600",
  Paid: "bg-emerald-100 text-emerald-700",
  Active: "bg-emerald-100 text-emerald-700",
};

export const PRIORITY = {
  High: { dot: "bg-red-500", chip: "bg-red-50 text-red-600" },
  Medium: { dot: "bg-amber-500", chip: "bg-amber-50 text-amber-600" },
  Low: { dot: "bg-slate-400", chip: "bg-slate-100 text-slate-500" },
};
