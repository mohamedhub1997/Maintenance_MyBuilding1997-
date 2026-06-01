import React, { useEffect, useState } from "react";
import api, { formatApiError } from "../../lib/api";
import { Modal, EmptyState } from "../../components/UI";
import { Field, FieldRow } from "../../components/Field";
import { useT } from "../../i18n";
import { Building2, Plus, Pencil, Trash2 } from "lucide-react";

export default function AdminUnits() {
  const t = useT();
  const [units, setUnits] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");

  const load = () =>
    api.get("/units").then((r) => setUnits(r.data)).catch(() => setUnits([]));

  useEffect(() => { load(); }, []);

  const onSubmit = async (form) => {
    setError("");
    try {
      if (editing) await api.patch(`/units/${editing.id}`, form);
      else await api.post("/units", form);
      await load();
      setOpen(false);
      setEditing(null);
    } catch (e) {
      setError(formatApiError(e));
    }
  };

  const closeModal = () => { setOpen(false); setEditing(null); setError(""); };

  const remove = async (u) => {
    if (!window.confirm(t("unitsAdmin.deleteConfirm", { n: u.unit_number }))) return;
    try { await api.delete(`/units/${u.id}`); await load(); } catch { /* ignore */ }
  };

  return (
    <div className="fade-in" data-testid="admin-units-page">
      <header className="mb-6 flex justify-between items-end flex-wrap gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-400">{t("unitsAdmin.property")}</div>
          <h1 className="text-3xl font-bold mt-1">{t("nav.units")}</h1>
        </div>
        <button className="btn btn-primary" data-testid="add-unit-button"
          onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="w-4 h-4" /> {t("unitsAdmin.add")}
        </button>
      </header>

      {units.length === 0 ? (
        <EmptyState icon={Building2} title={t("unitsAdmin.empty")} subtitle={t("unitsAdmin.emptyHint")} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table min-w-[700px]">
            <thead>
              <tr>
                <th>{t("unitsAdmin.unitNumber")}</th>
                <th>{t("unitsAdmin.building")}</th>
                <th>{t("unitsAdmin.address")}</th>
                <th>{t("dash.tenant")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {units.map((u) => (
                <tr key={u.id}>
                  <td className="font-medium">{u.unit_number}</td>
                  <td className="text-slate-300">{u.building || "—"}</td>
                  <td className="text-slate-300">{u.address}</td>
                  <td className="text-slate-300">
                    {u.tenant ? u.tenant.full_name : <span className="text-slate-500">{t("common.vacant")}</span>}
                  </td>
                  <td className="space-x-2 whitespace-nowrap">
                    <button className="btn btn-secondary !py-1.5 !px-3 !text-xs"
                      data-testid={`edit-unit-${u.id}`}
                      onClick={() => { setEditing(u); setOpen(true); }}>
                      <Pencil className="w-3 h-3" /> {t("common.edit")}
                    </button>
                    <button className="btn btn-danger !py-1.5 !px-3 !text-xs"
                      data-testid={`delete-unit-${u.id}`} onClick={() => remove(u)}>
                      <Trash2 className="w-3 h-3" /> {t("common.delete")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={closeModal}
        title={editing ? t("unitsAdmin.editUnit") : t("unitsAdmin.add")}>
        <UnitForm initial={editing} onSubmit={onSubmit} onCancel={closeModal} error={error} />
      </Modal>
    </div>
  );
}

function submitLabel(t, busy, isEdit, createKey) {
  if (busy) return t("common.saving");
  return isEdit ? t("common.save") : t(createKey);
}

function UnitForm({ initial, onSubmit, onCancel, error }) {
  const t = useT();
  const isEdit = !!initial;
  const [form, setForm] = useState({
    unit_number: initial?.unit_number || "", building: initial?.building || "",
    address: initial?.address || "", notes: initial?.notes || "",
  });
  const [busy, setBusy] = useState(false);
  const update = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    await onSubmit(form);
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <FieldRow>
        <Field label={t("unitsAdmin.unitNumber")} name="unit_number" value={form.unit_number}
          onChange={update("unit_number")} required testid="form-unit-number" />
        <Field label={t("unitsAdmin.building")} name="building" value={form.building}
          onChange={update("building")} testid="form-unit-building" />
      </FieldRow>
      <Field label={t("unitsAdmin.address")} name="address" value={form.address}
        onChange={update("address")} required testid="form-unit-address" />
      <div>
        <label className="label" htmlFor="notes">{t("unitsAdmin.notes")}</label>
        <textarea id="notes" name="notes" rows={3} className="input" value={form.notes}
          data-testid="form-unit-notes"
          onChange={update("notes")} />
      </div>
      {error && <div className="text-red-400 text-sm">{error}</div>}
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn btn-secondary flex-1"
          data-testid="cancel-unit-form">
          {t("common.cancel")}
        </button>
        <button type="submit" className="btn btn-primary flex-1" disabled={busy}
          data-testid="submit-unit-form">
          {submitLabel(t, busy, isEdit, "unitsAdmin.createBtn")}
        </button>
      </div>
    </form>
  );
}
