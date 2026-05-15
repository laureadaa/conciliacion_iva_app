import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Client, ClientStatus } from "@freelance/shared";
import { api } from "../lib/api";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import Spinner from "../components/Spinner";
import EmptyState from "../components/EmptyState";

const STATUSES: { value: ClientStatus; label: string; cls: string }[] = [
  { value: "potential", label: "Potencial", cls: "badge-yellow" },
  { value: "active", label: "Activo", cls: "badge-green" },
  { value: "recurring", label: "Recurrente", cls: "badge-purple" },
  { value: "inactive", label: "Inactivo", cls: "badge-gray" },
];

const empty = { name: "", company: "", email: "", notes: "", status: "potential" as ClientStatus };

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Client | null>(null);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  function load() {
    return api.get<Client[]>("/clients").then(setClients);
  }

  useEffect(() => {
    load()
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  function openNew() {
    setEditing(null);
    setForm(empty);
    setShow(true);
  }
  function openEdit(c: Client) {
    setEditing(c);
    setForm({
      name: c.name,
      company: c.company || "",
      email: c.email || "",
      notes: c.notes || "",
      status: c.status,
    });
    setShow(true);
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        company: form.company || null,
        email: form.email || null,
        notes: form.notes || null,
        status: form.status,
      };
      if (editing) {
        await api.put(`/clients/${editing.id}`, payload);
        toast.success("Cliente actualizado");
      } else {
        await api.post("/clients", payload);
        toast.success("Cliente añadido");
      }
      setShow(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function del(id: number) {
    if (!confirm("¿Eliminar cliente?")) return;
    try {
      await api.del(`/clients/${id}`);
      setClients((arr) => arr.filter((c) => c.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  }

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle="Gestiona tu cartera de clientes"
        actions={
          <button className="btn-primary" onClick={openNew}>
            + Añadir cliente
          </button>
        }
      />

      {loading ? (
        <div className="grid h-64 place-items-center">
          <Spinner size={28} />
        </div>
      ) : clients.length === 0 ? (
        <EmptyState
          icon="👥"
          title="Sin clientes"
          description="Empieza a registrar tus clientes y prospectos."
          action={
            <button className="btn-primary" onClick={openNew}>
              Añadir cliente
            </button>
          }
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-500">
                <th className="py-2 pr-4">Nombre</th>
                <th className="py-2 pr-4">Empresa</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Estado</th>
                <th className="py-2 pr-4">Notas</th>
                <th className="py-2 pr-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const s = STATUSES.find((x) => x.value === c.status);
                return (
                  <tr
                    key={c.id}
                    className="border-t border-slate-100 dark:border-slate-800"
                  >
                    <td className="py-2 pr-4 font-medium">{c.name}</td>
                    <td className="py-2 pr-4 text-slate-500">{c.company || "—"}</td>
                    <td className="py-2 pr-4 text-slate-500">{c.email || "—"}</td>
                    <td className="py-2 pr-4">
                      <span className={s?.cls}>{s?.label}</span>
                    </td>
                    <td className="py-2 pr-4 max-w-[280px] truncate text-slate-500">
                      {c.notes || "—"}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      <button
                        className="btn-ghost text-xs"
                        onClick={() => openEdit(c)}
                      >
                        Editar
                      </button>
                      <button
                        className="btn-ghost text-xs text-rose-600"
                        onClick={() => del(c.id)}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={show}
        onClose={() => setShow(false)}
        title={editing ? "Editar cliente" : "Nuevo cliente"}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setShow(false)}>
              Cancelar
            </button>
            <button
              className="btn-primary"
              onClick={(e) => onSave(e as unknown as FormEvent)}
              disabled={saving}
            >
              {saving ? <Spinner /> : "Guardar"}
            </button>
          </>
        }
      >
        <form className="grid grid-cols-1 gap-3 md:grid-cols-2" onSubmit={onSave}>
          <div className="md:col-span-2">
            <label className="label">Nombre</label>
            <input
              className="input"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Empresa</label>
            <input
              className="input"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <label className="label">Estado</label>
            <select
              className="input"
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as ClientStatus })
              }
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="label">Notas</label>
            <textarea
              className="input min-h-[100px]"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </form>
      </Modal>
    </>
  );
}
