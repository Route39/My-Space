import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { timeStr, shortDate } from "@/lib/format";

const when = (iso) => (iso ? `${shortDate(iso)}, ${timeStr(iso)}` : "");

export default function ManualChangeNote({ rec, className = "" }) {
  if (!rec?.is_manual) return null;
  const hist = rec.manual_history || [];
  const note = (
    <div
      tabIndex={0}
      data-testid="manual-change-note"
      className={`mt-1 flex items-start gap-1 text-[11px] leading-snug text-amber-700 max-w-[230px] ${hist.length > 1 ? "cursor-help" : ""} ${className}`}
    >
      <span>
        Manually changed: <b>{rec.manual_from || "—"} → {rec.manual_to || rec.status}</b>
        <br />
        by {rec.changed_by_name || "Admin"}{rec.changed_by_role ? ` (${rec.changed_by_role})` : ""} · {when(rec.changed_at)}
        {hist.length > 1 && <span className="text-amber-500"> · {hist.length} changes</span>}
      </span>
    </div>
  );
  if (hist.length <= 1) return note;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{note}</TooltipTrigger>
        <TooltipContent side="bottom" align="start" className="max-w-xs space-y-1 py-2">
          <p className="font-semibold">Change history</p>
          {hist.map((h, i) => (
            <p key={i}>
              {h.from_status || "—"} → {h.to_status} · {h.changed_by_name}{h.changed_by_role ? ` (${h.changed_by_role})` : ""} · {when(h.changed_at)}
              {h.reason ? ` · “${h.reason}”` : ""}
            </p>
          ))}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
