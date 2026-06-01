import React, { useEffect, useState } from "react";
import api, { formatApiError } from "../../lib/api";
import { Modal, EmptyState } from "../../components/UI";
import { Field, FieldRow } from "../../components/Field";
import { useT } from "../../i18n";
import { Wrench, Plus, Pencil, Trash2 } from "lucide-react";

export default function AdminMaintenance() {
  const t = useT();
  const [staff, setStaff] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");

  const load = () =>
    api.get("/users", { params: { role: "maintenance" } })
      .then((r) => setStaff(r.data))
      .catch(() => setStaff([]));

  useEffect(() => { load(); }, []);

  const onSubmit = async (form) => {
    setError("");
    try {
      if (editing) {
        const p = { ...form };
        if (!p.password) delete p.password;
        delete p.username;
        await api.patch(`/users/${editing.id}`, p);
      } else {
        await api.post("/users", { ...form, role: "maintenance" });
      }
      await load();
      setOpen(false);
      setEditing(null);
    } catch (e) {
      setError(formatApiError(e));
    }
  };

  const closeModal = () => { setOpen(false); setEditing(null); setError(""); };

  const remove = async (m) => {
    if (!window.confirm(t("maintAdmin.deleteConfirm", { name: m.full_name }))) return;
    try { await api.delete(`/users/${m.id}`); await load(); } catch { /* ignore */ }
  };

  return (
    <div className="fade-in" data-testid="admin-maintenance-page">
      <header className="mb-6 flex justify-between items-end flex-wrap gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-400">{t("maintAdmin.team")}</div>
          <h1 className="text-3xl font-bold mt-1">{t("nav.maintenanceStaff")}</h1>
        </div>
        <button className="btn btn-primary" data-testid="add-maintenance-button"
          onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="w-4 h-4" /> {t("maintAdmin.add")}
        </button>
      </header>

      {staff.length === 0 ? (
        <EmptyState icon={Wrench} title={t("maintAdmin.empty")} subtitle={t("maintAdmin.emptyHint")} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table min-w-[600px]">
            <thead>
              <tr>
                <th>{t("tenantsAdmin.name")}</th>
                <th>{t("tenantsAdmin.username")}</th>
                <th>{t("tenantsAdmin.phone")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {staff.map((m) => (
                <tr key={m.id}>
                  <td className="font-medium">{m.full_name}</td>
                  <td className="text-slate-300">@{m.username}</td>
                  <td className="text-slate-300">{m.phone || "—"}</td>
                  <td className="space-x-2 whitespace-nowrap">
                    <button className="btn btn-secondary !py-1.5 !px-3 !text-xs"
                      data-testid={`edit-maintenance-${m.id}`}
                      onClick={() => { setEditing(m); setOpen(true); }}>
                      <Pencil className="w-3 h-3" /> {t("common.edit")}
                    </button>
                    <button className="btn btn-danger !py-1.5 !px-3 !text-xs"
                      data-testid={`delete-maintenance-${m.id}`} onClick={() => remove(m)}>
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
        title={editing ? t("maintAdmin.editStaff") : t("maintAdmin.addModalTitle")}>
        <MaintenanceForm initial={editing} onSubmit={onSubmit} onCancel={closeModal} error={error} />
      </Modal>
    </div>
  );
}

function submitLabel(t, busy, isEdit, createKey) {
  if (busy) return t("common.saving");
  return isEdit ? t("common.save") : t(createKey);
}

function MaintenanceForm({ initial, onSubmit, onCancel, error }) {
  const t = useT();
  const isEdit = !!initial;
  const [form, setForm] = useState({
    username: initial?.username || "", password: "",
    full_name: initial?.full_name || "", phone: initial?.phone || "",
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
        <Field label={t("tenantsAdmin.username")} name="username" value={form.username}
          onChange={update("username")} disabled={isEdit} required
          testid="form-maintenance-username" />
        <Field label={isEdit ? t("tenantsAdmin.newPasswordOptional") : t("login.password")}
          name="password" type="password" value={form.password}
          onChange={update("password")} required={!isEdit}
          testid="form-maintenance-password" />
      </FieldRow>
      <Field label={t("tenantsAdmin.fullName")} name="full_name" value={form.full_name}
        onChange={update("full_name")} required testid="form-maintenance-name" />
      <Field label={t("tenantsAdmin.phone")} name="phone" value={form.phone}
        onChange={update("phone")} testid="form-maintenance-phone" />
      {error && <div className="text-red-400 text-sm">{error}</div>}
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn btn-secondary flex-1"
          data-testid="cancel-maintenance-form">
          {t("common.cancel")}
        </button>
        <button type="submit" className="btn btn-primary flex-1" disabled={busy}
          data-testid="submit-maintenance-form">
          {submitLabel(t, busy, isEdit, "maintAdmin.createBtn")}
        </button>
      </div>
    </form>
  );
}
