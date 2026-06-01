import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../lib/api";
import { StatusBadge } from "../../components/UI";
import { useT } from "../../i18n";
import { ClipboardList, Users, Wrench, Building2, ArrowRight } from "lucide-react";

export default function AdminDashboard() {
  const t = useT();
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    api.get("/stats").then((r) => setStats(r.data)).catch(() => {});
    api.get("/tickets").then((r) => setRecent(r.data.slice(0, 6))).catch(() => {});
  }, []);

  const cards = [
    { label: t("dash.open"), value: stats?.open ?? "—", color: "#F59E0B" },
    { label: t("dash.inProgress"), value: stats?.in_progress ?? "—", color: "#3B82F6" },
    { label: t("dash.resolved"), value: stats?.resolved ?? "—", color: "#10B981" },
    { label: t("dash.overdueCard"), value: stats?.overdue ?? "—", color: "#EF4444" },
  ];

  const counts = [
    { label: t("dash.tenants"), value: stats?.tenants ?? 0, icon: Users, to: "/admin/tenants", testid: "card-tenants" },
    { label: t("dash.maintenanceStaff"), value: stats?.maintenance ?? 0, icon: Wrench, to: "/admin/maintenance", testid: "card-maintenance" },
    { label: t("dash.units"), value: stats?.units ?? 0, icon: Building2, to: "/admin/units", testid: "card-units" },
  ];

  return (
    <div className="fade-in" data-testid="admin-dashboard">
      <header className="mb-8">
        <div className="text-xs uppercase tracking-widest text-slate-400">{t("dash.overview")}</div>
        <h1 className="text-3xl font-bold mt-1">{t("dash.dashboard")}</h1>
        <p className="text-slate-400 text-sm mt-1">{t("dash.subtitle")}</p>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((c) => (
          <div key={c.label} className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
              <div className="text-xs uppercase tracking-wider text-slate-400">{c.label}</div>
            </div>
            <div className="text-4xl font-bold font-display">{c.value}</div>
          </div>
        ))}
      </section>

      <section className="grid md:grid-cols-3 gap-4 mb-8">
        {counts.map((c) => (
          <Link to={c.to} key={c.label} data-testid={c.testid}
            className="card p-5 flex items-center gap-4 hover:border-accent transition">
            <div className="w-11 h-11 rounded-md bg-accent/15 text-accent flex items-center justify-center">
              <c.icon className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="text-xs uppercase tracking-wider text-slate-400">{c.label}</div>
              <div className="text-2xl font-bold">{c.value}</div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500" />
          </Link>
        ))}
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-accent" /> {t("dash.recent")}
          </h2>
          <Link to="/admin/tickets" className="text-sm text-accent hover:underline">
            {t("dash.viewAll")}
          </Link>
        </div>
        <div className="card overflow-hidden">
          {recent.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">{t("dash.noTickets")}</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>{t("dash.title")}</th>
                  <th>{t("dash.tenant")}</th>
                  <th>{t("dash.unit")}</th>
                  <th>{t("dash.status")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {recent.map((tk) => (
                  <tr key={tk.id}>
                    <td className="font-medium">{tk.title}</td>
                    <td className="text-slate-300">{tk.tenant?.full_name || "—"}</td>
                    <td className="text-slate-300">{tk.unit?.unit_number || "—"}</td>
                    <td><StatusBadge status={tk.status} /></td>
                    <td>
                      <Link to={`/admin/tickets/${tk.id}`}
                        className="text-accent text-sm hover:underline"
                        data-testid={`open-ticket-${tk.id}`}>
                        {t("dash.open_v")}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
