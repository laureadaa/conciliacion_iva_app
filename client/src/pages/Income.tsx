import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import type { Client, Income } from "@pitchfork/shared";
import { api } from "../lib/api";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import Spinner from "../components/Spinner";
import EmptyState from "../components/EmptyState";

export default function IncomePage() {
  const [items, setItems] = useState<Income[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [description, setDescription] = useState("");
  const [receivedAt, setReceivedAt] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [clientId, setClientId] = useState("");

  function load() {
    return Promise.all([
      api.get<Income[]>("/income").then(setItems),
      api.get<Client[]>("/clients").then(setClients),
    ]);
  }

  useEffect(() => {
    load()
      .catch((e) => toast.error(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoading(false));
  }, []);

  const monthly = useMemo(() => {
    const map: Record<string, number> = {};
    for (const i of items) {
      const d = new Date(i.receivedAt);
      if (isNaN(d.getTime())) continue;
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      map[key] = (map[key] || 0) + i.amount;
    }
    const now = new Date();
    const out: { month: string; total: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      out.push({ month: key.slice(5), total: Math.round(map[key] || 0) });
    }
    return out;
  }, [items]);

  const now = new Date();
  const cmKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const currentMonthTotal = items
    .filter((i) => i.receivedAt.startsWith(cmKey))
    .reduce((a, b) => a + b.amount, 0);
  const dayOfMonth = now.getUTCDate();
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const ratio = dayOfMonth / daysInMonth;
  const projected = ratio > 0 ? Math.round(currentMonthTotal / ratio) : 0;
  const ytd = items
    .filter((i) => i.receivedAt.startsWith(String(now.getUTCFullYear())))
    .reduce((a, b) => a + b.amount, 0);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post<Income>("/income", {
        amount: Number(amount),
        currency,
        description: description || null,
        receivedAt,
        clientId: clientId ? Number(clientId) : null,
      });
      toast.success("Pago registrado");
      setShow(false);
      setAmount("");
      setDescription("");
      setClientId("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function del(id: number) {
    if (!confirm("¿Eliminar registro?")) return;
    try {
      await api.del(`/income/${id}`);
      setItems((arr) => arr.filter((i) => i.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  }

  return (
    <>
      <PageHeader
        title="Tracker de ingresos"
        subtitle="Registra cobros y visualiza tu evolución"
        actions={
          <button className="btn-primary" onClick={() => setShow(true)}>
            + Registrar pago
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Mes actual" value={`${Math.round(currentMonthTotal).toLocaleString()} €`} />
        <Stat label="Proyección mes" value={`${projected.toLocaleString()} €`} />
        <Stat label="Año en curso" value={`${Math.round(ytd).toLocaleString()} €`} />
      </div>

      <div className="card mt-6">
        <h3 className="mb-3 font-semibold">Ingresos por mes</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="total" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="grid h-32 place-items-center">
            <Spinner size={28} />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon="📈"
            title="Sin ingresos registrados"
            description="Registra tu primer pago para empezar a medir."
          />
        ) : (
          <div className="card overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-500">
                  <th className="py-2 pr-4">Fecha</th>
                  <th className="py-2 pr-4">Importe</th>
                  <th className="py-2 pr-4">Cliente</th>
                  <th className="py-2 pr-4">Descripción</th>
                  <th className="py-2 pr-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => {
                  const c = clients.find((cl) => cl.id === i.clientId);
                  return (
                    <tr
                      key={i.id}
                      className="border-t border-slate-100 dark:border-slate-800"
                    >
                      <td className="py-2 pr-4">{i.receivedAt}</td>
                      <td className="py-2 pr-4 font-medium">
                        {i.amount.toLocaleString()} {i.currency}
                      </td>
                      <td className="py-2 pr-4 text-slate-500">{c?.name || "—"}</td>
                      <td className="py-2 pr-4 text-slate-500">
                        {i.description || "—"}
                      </td>
                      <td className="py-2 pr-4 text-right">
                        <button
                          className="btn-ghost text-xs text-rose-600"
                          onClick={() => del(i.id)}
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
      </div>

      <Modal
        open={show}
        onClose={() => setShow(false)}
        title="Registrar pago"
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
          <div>
            <label className="label">Importe</label>
            <input
              type="number"
              step="0.01"
              className="input"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Moneda</label>
            <select
              className="input"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
          <div>
            <label className="label">Fecha</label>
            <input
              type="date"
              className="input"
              required
              value={receivedAt}
              onChange={(e) => setReceivedAt(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Cliente</label>
            <select
              className="input"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">— Ninguno —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="label">Descripción</label>
            <input
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </form>
      </Modal>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}
