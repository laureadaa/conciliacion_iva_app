import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type {
  Client,
  Invoice,
  InvoiceItem,
  InvoiceStatus,
  Settings,
} from "@pitchfork/shared";
import { api } from "../lib/api";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import Spinner from "../components/Spinner";
import EmptyState from "../components/EmptyState";

const STATUSES: { value: InvoiceStatus; label: string; cls: string }[] = [
  { value: "draft", label: "Borrador", cls: "badge-gray" },
  { value: "sent", label: "Enviada", cls: "badge-blue" },
  { value: "paid", label: "Pagada", cls: "badge-green" },
  { value: "overdue", label: "Vencida", cls: "badge-rose" },
  { value: "cancelled", label: "Cancelada", cls: "badge-gray" },
];

const blankItem: InvoiceItem = { description: "", quantity: 1, unitPrice: 0 };

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [viewing, setViewing] = useState<Invoice | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    clientId: "" as string,
    status: "draft" as InvoiceStatus,
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: "",
    currency: "EUR",
    items: [blankItem] as InvoiceItem[],
    vatRate: 21,
    notes: "",
  });

  const pdfRef = useRef<HTMLDivElement>(null);

  function load() {
    return Promise.all([
      api.get<Invoice[]>("/invoices").then(setInvoices),
      api.get<Client[]>("/clients").then(setClients),
      api.get<Settings>("/settings").then((s) => {
        setSettings(s);
        return s;
      }),
    ]);
  }

  useEffect(() => {
    load()
      .catch((e) => toast.error(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoading(false));
  }, []);

  function openNew() {
    setEditing(null);
    setForm({
      clientId: "",
      status: "draft",
      issueDate: new Date().toISOString().slice(0, 10),
      dueDate: "",
      currency: settings?.currency || "EUR",
      items: [{ description: "", quantity: 1, unitPrice: settings?.hourlyRate || 0 }],
      vatRate: settings?.vatRate ?? 21,
      notes: "",
    });
    setShow(true);
  }

  function openEdit(inv: Invoice) {
    setEditing(inv);
    setForm({
      clientId: inv.clientId ? String(inv.clientId) : "",
      status: inv.status,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate || "",
      currency: inv.currency,
      items: inv.items.length ? inv.items : [blankItem],
      vatRate: inv.vatRate,
      notes: inv.notes || "",
    });
    setShow(true);
  }

  const totals = useMemo(() => {
    const subtotal = form.items.reduce(
      (acc, i) => acc + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0),
      0
    );
    const vat = subtotal * (form.vatRate / 100);
    return { subtotal, vat, total: subtotal + vat };
  }, [form.items, form.vatRate]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        clientId: form.clientId ? Number(form.clientId) : null,
        status: form.status,
        issueDate: form.issueDate,
        dueDate: form.dueDate || null,
        currency: form.currency,
        items: form.items.map((i) => ({
          description: i.description,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
        })),
        vatRate: Number(form.vatRate),
        notes: form.notes || null,
      };
      if (editing) {
        const saved = await api.put<Invoice>(`/invoices/${editing.id}`, payload);
        setInvoices((arr) => arr.map((x) => (x.id === saved.id ? saved : x)));
        toast.success("Factura actualizada");
      } else {
        const saved = await api.post<Invoice>("/invoices", payload);
        setInvoices((arr) => [saved, ...arr]);
        toast.success(`Factura ${saved.number} creada`);
      }
      setShow(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function del(id: number) {
    if (!confirm("¿Eliminar factura?")) return;
    try {
      await api.del(`/invoices/${id}`);
      setInvoices((arr) => arr.filter((i) => i.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  }

  async function markPaid(inv: Invoice) {
    try {
      const saved = await api.put<Invoice>(`/invoices/${inv.id}`, {
        clientId: inv.clientId,
        status: "paid" as InvoiceStatus,
        issueDate: inv.issueDate,
        dueDate: inv.dueDate,
        currency: inv.currency,
        items: inv.items,
        vatRate: inv.vatRate,
        notes: inv.notes,
      });
      setInvoices((arr) => arr.map((x) => (x.id === saved.id ? saved : x)));
      toast.success("Marcada como pagada — ingreso registrado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  }

  async function exportPdf() {
    if (!pdfRef.current || !viewing) return;
    const mod = await import("html2pdf.js");
    const html2pdf = (mod as unknown as { default: () => { set: (o: object) => any } }).default;
    await html2pdf()
      .set({
        margin: 12,
        filename: `${viewing.number}.pdf`,
        html2canvas: { scale: 2 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(pdfRef.current)
      .save();
  }

  function clientName(id: number | null) {
    if (!id) return "—";
    return clients.find((c) => c.id === id)?.name || "—";
  }

  return (
    <>
      <PageHeader
        title="Facturas"
        subtitle="Numeración automática, IVA, PDF y registro de ingreso al cobrar"
        actions={
          <button className="btn-primary" onClick={openNew}>
            + Nueva factura
          </button>
        }
      />

      {!settings?.fullName && !settings?.businessName && (
        <div className="card mb-4 border-amber-300 bg-amber-50 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
          ⚠️ Aún no has completado tus datos en <strong>Ajustes</strong>. Las facturas
          PDF saldrán sin tu nombre/IBAN. Edita en <a className="underline" href="/settings">/settings</a>.
        </div>
      )}

      {loading ? (
        <div className="grid h-64 place-items-center">
          <Spinner size={28} />
        </div>
      ) : invoices.length === 0 ? (
        <EmptyState
          icon="🧾"
          title="Sin facturas"
          description="Crea tu primera factura: la numeración y el IVA salen solos."
          action={
            <button className="btn-primary" onClick={openNew}>
              Crear factura
            </button>
          }
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-500">
                <th className="py-2 pr-4">Número</th>
                <th className="py-2 pr-4">Fecha</th>
                <th className="py-2 pr-4">Cliente</th>
                <th className="py-2 pr-4">Total</th>
                <th className="py-2 pr-4">Estado</th>
                <th className="py-2 pr-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const s = STATUSES.find((x) => x.value === inv.status);
                return (
                  <tr
                    key={inv.id}
                    className="border-t border-slate-100 dark:border-slate-800"
                  >
                    <td className="py-2 pr-4 font-mono font-medium">{inv.number}</td>
                    <td className="py-2 pr-4">{inv.issueDate}</td>
                    <td className="py-2 pr-4">{clientName(inv.clientId)}</td>
                    <td className="py-2 pr-4 font-medium">
                      {inv.total.toLocaleString()} {inv.currency}
                    </td>
                    <td className="py-2 pr-4">
                      <span className={s?.cls}>{s?.label}</span>
                    </td>
                    <td className="py-2 pr-4 text-right">
                      <button className="btn-ghost text-xs" onClick={() => setViewing(inv)}>
                        Ver / PDF
                      </button>
                      <button className="btn-ghost text-xs" onClick={() => openEdit(inv)}>
                        Editar
                      </button>
                      {inv.status !== "paid" && (
                        <button
                          className="btn-ghost text-xs text-emerald-600"
                          onClick={() => markPaid(inv)}
                        >
                          Cobrar
                        </button>
                      )}
                      <button
                        className="btn-ghost text-xs text-rose-600"
                        onClick={() => del(inv.id)}
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

      {/* Create / edit modal */}
      <Modal
        open={show}
        onClose={() => setShow(false)}
        title={editing ? `Editar factura ${editing.number}` : "Nueva factura"}
        maxWidth="max-w-4xl"
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
        <form className="space-y-4" onSubmit={onSave}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <label className="label">Cliente</label>
              <select
                className="input"
                value={form.clientId}
                onChange={(e) => setForm({ ...form, clientId: e.target.value })}
              >
                <option value="">— Sin cliente —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.company ? `(${c.company})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Estado</label>
              <select
                className="input"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as InvoiceStatus })}
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Moneda</label>
              <select
                className="input"
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
              >
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
            <div>
              <label className="label">Fecha emisión</label>
              <input
                type="date"
                className="input"
                value={form.issueDate}
                onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Vencimiento</label>
              <input
                type="date"
                className="input"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </div>
            <div>
              <label className="label">IVA (%)</label>
              <input
                type="number"
                step="0.1"
                className="input"
                value={form.vatRate}
                onChange={(e) => setForm({ ...form, vatRate: Number(e.target.value) })}
              />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">Conceptos</span>
              <button
                type="button"
                className="btn-ghost text-xs"
                onClick={() => setForm({ ...form, items: [...form.items, { ...blankItem }] })}
              >
                + Añadir línea
              </button>
            </div>
            <div className="space-y-2">
              {form.items.map((it, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 gap-2 rounded-lg border border-slate-200 p-2 dark:border-slate-700"
                >
                  <input
                    className="input col-span-6"
                    placeholder="Descripción"
                    value={it.description}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        items: form.items.map((x, i) =>
                          i === idx ? { ...x, description: e.target.value } : x
                        ),
                      })
                    }
                    required
                  />
                  <input
                    type="number"
                    step="0.01"
                    className="input col-span-2"
                    placeholder="Cant."
                    value={it.quantity}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        items: form.items.map((x, i) =>
                          i === idx ? { ...x, quantity: Number(e.target.value) } : x
                        ),
                      })
                    }
                  />
                  <input
                    type="number"
                    step="0.01"
                    className="input col-span-3"
                    placeholder="Precio unidad"
                    value={it.unitPrice}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        items: form.items.map((x, i) =>
                          i === idx ? { ...x, unitPrice: Number(e.target.value) } : x
                        ),
                      })
                    }
                  />
                  <button
                    type="button"
                    className="btn-ghost col-span-1 text-rose-600"
                    onClick={() =>
                      setForm({
                        ...form,
                        items: form.items.filter((_, i) => i !== idx).length
                          ? form.items.filter((_, i) => i !== idx)
                          : [blankItem],
                      })
                    }
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800">
            <div>
              <div className="text-xs text-slate-500">Subtotal</div>
              <div className="font-semibold">
                {totals.subtotal.toFixed(2)} {form.currency}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">IVA ({form.vatRate}%)</div>
              <div className="font-semibold">
                {totals.vat.toFixed(2)} {form.currency}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Total</div>
              <div className="text-lg font-bold">
                {totals.total.toFixed(2)} {form.currency}
              </div>
            </div>
          </div>

          <div>
            <label className="label">Notas (opcional)</label>
            <textarea
              className="input min-h-[60px]"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Forma de pago, IBAN, condiciones..."
            />
          </div>
        </form>
      </Modal>

      {/* View / PDF modal */}
      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing?.number || "Factura"}
        maxWidth="max-w-3xl"
        footer={
          viewing && (
            <>
              <button className="btn-secondary" onClick={exportPdf}>
                Descargar PDF
              </button>
              <button className="btn-ghost" onClick={() => setViewing(null)}>
                Cerrar
              </button>
            </>
          )
        }
      >
        {viewing && settings && (
          <div ref={pdfRef} className="bg-white p-6 text-slate-900">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <div className="text-lg font-bold">
                  {settings.businessName || settings.fullName || "—"}
                </div>
                {settings.fullName && settings.businessName && (
                  <div className="text-sm">{settings.fullName}</div>
                )}
                {settings.taxId && <div className="text-sm">NIF/CIF: {settings.taxId}</div>}
                {settings.address && <div className="text-sm">{settings.address}</div>}
                {settings.email && <div className="text-sm">{settings.email}</div>}
                {settings.phone && <div className="text-sm">{settings.phone}</div>}
                {settings.website && <div className="text-sm">{settings.website}</div>}
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">FACTURA</div>
                <div className="font-mono">{viewing.number}</div>
                <div className="mt-2 text-sm">Fecha: {viewing.issueDate}</div>
                {viewing.dueDate && (
                  <div className="text-sm">Vencimiento: {viewing.dueDate}</div>
                )}
              </div>
            </div>

            <div className="mb-6 rounded border border-slate-200 p-3 text-sm">
              <div className="font-semibold">Facturar a:</div>
              <div>{clientName(viewing.clientId)}</div>
              {(() => {
                const c = clients.find((x) => x.id === viewing.clientId);
                return c ? (
                  <>
                    {c.company && <div>{c.company}</div>}
                    {c.email && <div>{c.email}</div>}
                  </>
                ) : null;
              })()}
            </div>

            <table className="mb-6 w-full text-sm">
              <thead>
                <tr className="border-b-2 border-slate-300 text-left">
                  <th className="py-2">Descripción</th>
                  <th className="py-2 text-right">Cant.</th>
                  <th className="py-2 text-right">Precio</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {viewing.items.map((it, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-2">{it.description}</td>
                    <td className="py-2 text-right">{it.quantity}</td>
                    <td className="py-2 text-right">
                      {it.unitPrice.toFixed(2)} {viewing.currency}
                    </td>
                    <td className="py-2 text-right">
                      {(it.quantity * it.unitPrice).toFixed(2)} {viewing.currency}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="ml-auto w-64 text-sm">
              <div className="flex justify-between py-1">
                <span>Subtotal</span>
                <span>
                  {viewing.subtotal.toFixed(2)} {viewing.currency}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span>IVA ({viewing.vatRate}%)</span>
                <span>
                  {viewing.vatAmount.toFixed(2)} {viewing.currency}
                </span>
              </div>
              <div className="flex justify-between border-t-2 border-slate-300 py-2 text-base font-bold">
                <span>Total</span>
                <span>
                  {viewing.total.toFixed(2)} {viewing.currency}
                </span>
              </div>
            </div>

            {settings.iban && (
              <div className="mt-6 rounded bg-slate-50 p-3 text-sm">
                <span className="font-semibold">Pago por transferencia:</span>{" "}
                <span className="font-mono">{settings.iban}</span>
              </div>
            )}
            {viewing.notes && (
              <div className="mt-4 whitespace-pre-wrap text-sm text-slate-600">
                {viewing.notes}
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
