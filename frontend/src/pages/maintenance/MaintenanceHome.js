import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../lib/api";
import { StatusBadge, PriorityDot, EmptyState, AsyncList } from "../../components/UI";
import SLA from "../../components/SLA";
import { useT } from "../../i18n";
import { Wrench, Image as ImageIcon } from "lucide-react";

export default function MaintenanceHome() {
  const t = useT();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("active");

  useEffect(() => {
    api.get("/tickets")
      .then((r) => setTickets(r.data))
      .catch(() => setTickets([]))
      .finally(() => setLoading(false));
  }, []);

  const counts = {
    active: tickets.filter((tk) => tk.status !== "resolved").length,
    open: tickets.filter((tk) => tk.status === "open").length,
    in_progress: tickets.filter((tk) => tk.status === "in_progress").length,
    resolved: tickets.filter((tk) => tk.status === "resolved").length,
    all: tickets.length,
  };

  const filtered = tickets.filter((tk) => {
    if (filter === "all") return true;
    if (filter === "active") return tk.status !== "resolved";
    return tk.status === filter;
  });

  const filters = [
    { k: "active", label: t("tickets.filter.active") },
    { k: "open", label: t("tickets.filter.open") },
    { k: "in_progress", label: t("tickets.filter.inProgress") },
    { k: "resolved", label: t("tickets.filter.resolved") },
    { k: "all", label: t("tickets.filter.all") },
  ];

  return (
    <div className="fade-in" data-testid="maintenance-home">
      <header className="mb-6">
        <div className="text-xs uppercase tracking-widest text-slate-400">{t("maintHome.ops")}</div>
        <h1 className="text-3xl font-bold mt-1">{t("maintHome.title")}</h1>
        <p className="text-slate-400 text-sm mt-1">{t("maintHome.subtitle")}</p>
      </header>

      <div className="flex gap-2 flex-wrap mb-4">
        {filters.map((f) => (
          <button key={f.k} onClick={() => setFilter(f.k)} data-testid={`filter-${f.k}`}
            className={`btn ${filter === f.k ? "btn-primary" : "btn-secondary"} !py-2 !px-3 !text-xs`}>
            {f.label} <span className="ml-1 opacity-70">({counts[f.k]})</span>
          </button>
        ))}
      </div>

      <AsyncList
        loading={loading}
        isEmpty={filtered.length === 0}
        emptyNode={<EmptyState icon={Wrench} title={t("maintHome.empty")} subtitle={t("maintHome.emptyHint")} />}
      >
        <div className="space-y-3">
          {filtered.map((tk) => (
            <Link to={`/maintenance/tickets/${tk.id}`} key={tk.id}
              data-testid={`ticket-card-${tk.id}`}
              className="card p-5 flex flex-col sm:flex-row gap-4 sm:items-center hover:border-accent transition">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <PriorityDot priority={tk.priority} />
                  <span className="text-xs text-slate-500">{new Date(tk.created_at).toLocaleDateString()}</span>
                  {tk.unit?.unit_number && (
                    <span className="text-xs text-slate-400">{t("dash.unit")} {tk.unit.unit_number}</span>
                  )}
                  <SLA ticket={tk} compact />
                </div>
                <h3 className="font-semibold truncate">{tk.title}</h3>
                <p className="text-sm text-slate-400 line-clamp-2 mt-1">{tk.description}</p>
                <div className="text-xs text-slate-500 mt-2">
                  {t("common.tenant")}: {tk.tenant?.full_name || "—"}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {tk.images?.length > 0 && (
                  <span className="text-xs text-slate-400 inline-flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" /> {tk.images.length}
                  </span>
                )}
                <StatusBadge status={tk.status} />
              </div>
            </Link>
          ))}
        </div>
      </AsyncList>
    </div>
  );
}
