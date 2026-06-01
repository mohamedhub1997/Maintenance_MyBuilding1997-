import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api, { formatApiError } from "../../lib/api";
import { StatusBadge, PriorityDot, EmptyState, AsyncList } from "../../components/UI";
import SLA from "../../components/SLA";
import { useT } from "../../i18n";
import { ClipboardList, Plus, Search, X } from "lucide-react";

export default function AdminTickets() {
  const t = useT();
  const [tickets, setTickets] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [priority, setPriority] = useState("all");
  const [assigneeId, setAssigneeId] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/tickets")
      .then((r) => setTickets(r.data))
      .catch((e) => setError(formatApiError(e)))
      .finally(() => setLoading(false));
    api.get("/users", { params: { role: "maintenance" } })
      .then((r) => setMaintenance(r.data))
      .catch(() => setMaintenance([]));
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return tickets.filter((tk) => {
      if (status !== "all" && tk.status !== status) return false;
      if (priority !== "all" && tk.priority !== priority) return false;
      if (assigneeId !== "all") {
        if (assigneeId === "unassigned" && tk.maintenance_id) return false;
        if (assigneeId !== "unassigned" && tk.maintenance_id !== assigneeId) return false;
      }
      if (!term) return true;
      const hay = [
        tk.title, tk.description, tk.category,
        tk.tenant?.full_name, tk.unit?.unit_number, tk.unit?.address,
        tk.maintenance?.full_name,
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(term);
    });
  }, [tickets, status, priority, assigneeId, q]);

  const counts = {
    all: tickets.length,
    open: tickets.filter((tk) => tk.status === "open").length,
    in_progress: tickets.filter((tk) => tk.status === "in_progress").length,
    resolved: tickets.filter((tk) => tk.status === "resolved").length,
  };

  const statusFilters = [
    { k: "all", label: t("tickets.filter.all") },
    { k: "open", label: t("tickets.filter.open") },
    { k: "in_progress", label: t("tickets.filter.inProgress") },
    { k: "resolved", label: t("tickets.filter.resolved") },
  ];

  const hasFilters = q || status !== "all" || priority !== "all" || assigneeId !== "all";
  const clear = () => { setQ(""); setStatus("all"); setPriority("all"); setAssigneeId("all"); };

  return (
    <div className="fade-in" data-testid="admin-tickets-page">
      <header className="mb-6 flex justify-between items-end flex-wrap gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-400">{t("tickets.allTickets")}</div>
          <h1 className="text-3xl font-bold mt-1">{t("tickets.maintenanceTickets")}</h1>
        </div>
        <Link to="/admin/tickets/new" className="btn btn-primary" data-testid="admin-new-ticket-btn">
          <Plus className="w-4 h-4" /> {t("tickets.newTicket")}
        </Link>
      </header>

      {/* Search + filters */}
      <div className="card p-4 mb-4 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 ltr:left-3 rtl:right-3 text-slate-500" />
          <input
            data-testid="tickets-search-input"
            type="search"
            className="input ltr:pl-9 rtl:pr-9"
            placeholder={t("search.placeholder")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className="label">{t("search.priority")}</label>
            <select className="input" data-testid="filter-priority-select"
              value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="all">{t("search.allPriorities")}</option>
              <option value="high">{t("ticketForm.priority.high")}</option>
              <option value="medium">{t("ticketForm.priority.medium")}</option>
              <option value="low">{t("ticketForm.priority.low")}</option>
            </select>
          </div>
          <div>
            <label className="label">{t("search.assignee")}</label>
            <select className="input" data-testid="filter-assignee-select"
              value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="all">{t("search.allAssignees")}</option>
              <option value="unassigned">{t("common.unassigned")}</option>
              {maintenance.map((m) => (
                <option key={m.id} value={m.id}>{m.full_name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            {hasFilters && (
              <button onClick={clear} data-testid="filter-clear"
                className="btn btn-secondary w-full !text-xs">
                <X className="w-3 h-3" /> {t("search.clear")}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap mb-4">
        {statusFilters.map((f) => (
          <button key={f.k} onClick={() => setStatus(f.k)} data-testid={`filter-${f.k}`}
            className={`btn ${status === f.k ? "btn-primary" : "btn-secondary"} !py-2 !px-3 !text-xs`}>
            {f.label} <span className="ml-1 opacity-70">({counts[f.k]})</span>
          </button>
        ))}
        <div className="text-xs text-slate-500 self-center ltr:ml-auto rtl:mr-auto">
          {t("search.results", { n: filtered.length })}
        </div>
      </div>

      {error && <div className="text-red-400 text-sm mb-3">{error}</div>}

      <AsyncList
        loading={loading}
        isEmpty={filtered.length === 0}
        emptyNode={<EmptyState icon={ClipboardList} title={t("tickets.empty")} subtitle={t("tickets.emptyHint")} />}
      >
        <div className="card overflow-x-auto">
          <table className="table min-w-[900px]">
            <thead>
              <tr>
                <th>{t("dash.title")}</th>
                <th>{t("dash.tenant")}</th>
                <th>{t("dash.unit")}</th>
                <th>{t("tickets.assigned")}</th>
                <th>{t("tickets.priority")}</th>
                <th>{t("sla.tag")}</th>
                <th>{t("dash.status")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((tk) => (
                <tr key={tk.id}>
                  <td className="font-medium max-w-xs truncate">{tk.title}</td>
                  <td className="text-slate-300">{tk.tenant?.full_name || "—"}</td>
                  <td className="text-slate-300">{tk.unit?.unit_number || "—"}</td>
                  <td className="text-slate-300">{tk.maintenance?.full_name || t("common.unassigned")}</td>
                  <td><PriorityDot priority={tk.priority} /></td>
                  <td><SLA ticket={tk} compact /></td>
                  <td><StatusBadge status={tk.status} /></td>
                  <td>
                    <Link to={`/admin/tickets/${tk.id}`}
                      className="text-accent text-sm hover:underline"
                      data-testid={`open-ticket-${tk.id}`}>
                      {t("tickets.openBtn")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AsyncList>
    </div>
  );
}
