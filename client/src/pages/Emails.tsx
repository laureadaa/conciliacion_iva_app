import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import type { EmailRecord, EmailType, Language } from "@pitchfork/shared";
import { api } from "../lib/api";
import PageHeader from "../components/PageHeader";
import Spinner from "../components/Spinner";
import EmptyState from "../components/EmptyState";

const TYPES: { value: EmailType; label: string; icon: string }[] = [
  { value: "first_contact", label: "Primer contacto", icon: "👋" },
  { value: "follow_up", label: "Seguimiento", icon: "🔁" },
  { value: "delivery", label: "Entrega", icon: "📦" },
  { value: "review_request", label: "Pedir reseña", icon: "⭐" },
  { value: "payment_reminder", label: "Recordatorio de pago", icon: "💳" },
];

export default function Emails() {
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const [type, setType] = useState<EmailType>("first_contact");
  const [clientName, setClientName] = useState("");
  const [context, setContext] = useState("");
  const [language, setLanguage] = useState<Language>("es");

  function load() {
    return api.get<EmailRecord[]>("/emails").then(setEmails);
  }

  useEffect(() => {
    load()
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function onGen(e: FormEvent) {
    e.preventDefault();
    setGenerating(true);
    try {
      await api.post<EmailRecord>("/emails/generate", {
        type,
        clientName,
        context,
        language,
      });
      toast.success("Email generado");
      setContext("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setGenerating(false);
    }
  }

  async function del(id: number) {
    if (!confirm("¿Eliminar email?")) return;
    try {
      await api.del(`/emails/${id}`);
      setEmails((arr) => arr.filter((m) => m.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  }

  function typeLabel(t: EmailType) {
    return TYPES.find((x) => x.value === t)?.label || t;
  }

  return (
    <>
      <PageHeader
        title="Generador de emails"
        subtitle="Plantillas profesionales redactadas por Claude"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <form onSubmit={onGen} className="card lg:col-span-1 space-y-4">
          <div>
            <label className="label">Tipo de email</label>
            <div className="grid grid-cols-1 gap-2">
              {TYPES.map((t) => (
                <button
                  type="button"
                  key={t.value}
                  onClick={() => setType(t.value)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${
                    type === t.value
                      ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                      : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  }`}
                >
                  <span>{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Cliente</label>
            <input
              className="input"
              required
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Contexto</label>
            <textarea
              className="input min-h-[100px]"
              required
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Detalles relevantes para el email..."
            />
          </div>
          <div>
            <label className="label">Idioma</label>
            <select
              className="input"
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
            >
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </div>
          <button className="btn-primary w-full" disabled={generating}>
            {generating ? <Spinner /> : "Generar email"}
          </button>
        </form>

        <div className="lg:col-span-2 space-y-3">
          {loading ? (
            <div className="grid h-64 place-items-center">
              <Spinner size={28} />
            </div>
          ) : emails.length === 0 ? (
            <EmptyState
              icon="✉️"
              title="Sin emails generados"
              description="Elige un tipo, añade contexto y deja que Claude redacte."
            />
          ) : (
            emails.map((m) => (
              <div key={m.id} className="card">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs uppercase text-slate-500">
                      {typeLabel(m.type)} · {m.clientName} · {m.language.toUpperCase()}
                    </div>
                    <h3 className="font-semibold">{m.subject}</h3>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="btn-ghost text-xs"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `Asunto: ${m.subject}\n\n${m.body}`
                        );
                        toast.success("Copiado");
                      }}
                    >
                      Copiar
                    </button>
                    <button
                      className="btn-ghost text-xs text-rose-600"
                      onClick={() => del(m.id)}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {m.body}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
