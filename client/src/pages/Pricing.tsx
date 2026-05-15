import { FormEvent, useState } from "react";
import { toast } from "sonner";
import type {
  Language,
  PricingResult,
  ProjectComplexity,
} from "@pitchfork/shared";
import { api } from "../lib/api";
import PageHeader from "../components/PageHeader";
import Spinner from "../components/Spinner";

const PROJECT_TYPES = [
  { value: "landing", label: "Landing page" },
  { value: "webapp", label: "Aplicación web" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "api", label: "API / Backend" },
  { value: "mobile", label: "App móvil" },
  { value: "dashboard", label: "Dashboard / Panel" },
  { value: "consulting", label: "Consultoría" },
  { value: "maintenance", label: "Mantenimiento" },
  { value: "other", label: "Otro" },
];

const EXTRAS = [
  { value: "seo", label: "SEO básico" },
  { value: "i18n", label: "Multidioma (i18n)" },
  { value: "cms", label: "CMS" },
  { value: "auth", label: "Autenticación" },
  { value: "payments", label: "Pagos / Stripe" },
  { value: "dashboard", label: "Panel admin" },
  { value: "tests", label: "Tests automáticos" },
  { value: "cicd", label: "CI/CD" },
  { value: "analytics", label: "Analítica" },
  { value: "ai", label: "Integración IA" },
  { value: "responsive", label: "Responsive avanzado" },
  { value: "accessibility", label: "Accesibilidad" },
];

export default function Pricing() {
  const [projectType, setProjectType] = useState("webapp");
  const [complexity, setComplexity] = useState<ProjectComplexity>("medium");
  const [extras, setExtras] = useState<string[]>([]);
  const [hourlyRate, setHourlyRate] = useState("45");
  const [result, setResult] = useState<PricingResult | null>(null);
  const [loading, setLoading] = useState(false);

  const [justifying, setJustifying] = useState(false);
  const [justification, setJustification] = useState("");
  const [justifyTier, setJustifyTier] = useState<"economic" | "recommended" | "premium">(
    "recommended"
  );
  const [language, setLanguage] = useState<Language>("es");

  function toggleExtra(v: string) {
    setExtras((arr) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]));
  }

  async function onCalc(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setJustification("");
    try {
      const r = await api.post<PricingResult>("/pricing/calculate", {
        projectType,
        complexity,
        extras,
        hourlyRate: Number(hourlyRate) || undefined,
      });
      setResult(r);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function onJustify() {
    if (!result) return;
    setJustifying(true);
    try {
      const tier = result[justifyTier];
      const price = Math.round((tier.min + tier.max) / 2);
      const r = await api.post<{ content: string }>("/pricing/justify", {
        projectType,
        complexity,
        extras,
        price,
        language,
      });
      setJustification(r.content);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setJustifying(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Calculadora de precios"
        subtitle="Sugerencias inteligentes según tipo y complejidad"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <form onSubmit={onCalc} className="card lg:col-span-1 space-y-4">
          <div>
            <label className="label">Tipo de proyecto</label>
            <select
              className="input"
              value={projectType}
              onChange={(e) => setProjectType(e.target.value)}
            >
              {PROJECT_TYPES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Complejidad</label>
            <div className="grid grid-cols-3 gap-2">
              {(["basic", "medium", "advanced"] as ProjectComplexity[]).map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setComplexity(c)}
                  className={`rounded-lg border px-2 py-2 text-xs font-medium transition ${
                    complexity === c
                      ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                      : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  }`}
                >
                  {c === "basic" ? "Básico" : c === "medium" ? "Medio" : "Avanzado"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Tarifa por hora (€)</label>
            <input
              type="number"
              className="input"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Extras</label>
            <div className="flex flex-wrap gap-2">
              {EXTRAS.map((e) => {
                const on = extras.includes(e.value);
                return (
                  <button
                    type="button"
                    key={e.value}
                    onClick={() => toggleExtra(e.value)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      on
                        ? "border-brand-500 bg-brand-600 text-white"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    {e.label}
                  </button>
                );
              })}
            </div>
          </div>

          <button className="btn-primary w-full" disabled={loading}>
            {loading ? <Spinner /> : "Calcular"}
          </button>
        </form>

        <div className="lg:col-span-2 space-y-4">
          {!result ? (
            <div className="card grid h-full place-items-center text-center text-sm text-slate-500">
              <div>
                <div className="mb-2 text-3xl">💶</div>
                Ajusta los parámetros y pulsa <strong>Calcular</strong>.
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <PriceTier
                  label="Económico"
                  tone="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                  min={result.economic.min}
                  max={result.economic.max}
                  hours={result.economic.hours}
                  onJustify={() => {
                    setJustifyTier("economic");
                    onJustify();
                  }}
                />
                <PriceTier
                  label="Recomendado"
                  tone="bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                  highlight
                  min={result.recommended.min}
                  max={result.recommended.max}
                  hours={result.recommended.hours}
                  onJustify={() => {
                    setJustifyTier("recommended");
                    onJustify();
                  }}
                />
                <PriceTier
                  label="Premium"
                  tone="bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                  min={result.premium.min}
                  max={result.premium.max}
                  hours={result.premium.hours}
                  onJustify={() => {
                    setJustifyTier("premium");
                    onJustify();
                  }}
                />
              </div>

              <div className="card">
                <h3 className="mb-3 font-semibold">Desglose por horas</h3>
                <ul className="space-y-1 text-sm">
                  {result.breakdown.map((b, i) => (
                    <li key={i} className="flex justify-between border-b border-dashed border-slate-200 py-1 dark:border-slate-700">
                      <span>{b.label}</span>
                      <span className="font-medium">{b.hours}h</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="card">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="font-semibold">Justificación para el cliente</h3>
                  <div className="flex items-center gap-2">
                    <select
                      className="input max-w-[110px]"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value as Language)}
                    >
                      <option value="es">ES</option>
                      <option value="en">EN</option>
                    </select>
                    <button
                      className="btn-primary"
                      onClick={onJustify}
                      disabled={justifying}
                    >
                      {justifying ? <Spinner /> : "Generar"}
                    </button>
                  </div>
                </div>
                {justification ? (
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {justification}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    Pulsa <strong>Generar</strong> para que Claude redacte una
                    justificación del precio recomendado.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function PriceTier({
  label,
  min,
  max,
  hours,
  tone,
  highlight,
  onJustify,
}: {
  label: string;
  min: number;
  max: number;
  hours: number;
  tone: string;
  highlight?: boolean;
  onJustify: () => void;
}) {
  return (
    <div
      className={`card ${
        highlight ? "ring-2 ring-brand-500" : ""
      } flex flex-col items-start gap-2`}
    >
      <span className={`badge ${tone}`}>{label}</span>
      <div className="text-2xl font-bold">
        {min.toLocaleString()}€ – {max.toLocaleString()}€
      </div>
      <div className="text-xs text-slate-500">{hours} h estimadas</div>
      <button className="btn-ghost mt-2 text-xs" onClick={onJustify}>
        Justificar precio →
      </button>
    </div>
  );
}
