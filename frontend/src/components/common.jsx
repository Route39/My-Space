import { initials, STATUS_COLORS } from "@/lib/format";

export function Avatar({ src, name, size = 36, className = "" }) {
  const s = { width: size, height: size };
  if (src)
    return (
      <img
        src={src}
        alt={name}
        style={s}
        className={`rounded-full object-cover bg-slate-100 ${className}`}
      />
    );
  return (
    <div
      style={s}
      className={`rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-medium ${className}`}
    >
      <span style={{ fontSize: size * 0.38 }}>{initials(name)}</span>
    </div>
  );
}

export function StatusBadge({ status, className = "" }) {
  const color = STATUS_COLORS[status] || "bg-slate-100 text-slate-600";
  return (
    <span
      data-testid={`status-${(status || "").toLowerCase().replace(/ /g, "-")}`}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${color} ${className}`}
    >
      {status}
    </span>
  );
}
