import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { formatApiError } from "../../lib/api";
import ImageUploader from "../../components/ImageUploader";
import { useT } from "../../i18n";
import { ArrowLeft } from "lucide-react";

const CATEGORIES = ["general", "plumbing", "electrical", "appliance", "HVAC", "structural", "other"];

export default function TenantNewTicket() {
  const navigate = useNavigate();
  const t = useT();
  const [form, setForm] = useState({
    title: "", description: "", category: "general", priority: "medium", images: [],
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.post("/tickets", form);
      navigate("/tenant");
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl fade-in" data-testid="new-ticket-page">
      <button onClick={() => navigate(-1)}
        className="text-slate-400 text-sm flex items-center gap-1 mb-4 hover:text-white"
        data-testid="back-button">
        <ArrowLeft className="w-4 h-4" /> {t("common.back")}
      </button>
      <h1 className="text-3xl font-bold mb-1">{t("ticketForm.heading")}</h1>
      <p className="text-slate-400 text-sm mb-6">{t("ticketForm.subtitle")}</p>

      <form onSubmit={submit} className="card p-6 space-y-5">
        <div>
          <label className="label">{t("ticketForm.title")}</label>
          <input className="input" data-testid="ticket-title-input"
            placeholder={t("ticketForm.titlePh")}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required />
        </div>
        <div>
          <label className="label">{t("ticketForm.description")}</label>
          <textarea className="input" rows={5} data-testid="ticket-description-input"
            placeholder={t("ticketForm.descriptionPh")}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">{t("ticketForm.category")}</label>
            <select className="input" data-testid="ticket-category-input"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
            </select>
          </div>
          <div>
            <label className="label">{t("ticketForm.priority")}</label>
            <select className="input" data-testid="ticket-priority-input"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              <option value="low">{t("ticketForm.priority.low")}</option>
              <option value="medium">{t("ticketForm.priority.medium")}</option>
              <option value="high">{t("ticketForm.priority.high")}</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label">{t("ticketForm.photos")}</label>
          <ImageUploader images={form.images} onChange={(imgs) => setForm({ ...form, images: imgs })} />
        </div>
        {error && <div className="text-red-400 text-sm">{error}</div>}
        <div className="flex gap-3">
          <button type="button" onClick={() => navigate(-1)} className="btn btn-secondary flex-1"
            data-testid="cancel-button">
            {t("common.cancel")}
          </button>
          <button type="submit" className="btn btn-primary flex-1" disabled={busy}
            data-testid="submit-ticket-button">
            {busy ? t("ticketForm.submitting") : t("ticketForm.submit")}
          </button>
        </div>
      </form>
    </div>
  );
}
