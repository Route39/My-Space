import { initials } from "@/lib/format";
import { Avatar } from "@/components/common";

export function ProgressRing({ value = 0, max = 100, size = 128, stroke = 12, color = "#059669", track = "#e6eaef", children, className = "" }) {
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - pct);
  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={off} style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(.2,.8,.2,1)" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

export function MiniProgress({ value = 0, max = 100, color = "bg-emerald-500", className = "" }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={`h-1.5 w-full rounded-full bg-slate-100 overflow-hidden ${className}`}>
      <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function AvatarGroup({ people = [], max = 4, size = 28 }) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <div className="flex items-center">
      {shown.map((p, i) => (
        <div key={i} style={{ marginLeft: i === 0 ? 0 : -size * 0.32, zIndex: 10 - i }} className="ring-2 ring-white rounded-full">
          <Avatar src={p.photo} name={p.name} size={size} />
        </div>
      ))}
      {extra > 0 && (
        <div style={{ marginLeft: -size * 0.32, width: size, height: size }} className="ring-2 ring-white rounded-full bg-slate-800 text-white text-[10px] font-medium flex items-center justify-center z-0">
          +{extra}
        </div>
      )}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
          <Icon className="w-7 h-7 text-emerald-500" strokeWidth={1.5} />
        </div>
      )}
      <p className="font-heading font-semibold text-slate-700">{title}</p>
      {subtitle && <p className="text-sm text-slate-400 mt-1 max-w-xs">{subtitle}</p>}
    </div>
  );
}

export function Confetti() {
  const colors = ["#059669", "#f59e0b", "#3b82f6", "#ef4444", "#8b5cf6"];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-20">
      {Array.from({ length: 14 }).map((_, i) => (
        <span key={i} className="confetti-piece"
          style={{ left: "50%", top: "45%", background: colors[i % colors.length], "--a": `${(i / 14) * 360}deg`, animationDelay: `${(i % 4) * 40}ms` }} />
      ))}
    </div>
  );
}

export function CardSkeleton({ className = "" }) {
  return <div className={`rounded-2xl bg-white border border-slate-200 p-5 ${className}`}>
    <div className="skeleton h-8 w-8 rounded-xl mb-3" />
    <div className="skeleton h-7 w-20 rounded-md mb-2" />
    <div className="skeleton h-4 w-24 rounded-md" />
  </div>;
}

export function RowsSkeleton({ rows = 6 }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-3">
          <div className="skeleton w-8 h-8 rounded-full" />
          <div className="skeleton h-4 flex-1 rounded-md" />
          <div className="skeleton h-4 w-16 rounded-md" />
          <div className="skeleton h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}
