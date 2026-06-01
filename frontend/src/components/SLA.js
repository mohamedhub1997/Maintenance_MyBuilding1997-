import React from "react";
import { useT } from "../i18n";
import { Clock, AlertTriangle, CheckCircle2 } from "lucide-react";

/**
 * SLA badge.
 * Shows:
 *  - Resolved time (if resolved_at set) → green checkmark
 *  - Overdue ticket (due_at passed, not resolved) → red warning
 *  - Time remaining (otherwise) → muted clock
 *
 * `ticket.due_at`, `ticket.resolved_at`, `ticket.created_at`, `ticket.status` are used.
 */
export default function SLA({ ticket, compact = false }) {
  const t = useT();
  if (!ticket) return null;

  const status = ticket.status;
  const dueAt = ticket.due_at ? new Date(ticket.due_at).getTime() : null;
  const createdAt = ticket.created_at ? new Date(ticket.created_at).getTime() : null;
  const resolvedAt = ticket.resolved_at ? new Date(ticket.resolved_at).getTime() : null;

  // Resolved within SLA
  if (status === "resolved" && resolvedAt && createdAt) {
    const hours = Math.max(0, Math.round((resolvedAt - createdAt) / 3600_000));
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400" data-testid="sla-resolved">
        <CheckCircle2 className="w-3 h-3" />
        {t("sla.resolvedIn", { n: hours })}
      </span>
    );
  }

  if (!dueAt) return null;
  const now = Date.now();
  const diff = dueAt - now; // ms

  // Overdue
  if (diff < 0 && status !== "resolved") {
    const lateHrs = Math.floor(-diff / 3600_000);
    const text = lateHrs >= 48
      ? t("sla.overdueByDays", { n: Math.floor(lateHrs / 24) })
      : t("sla.overdueBy", { n: lateHrs });
    return (
      <span
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-300 bg-red-500/15 px-2 py-0.5 rounded-full"
        data-testid="sla-overdue"
      >
        <AlertTriangle className="w-3 h-3" />
        {compact ? t("sla.overdue") : text}
      </span>
    );
  }

  // Due in N…
  const hrsLeft = Math.floor(diff / 3600_000);
  const minsLeft = Math.floor(diff / 60_000);
  let label;
  if (hrsLeft >= 24) label = t("sla.dueInDays", { n: Math.floor(hrsLeft / 24) });
  else if (hrsLeft >= 1) label = t("sla.dueIn", { n: hrsLeft });
  else label = t("sla.dueSoon", { n: Math.max(0, minsLeft) });

  // Urgent if under 12h
  const urgent = hrsLeft < 12;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] ${
        urgent ? "text-amber-300" : "text-slate-400"
      }`}
      data-testid="sla-due"
    >
      <Clock className="w-3 h-3" />
      {label}
    </span>
  );
}
