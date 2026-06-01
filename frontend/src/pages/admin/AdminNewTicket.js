import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { formatApiError } from "../../lib/api";
import ImageUploader from "../../components/ImageUploader";
import { useT } from "../../i18n";
import { ArrowLeft } from "lucide-react";

const CATEGORIES = ["general", "plumbing", "electrical", "appliance", "HVAC", "structural", "other"];

export default function AdminNewTicket() {
  const navigate = useNavigate();
  const t = useT();
  const [tenants, setTenants] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [form, setForm] = useState({
    tenant_id: "",
    title: "",
    description: "",
    category: "general",
    priority: "medium",
    images: [],
    maintenance_id: "", // empty = auto-assign
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/users", { params: { role: "tenant" } })
      .then((r) => setTenants(r.data.filter((u) => u.unit_id)))
      .catch(() => setTenants([]));
    api.get("/users", { params: { role: "maintenance" } })
      .then((r) => setMaintenance(r.data))
      .catch(() => setMaintenance([]));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const payload = { ...form };
      if (!payload.maintenance_id) delete payload.maintenance_id;
      await api.post("/tickets", payload);
      navigate("/admin/tickets");
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl fade-in" data-testid="admin-new-ticket-page">
      <button
        onClick={() => navigate(-1)}
        className="text-slate-400 text-sm flex items-center gap-1 mb-4 hover:text-white"
        data-testid="back-button"
      >
        <ArrowLeft className="w-4 h-4" /> {t("common.back")}
      </button>
      <h1 className="text-3xl font-bold mb-1">{t("ticketForm.headingAdmin")}</h1>
      <p className="text-slate-400 text-sm mb-6">{t("ticketForm.subtitleAdmin")}</p>

      <form onSubmit={submit} className="card p-6 space-y-5">
        <div>
          <label className="label">{t("ticketForm.selectTenant")}</label>
          <select
            className="input"
            data-testid="admin-ticket-tenant-input"
            value={form.tenant_id}
            onChange={(e) => setForm({ ...form, tenant_id: e.target.value })}
            required
          >
            <option value="">{t("ticketForm.selectTenantPh")}</option>
            {tenants.map((tn) => (
              <option key={tn.id} value={tn.id}>
                {tn.full_name} · @{tn.username}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">{t("ticketForm.title")}</label>
          <input
            className="input"
            data-testid="ticket-title-input"
            placeholder={t("ticketForm.titlePh")}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="label">{t("ticketForm.description")}</label>
          <textarea
            className="input"
            rows={5}
            data-testid="ticket-description-input"
            placeholder={t("ticketForm.descriptionPh")}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">{t("ticketForm.category")}</label>
            <select
              className="input"
              data-testid="ticket-category-input"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
            </select>
          </div>
          <div>
            <label className="label">{t("ticketForm.priority")}</label>
            <select
              className="input"
              data-testid="ticket-priority-input"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            >
              <option value="low">{t("ticketForm.priority.low")}</option>
              <option value="medium">{t("ticketForm.priority.medium")}</option>
              <option value="high">{t("ticketForm.priority.high")}</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label">{t("tickets.assignTo")}</label>
          <select
            className="input"
            data-testid="admin-ticket-assignee-input"
            value={form.maintenance_id}
            onChange={(e) => setForm({ ...form, maintenance_id: e.target.value })}
          >
            <option value="">{t("tickets.autoAssign")}</option>
            {maintenance.map((m) => (
              <option key={m.id} value={m.id}>{m.full_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">{t("ticketForm.photos")}</label>
          <ImageUploader
            images={form.images}
            onChange={(imgs) => setForm({ ...form, images: imgs })}
          />
        </div>
        {error && <div className="text-red-400 text-sm">{error}</div>}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn btn-secondary flex-1"
            data-testid="cancel-button"
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            className="btn btn-primary flex-1"
            disabled={busy}
            data-testid="submit-ticket-button"
          >
            {busy ? t("ticketForm.submitting") : t("ticketForm.submit")}
          </button>
        </div>
      </form>
    </div>
  );
}
