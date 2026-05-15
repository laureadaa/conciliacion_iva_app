import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Language, Settings } from "@freelance/shared";
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
