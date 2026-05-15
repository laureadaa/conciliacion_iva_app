import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { OutboxEmail, Settings } from "@pitchfork/shared";
import { api } from "../lib/api";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import Spinner from "../components/Spinner";
import EmptyState from "../components/EmptyState";

const STATUS_CLS: Record<string, string> = {
  pending: "badge-yellow",
  sending: "badge-blue",
  sent: "badge-green",
  failed: "badge-rose",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  sending: "Enviando",
  sent: "Enviada",
  failed: "Falló",
};

export default function OutboxPage() {
  const [items, setItems] = useState<OutboxEmail[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [viewing, setViewing] = useState<OutboxEmail | null>(null);

  function load() {
    return Promise.all([
      api.get<OutboxEmail[]>("/outbox").then(setItems),
      api.get<Settings>("/settings").then(setSettings),
    ]);
  }

  useEffect(() => {
    load()
      .catch((e) => toast.error(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoading(false));
  }, []);

  const smtpConfigured = !!(
    settings?.smtpUser && settings?.smtpAppPassword
  );

  const pending = useMemo(() => items.filter((m) => m.status === "pending"), [items]);
  const sentToday = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return items.filter((m) => m.status === "sent" && m.sentAt?.startsWith(today)).length;
  }, [items]);
  const remainingToday = settings ? settings.smtpDailyLimit - sentToday : 0;

  function toggle(id: number) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllPending() {
    setSelected(new Set(pending.map((m) => m.id)));
  }

  async function sendSelected() {
    if (selected.size === 0) {
      toast.error("Selecciona al menos un email");
      return;
    }
    if (!confirm(`¿Enviar ${selected.size} email(s) ahora?`)) return;
    setSending(true);
    try {
      const r = await api.post<{ sent: number; failed: number; skippedByLimit: number }>(
        "/outbox/send",
        { ids: Array.from(selected) }
      );
      toast.success(
        `Enviados: ${r.sent} · Fallidos: ${r.failed}` +
          (r.skippedByLimit ? ` · Saltados por límite: ${r.skippedByLimit}` : "")
      );
      setSelected(new Set());
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al enviar");
    } finally {
      setSending(false);
    }
  }

  async function del(id: number) {
    if (!confirm("¿Eliminar de la cola?")) return;
    try {
      await api.del(`/outbox/${id}`);
      setItems((arr) => arr.filter((m) => m.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  }

  return (
    <>
      <PageHeader
        title="Outbox"
        subtitle="Revisa, edita y envía los emails de outreach"
        actions={
          <>
            <button className="btn-secondary" onClick={selectAllPending}>
              Seleccionar pendientes
            </button>
            <button
              className="btn-primary"
              onClick={sendSelected}
              disabled={sending || !smtpConfigured || selected.size === 0}
            >
              {sending ? <Spinner /> : `Enviar (${selected.size})`}
            </button>
          </>
        }
      />

      {!smtpConfigured && (
        <div className="card mb-4 border-amber-300 bg-amber-50 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
          ⚠️ SMTP no configurado. Ve a{" "}
          <a className="underline" href="/settings">
            Ajustes → Email (Gmail SMTP)
          </a>{" "}
          y añade tu usuario Gmail + App password.
        </div>
      )}

      {smtpConfigured && settings && (
        <div className="card mb-4 flex items-center justify-between text-sm">
          <div>
            <strong>Hoy:</strong> enviados {sentToday} / {settings.smtpDailyLimit} ·{" "}
            quedan <strong>{remainingToday}</strong> envíos.
          </div>
          <div className="text-xs text-slate-500">
            From: {settings.smtpUser}
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid h-64 place-items-center">
          <Spinner size={28} />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon="📤"
          title="Outbox vacío"
          description="Ve a Leads → 'Encolar outreach' para preparar emails listos para enviar."
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-500">
                <th className="py-2 pr-2 w-8">
                  <input
                    type="checkbox"
                    checked={selected.size === pending.length && pending.length > 0}
                    onChange={(e) =>
                      e.target.checked ? selectAllPending() : setSelected(new Set())
                    }
                  />
                </th>
                <th className="py-2 pr-4">Para</th>
                <th className="py-2 pr-4">Asunto</th>
                <th className="py-2 pr-4">Estado</th>
                <th className="py-2 pr-4">Cuándo</th>
                <th className="py-2 pr-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="py-2 pr-2">
                    <input
                      type="checkbox"
                      disabled={m.status !== "pending"}
                      checked={selected.has(m.id)}
                      onChange={() => toggle(m.id)}
                    />
                  </td>
                  <td className="py-2 pr-4">
                    <div className="font-medium">{m.recipientName || "—"}</div>
                    <div className="text-xs text-slate-500">{m.recipient}</div>
                  </td>
                  <td className="py-2 pr-4 max-w-[300px] truncate">{m.subject}</td>
                  <td className="py-2 pr-4">
                    <span className={STATUS_CLS[m.status] || "badge-gray"}>
                      {STATUS_LABEL[m.status] || m.status}
                    </span>
                    {m.errorMessage && (
                      <div className="mt-1 max-w-[260px] truncate text-xs text-rose-500">
                        {m.errorMessage}
                      </div>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-xs text-slate-500">
                    {m.sentAt
                      ? new Date(m.sentAt).toLocaleString()
                      : new Date(m.createdAt).toLocaleString()}
                  </td>
                  <td className="py-2 pr-4 text-right">
                    <button className="btn-ghost text-xs" onClick={() => setViewing(m)}>
                      Ver
                    </button>
                    <button
                      className="btn-ghost text-xs text-rose-600"
                      onClick={() => del(m.id)}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing?.subject || ""}
        maxWidth="max-w-3xl"
      >
        {viewing && (
          <div className="space-y-3 text-sm">
            <div>
              <strong>Para:</strong> {viewing.recipient}
              {viewing.recipientName && ` (${viewing.recipientName})`}
            </div>
            <div>
              <strong>Asunto:</strong> {viewing.subject}
            </div>
            <hr className="border-slate-200 dark:border-slate-700" />
            <pre className="whitespace-pre-wrap font-sans">{viewing.body}</pre>
            {viewing.errorMessage && (
              <div className="rounded border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700 dark:border-rose-700 dark:bg-rose-900/30 dark:text-rose-200">
                {viewing.errorMessage}
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
