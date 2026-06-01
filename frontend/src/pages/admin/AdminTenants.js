import React, { useEffect, useState } from "react";
import api, { formatApiError } from "../../lib/api";
import { Modal, EmptyState } from "../../components/UI";
import { Field, FieldRow } from "../../components/Field";
import { useT } from "../../i18n";
import { Users, Plus, Pencil, Trash2 } from "lucide-react";

export default function AdminTenants() {
  const t = useT();
  const [tenants, setTenants] = useState([]);
  const [units, setUnits] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const [u, un] = await Promise.all([
        api.get("/users", { params: { role: "tenant" } }),
        api.get("/units"),
      ]);
      setTenants(u.data);
      setUnits(un.data);
    } catch {
      /* surfaced inline if needed */
    }
  };

  useEffect(() => { load(); }, []);

  const onSubmit = async (form) => {
    setError("");
    try {
      if (editing) await api.patch(`/users/${editing.id}`, form);
      else await api.post("/users", { ...form, role: "tenant" });
      await load();
      setOpen(false);
      setEditing(null);
    } catch (e) {
      setError(formatApiError(e));
    }
  };

  const closeModal = () => { setOpen(false); setEditing(null); setError(""); };

  const remove = async (tn) => {
    if (!window.confirm(t("tenantsAdmin.deleteConfirm", { name: tn.full_name }))) return;
    try { await api.delete(`/users/${tn.id}`); await load(); } catch { /* ignore */ }
  };

  const usedUnits = new Set(tenants.filter((tn) => tn.unit_id).map((tn) => tn.unit_id));
  const availableUnits = (excludeUnitId) =>
    units.filter((u) => !usedUnits.has(u.id) || u.id === excludeUnitId);

  return (
    <div className="fade-in" data-testid="admin-tenants-page">
      <header className="mb-6 flex justify-between items-end flex-wrap gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-400">{t("tenantsAdmin.directory")}</div>
          <h1 className="text-3xl font-bold mt-1">{t("tenantsAdmin.title")}</h1>
        </div>
        <button className="btn btn-primary" data-testid="add-tenant-button"
          onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="w-4 h-4" /> {t("tenantsAdmin.add")}
        </button>
      </header>

      {tenants.length === 0 ? (
        <EmptyState icon={Users} title={t("tenantsAdmin.empty")} subtitle={t("tenantsAdmin.emptyHint")} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table min-w-[800px]">
            <thead>
              <tr>
                <th>{t("tenantsAdmin.name")}</th>
                <th>{t("tenantsAdmin.username")}</th>
                <th>{t("dash.unit")}</th>
                <th>{t("tenantsAdmin.phone")}</th>
                <th>{t("tenantsAdmin.contract")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((tn) => {
                const unit = units.find((u) => u.id === tn.unit_id);
                return (
                  <tr key={tn.id}>
                    <td className="font-medium">{tn.full_name}</td>
                    <td className="text-slate-300">@{tn.username}</td>
                    <td className="text-slate-300">
                      {unit?.unit_number || <span className="text-amber-400">{t("tenantsAdmin.unassigned")}</span>}
                    </td>
                    <td className="text-slate-300">{tn.phone || "—"}</td>
                    <td className="text-slate-300">{tn.contract_number || "—"}</td>
                    <td className="space-x-2 whitespace-nowrap">
                      <button className="btn btn-secondary !py-1.5 !px-3 !text-xs"
                        data-testid={`edit-tenant-${tn.id}`}
                        onClick={() => { setEditing(tn); setOpen(true); }}>
                        <Pencil className="w-3 h-3" /> {t("common.edit")}
                      </button>
                      <button className="btn btn-danger !py-1.5 !px-3 !text-xs"
                        data-testid={`delete-tenant-${tn.id}`} onClick={() => remove(tn)}>
                        <Trash2 className="w-3 h-3" /> {t("common.delete")}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={closeModal}
        title={editing ? t("tenantsAdmin.editTenant") : t("tenantsAdmin.add")}>
        <TenantForm
          initial={editing}
          unitOptions={availableUnits(editing?.unit_id)}
          onSubmit={onSubmit}
          onCancel={closeModal}
          error={error}
        />
      </Modal>
    </div>
  );
}

function submitLabel(t, busy, isEdit, createKey) {
  if (busy) return t("common.saving");
  return isEdit ? t("common.save") : t(createKey);
}

const TENANT_FIELDS_INITIAL = {
  username: "", password: "", full_name: "", phone: "",
  national_id: "", contract_number: "", unit_id: "",
};

function buildTenantPayload(form, isEdit) {
  const payload = { ...form, unit_id: form.unit_id || null };
  if (isEdit) {
    delete payload.username;
    if (!payload.password) delete payload.password;
  }
  return payload;
}

function TenantForm({ initial, unitOptions, onSubmit, onCancel, error }) {
  const t = useT();
  const isEdit = !!initial;
  const [form, setForm] = useState({ ...TENANT_FIELDS_INITIAL, ...(initial || {}), password: "" });
  const [busy, setBusy] = useState(false);
  const update = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    await onSubmit(buildTenantPayload(form, isEdit));
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <FieldRow>
        <Field label={t("tenantsAdmin.username")} name="username" value={form.username}
          onChange={update("username")} disabled={isEdit} required
          testid="form-tenant-username" />
        <Field label={isEdit ? t("tenantsAdmin.newPasswordOptional") : t("login.password")}
          name="password" type="password" value={form.password}
          onChange={update("password")} required={!isEdit}
          testid="form-tenant-password" />
      </FieldRow>
      <Field label={t("tenantsAdmin.fullName")} name="full_name" value={form.full_name}
        onChange={update("full_name")} required testid="form-tenant-name" />
      <FieldRow>
        <Field label={t("tenantsAdmin.phone")} name="phone" value={form.phone}
          onChange={update("phone")} testid="form-tenant-phone" />
        <Field label={t("tenantsAdmin.nationalId")} name="national_id" value={form.national_id}
          onChange={update("national_id")} testid="form-tenant-id" />
      </FieldRow>
      <FieldRow>
        <Field label={t("tenantsAdmin.contractNumber")} name="contract_number" value={form.contract_number}
          onChange={update("contract_number")} testid="form-tenant-contract" />
        <Field label={t("dash.unit")} name="unit_id" type="select" value={form.unit_id}
          onChange={update("unit_id")} testid="form-tenant-unit">
          <option value="">{t("common.none")}</option>
          {unitOptions.map((u) => (
            <option key={u.id} value={u.id}>{u.unit_number} · {u.address}</option>
          ))}
        </Field>
      </FieldRow>
      {error && <div className="text-red-400 text-sm">{error}</div>}
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn btn-secondary flex-1"
          data-testid="cancel-tenant-form">
          {t("common.cancel")}
        </button>
        <button type="submit" className="btn btn-primary flex-1" disabled={busy} data-testid="submit-tenant-form">
          {submitLabel(t, busy, isEdit, "tenantsAdmin.createBtn")}
        </button>
      </div>
    </form>
  );
}
