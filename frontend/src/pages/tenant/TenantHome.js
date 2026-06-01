import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../lib/api";
import { StatusBadge, PriorityDot, EmptyState, AsyncList } from "../../components/UI";
import SLA from "../../components/SLA";
import { useT } from "../../i18n";
import { ClipboardList, Plus, Home, Image as ImageIcon } from "lucide-react";

const DAILY_LIMIT = 3;

export default function TenantHome() {
  const t = useT();
  const [tickets, setTickets] = useState([]);
  const [unit, setUnit] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get("/tickets"), api.get("/units")])
      .then(([tk, u]) => {
        setTickets(tk.data);
        setUnit(u.data[0] || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const today = new Date().toDateString();
  const todayCount = tickets.filter((tk) => new Date(tk.created_at).toDateString() === today).length;
  const left = Math.max(0, DAILY_LIMIT - todayCount);
  const limitText = todayCount >= DAILY_LIMIT
    ? t("tenantHome.limitReached")
    : t("tenantHome.ticketsLeft", { n: left });

  return (
    <div className="fade-in" data-testid="tenant-home">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-400">{t("tenantHome.portal")}</div>
          <h1 className="text-3xl font-bold mt-1">{t("tenantHome.title")}</h1>
        </div>
        <Link to="/tenant/new" className="btn btn-primary" data-testid="new-ticket-button">
          <Plus className="w-4 h-4" /> {t("nav.newTicket")}
        </Link>
      </header>

      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <div className="card p-5 md:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <Home className="w-4 h-4 text-accent" />
            <div className="text-xs uppercase tracking-wider text-slate-400">{t("tenantHome.myUnit")}</div>
          </div>
          {unit ? (
            <div>
              <div className="text-2xl font-bold">{unit.unit_number}</div>
              <div className="text-slate-300 text-sm mt-1">{unit.address}</div>
              {unit.building && <div className="text-slate-400 text-xs mt-0.5">{unit.building}</div>}
            </div>
          ) : (
            <div className="text-slate-400 text-sm">{t("tenantHome.noUnitAssigned")}</div>
          )}
        </div>
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wider text-slate-400 mb-3">{t("tenantHome.today")}</div>
          <div className="text-3xl font-bold font-display">{todayCount}/{DAILY_LIMIT}</div>
          <div className="text-slate-400 text-xs mt-1">{limitText}</div>
        </div>
      </div>

      <AsyncList
        loading={loading}
        isEmpty={tickets.length === 0}
        emptyNode={
          <EmptyState
            icon={ClipboardList}
            title={t("tenantHome.noTickets")}
            subtitle={t("tenantHome.noTicketsSub")}
            action={
              <Link to="/tenant/new" className="btn btn-primary" data-testid="empty-new-ticket">
                <Plus className="w-4 h-4" /> {t("tenantHome.firstTicket")}
              </Link>
            }
          />
        }
      >
        <div className="space-y-3">
          {tickets.map((tk) => (
            <Link to={`/tenant/tickets/${tk.id}`} key={tk.id}
              data-testid={`ticket-card-${tk.id}`}
              className="card p-5 flex flex-col sm:flex-row gap-4 sm:items-center hover:border-accent transition">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <PriorityDot priority={tk.priority} />
                  <span className="text-xs text-slate-500">{new Date(tk.created_at).toLocaleDateString()}</span>
                  <SLA ticket={tk} compact />
                </div>
                <h3 className="font-semibold truncate">{tk.title}</h3>
                <p className="text-sm text-slate-400 line-clamp-2 mt-1">{tk.description}</p>
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
