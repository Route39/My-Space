import { FilePen, CircleCheck, CircleX } from "lucide-react";

const MAP = [
  { e: "📝", Icon: FilePen, cls: "text-amber-500" },
  { e: "✅", Icon: CircleCheck, cls: "text-emerald-600" },
  { e: "❌", Icon: CircleX, cls: "text-rose-500" },
];

export default function LeaveMsgText({ text }) {
  if (!text) return null;
  const hit = MAP.find((m) => text.startsWith(m.e));
  if (!hit) return text;
  const rest = text.slice(hit.e.length).replace(/^\uFE0F?\s*/, "");
  const { Icon, cls } = hit;
  return (
    <span className="inline-flex items-start gap-1.5">
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${cls}`} />
      <span>{rest}</span>
    </span>
  );
}
