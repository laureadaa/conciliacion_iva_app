import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Language, Settings } from "@pitchfork/shared";
import { api } from "../lib/api";
import PageHeader from "../components/PageHeader";
import Spinner from "../components/Spinner";

export default function SettingsPage() {
  const [data, setData] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<Settings>("/settings")
      .then(setData)
      .catch((e) => toast.error(e.message));
  }, []);

  function set<K extends keyof Settings>(k: K, v: Settings[K]) {
    if (!data) return;
    setData({ ...data, [k]: v });
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!data) return;
    setSaving(true);
    try {
      const saved = await api.put<Settings>("/settings", {
        businessName: data.businessName || null,
        fullName: data.fullName || null,
        taxId: data.taxId || null,
        address: data.address || null,
        email: data.email || null,
        phone: data.phone || null,
        website: data.website || null,
        iban: data.iban || null,
        hourlyRate: Number(data.hourlyRate),
        currency: data.currency,
        defaultLanguage: data.defaultLanguage,
        signature: data.signature || null,
        vatRate: Number(data.vatRate),
        invoicePrefix: data.invoicePrefix,
        nextInvoiceNumber: Number(data.nextInvoiceNumber),
        smtpUser: data.smtpUser || null,
        smtpAppPassword: data.smtpAppPassword || null,
        smtpFromName: data.smtpFromName || null,
        smtpDailyLimit: Number(data.smtpDailyLimit) || 30,
      });
      setData(saved);
      toast.success("Ajustes guardados");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  if (!data) {
    return (
      <div className="grid h-64 place-items-center">
        <Spinner size={28} />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Ajustes"
        subtitle="Tus datos se usan automáticamente en propuestas, emails y facturas"
      />

      <form onSubmit={onSave} className="space-y-6">
        <section className="card">
          <h3 className="mb-4 text-base font-semibold">Datos profesionales</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Nombre completo">
              <input
                className="input"
                value={data.fullName || ""}
                onChange={(e) => set("fullName", e.target.value)}
                placeholder="Laura Garcia"
              />
            </Field>
            <Field label="Nombre comercial / empresa">
              <input
                className="input"
                value={data.businessName || ""}
                onChange={(e) => set("businessName", e.target.value)}
              />
            </Field>
            <Field label="NIF / CIF">
              <input
                className="input"
                value={data.taxId || ""}
                onChange={(e) => set("taxId", e.target.value)}
              />
            </Field>
            <Field label="Email profesional">
              <input
                type="email"
                className="input"
                value={data.email || ""}
                onChange={(e) => set("email", e.target.value)}
              />
            </Field>
            <Field label="Teléfono">
              <input
                className="input"
                value={data.phone || ""}
                onChange={(e) => set("phone", e.target.value)}
              />
            </Field>
            <Field label="Web / portfolio">
              <input
                className="input"
                value={data.website || ""}
                onChange={(e) => set("website", e.target.value)}
                placeholder="https://"
              />
            </Field>
            <Field label="Dirección" className="md:col-span-2">
              <input
                className="input"
                value={data.address || ""}
                onChange={(e) => set("address", e.target.value)}
              />
            </Field>
            <Field label="IBAN" className="md:col-span-2">
              <input
                className="input font-mono"
                value={data.iban || ""}
                onChange={(e) => set("iban", e.target.value)}
                placeholder="ES00 0000 0000 0000 0000 0000"
              />
            </Field>
          </div>
        </section>

        <section className="card">
          <h3 className="mb-4 text-base font-semibold">Tarifas y facturación</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Field label="Tarifa por hora">
              <input
                type="number"
                step="0.01"
                className="input"
                value={data.hourlyRate}
                onChange={(e) => set("hourlyRate", Number(e.target.value))}
              />
            </Field>
            <Field label="Moneda">
              <select
                className="input"
                value={data.currency}
                onChange={(e) => set("currency", e.target.value)}
              >
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
              </select>
            </Field>
            <Field label="IVA (%)">
              <input
                type="number"
                step="0.1"
                className="input"
                value={data.vatRate}
                onChange={(e) => set("vatRate", Number(e.target.value))}
              />
            </Field>
            <Field label="Idioma por defecto">
              <select
                className="input"
                value={data.defaultLanguage}
                onChange={(e) => set("defaultLanguage", e.target.value as Language)}
              >
                <option value="es">Español</option>
                <option value="en">English</option>
              </select>
            </Field>
            <Field label="Prefijo factura">
              <input
                className="input"
                value={data.invoicePrefix}
                onChange={(e) => set("invoicePrefix", e.target.value)}
              />
            </Field>
            <Field label="Próximo nº factura">
              <input
                type="number"
                className="input"
                value={data.nextInvoiceNumber}
                onChange={(e) => set("nextInvoiceNumber", Number(e.target.value))}
              />
            </Field>
          </div>
        </section>

        <section className="card">
          <h3 className="mb-4 text-base font-semibold">Firma de email / propuestas</h3>
          <textarea
            className="input min-h-[140px]"
            value={data.signature || ""}
            onChange={(e) => set("signature", e.target.value)}
            placeholder={"Un saludo,\nLaura Garcia\nlaurafreelance.com"}
          />
          <p className="mt-2 text-xs text-slate-500">
            Si la dejas vacía, se generará una firma automática con tu nombre y web.
          </p>
        </section>

        <section className="card">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold">Email (Gmail SMTP)</h3>
            <a
              className="text-xs text-brand-600 hover:underline"
              href="https://myaccount.google.com/apppasswords"
              target="_blank"
              rel="noreferrer"
            >
              Crear App password →
            </a>
          </div>
          <p className="mb-4 text-xs text-slate-500">
            Para enviar emails de outreach desde tu Gmail. Necesitas activar la
            verificación en 2 pasos y generar una <strong>App password</strong> (16
            caracteres). Tu contraseña normal no funciona y nunca se almacena.
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Tu Gmail">
              <input
                type="email"
                className="input"
                value={data.smtpUser || ""}
                onChange={(e) => set("smtpUser", e.target.value)}
                placeholder="tucorreo@gmail.com"
                autoComplete="off"
              />
            </Field>
            <Field label="App password (16 caracteres)">
              <input
                type="password"
                className="input font-mono"
                value={data.smtpAppPassword || ""}
                onChange={(e) => set("smtpAppPassword", e.target.value)}
                placeholder="abcd efgh ijkl mnop"
                autoComplete="new-password"
              />
            </Field>
            <Field label="Nombre del remitente (opcional)">
              <input
                className="input"
                value={data.smtpFromName || ""}
                onChange={(e) => set("smtpFromName", e.target.value)}
                placeholder="Laura García"
              />
            </Field>
            <Field label="Límite envíos/día">
              <input
                type="number"
                min={1}
                max={500}
                className="input"
                value={data.smtpDailyLimit}
                onChange={(e) =>
                  set("smtpDailyLimit", Number(e.target.value) || 30)
                }
              />
            </Field>
          </div>
          <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
            ⚠️ Gmail personal bloquea cuentas si se envían más de 100/día seguidos
            de manera automatizada. Mantén el límite a 30 para empezar.
          </p>
        </section>

        <div className="flex justify-end">
          <button className="btn-primary" disabled={saving}>
            {saving ? <Spinner /> : "Guardar ajustes"}
          </button>
        </div>
      </form>
    </>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
