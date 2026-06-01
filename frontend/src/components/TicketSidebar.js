import React from "react";
import api from "../lib/api";
import { useT } from "../i18n";
import SLA from "./SLA";
import { UserCheck } from "lucide-react";

const STATUSES = ["open", "in_progress", "resolved"];

function Row({ label, value }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-slate-800 last:border-0 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="text-right text-slate-100 max-w-[60%] truncate">{value}</span>
    </div>
  );
}

function DetailsCard({ ticket }) {
  const t = useT();
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs uppercase tracking-wider text-slate-400">
          {t("ticketDetail.details")}
        </div>
        <SLA ticket={ticket} />
      </div>
      <Row label={t("ticketDetail.category")} value={ticket.category} />
      <Row label={t("dash.tenant")} value={ticket.tenant?.full_name || "—"} />
      <Row label={t("dash.unit")} value={ticket.unit?.unit_number || "—"} />
      {ticket.unit?.address && <Row label={t("ticketDetail.address")} value={ticket.unit.address} />}
      <Row label={t("ticketDetail.assignedTo")} value={ticket.maintenance?.full_name || t("common.unassigned")} />
      <Row label={t("ticketDetail.updated")} value={new Date(ticket.updated_at).toLocaleString()} />
    </div>
  );
}

function AssignmentCard({ ticketId, currentMaintenanceId, maintenance, onChanged }) {
  const t = useT();
  const assign = async (maintenance_id) => {
    if (!maintenance_id) return;
    try {
      await api.patch(`/tickets/${ticketId}/assign`, { maintenance_id });
      await onChanged();
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="card p-5">
      <div className="text-xs uppercase tracking-wider text-slate-400 mb-3">
        {t("ticketDetail.assignment")}
      </div>
      <select className="input" data-testid="assign-maintenance-select"
        value={currentMaintenanceId || ""}
        onChange={(e) => assign(e.target.value)}>
        <option value="">{t("common.unassigned")}</option>
        {maintenance.map((m) => (<option key={m.id} value={m.id}>{m.full_name}</option>))}
      </select>
    </div>
  );
}

function StatusCard({ ticketId, currentStatus, onChanged, userRole }) {
  const t = useT();
  // Maintenance can only toggle between Open and In Progress. Only admin can resolve.
  const allowedStatuses = userRole === "admin"
    ? STATUSES
    : STATUSES.filter((s) => s !== "resolved");

  const setStatus = async (status) => {
    try {
      await api.patch(`/tickets/${ticketId}/status`, { status });
      await onChanged();
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="card p-5">
      <div className="text-xs uppercase tracking-wider text-slate-400 mb-3">
        {t("ticketDetail.updateStatus")}
      </div>
      <div className="space-y-2">
        {allowedStatuses.map((s) => {
          const active = currentStatus === s;
          return (
            <button key={s} onClick={() => setStatus(s)} disabled={active}
              data-testid={`set-status-${s}`}
              className={`btn w-full justify-start ${active ? "btn-primary" : "btn-secondary"}`}>
              {active && <UserCheck className="w-4 h-4" />}
              {t(`status.${s}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function canChangeStatus(user, ticket) {
  if (user.role === "admin") return true;
  return user.role === "maintenance" && ticket.maintenance_id === user.id;
}

export default function TicketSidebar({ ticket, user, maintenance, onChanged }) {
  return (
    <aside className="space-y-4">
      <DetailsCard ticket={ticket} />
      {user.role === "admin" && (
        <AssignmentCard ticketId={ticket.id} currentMaintenanceId={ticket.maintenance_id}
          maintenance={maintenance} onChanged={onChanged} />
      )}
      {canChangeStatus(user, ticket) && (
        <StatusCard ticketId={ticket.id} currentStatus={ticket.status}
          onChanged={onChanged} userRole={user.role} />
      )}
    </aside>
  );
}
