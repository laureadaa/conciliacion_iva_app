import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import type {
  Portfolio,
  PortfolioCaseStudy,
  PortfolioFaq,
  PortfolioProcessStep,
  PortfolioService,
  PortfolioStat,
  PortfolioTestimonial,
  PortfolioValueProp,
} from "@pitchfork/shared";
import { api } from "../lib/api";
import PageHeader from "../components/PageHeader";
import Spinner from "../components/Spinner";

function rid(): string {
  return Math.random().toString(36).slice(2, 10);
}

const emptyService = (): PortfolioService => ({
  id: rid(),
  title: "",
  description: "",
  price: "",
  duration: "",
  bullets: [],
  featured: false,
});

const emptyCase = (): PortfolioCaseStudy => ({
  id: rid(),
  title: "",
  description: "",
  url: "",
  tags: [],
  imageUrl: null,
  metric: null,
  metricLabel: null,
});

const emptyTestimonial = (): PortfolioTestimonial => ({
  id: rid(),
  quote: "",
  name: "",
  role: "",
  company: "",
  avatarUrl: null,
});

const emptyStep = (): PortfolioProcessStep => ({
  id: rid(),
  title: "",
  description: "",
});

const emptyFaq = (): PortfolioFaq => ({
  id: rid(),
  question: "",
  answer: "",
});

const emptyStat = (): PortfolioStat => ({
  id: rid(),
  value: "",
  label: "",
});

const emptyValueProp = (): PortfolioValueProp => ({
  id: rid(),
  icon: "",
  title: "",
  description: "",
});

const SUGGESTED_VALUE_PROPS: PortfolioValueProp[] = [
  {
    id: "vp1",
    icon: "⏱",
    title: "Entrega en plazo o no cobro",
    description:
      "Si me retraso más de una semana sobre lo prometido, te descuento el 50%. Sin letra pequeña.",
  },
  {
    id: "vp2",
    icon: "🤝",
    title: "Trato directo, sin agencia",
    description:
      "Hablas conmigo. No con un comercial que te pasa con un PM que te pasa con un dev.",
  },
  {
    id: "vp3",
    icon: "🔑",
    title: "El código es tuyo",
    description:
      "Repo a tu nombre, documentación incluida. Si un día quieres irte, te vas sin ataduras.",
  },
];

const SUGGESTED_FAQS: PortfolioFaq[] = [
  {
    id: "f1",
    question: "¿Y si no me gusta el resultado?",
    answer:
      "Trabajamos en sprints cortos con revisiones cada semana. Si en cualquier punto crees que no vamos bien, paramos y resolvemos. Yo prefiero gastar 30 minutos de ajuste a entregarte algo que no usarás.",
  },
  {
    id: "f2",
    question: "¿Qué pasa después de la entrega?",
    answer:
      "Incluyo 30 días de soporte post-entrega para retoques y dudas. Después puedes contratar mantenimiento mensual o irte sin compromiso — el código y la documentación quedan en tu lado.",
  },
  {
    id: "f3",
    question: "¿Cómo se factura?",
    answer:
      "50% al firmar el presupuesto y empezar. 50% al entregar. Factura con IVA, sin sorpresas. Aceptamos transferencia o Bizum.",
  },
  {
    id: "f4",
    question: "¿Trabajas también con empresas más grandes?",
    answer:
      "Mi fuerte son negocios pequeños y medianos que necesitan moverse rápido. Para empresas grandes con varios equipos no soy la mejor opción — y prefiero decírtelo a aceptar y entregar mal.",
  },
];

const SUGGESTED_STEPS: PortfolioProcessStep[] = [
  {
    id: "p1",
    title: "Llamada de descubrimiento",
    description:
      "20-30 minutos. Me cuentas el problema; te digo si puedo resolverlo y cómo. Sin compromiso ni venta agresiva.",
  },
  {
    id: "p2",
    title: "Presupuesto cerrado",
    description:
      "En 24-48h te paso un presupuesto fijo con alcance, plazos e hitos. No hay sorpresas: lo que firmamos es lo que pagas.",
  },
  {
    id: "p3",
    title: "Desarrollo en sprints",
    description:
      "Entregas semanales. Tú das feedback en cada sprint. Si algo cambia de prioridad, lo ajustamos antes de que cueste rehacer.",
  },
  {
    id: "p4",
    title: "Entrega + soporte",
    description:
      "Despliegue en tu dominio, documentación de uso, y 30 días de soporte post-entrega. Después decides si seguimos con mantenimiento.",
  },
];

export default function PortfolioEditor() {
  const [p, setP] = useState<Portfolio | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    return api.get<Portfolio>("/portfolio/me").then(setP);
  }

  useEffect(() => {
    load().catch((e) => toast.error(e instanceof Error ? e.message : "Error"));
  }, []);

  function update<K extends keyof Portfolio>(key: K, value: Portfolio[K]) {
    if (!p) return;
    setP({ ...p, [key]: value });
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!p) return;
    setSaving(true);
    try {
      const saved = await api.put<Portfolio>("/portfolio/me", {
        slug: p.slug,
        displayName: p.displayName,
        headline: p.headline,
        tagline: p.tagline,
        bio: p.bio,
        services: p.services,
        caseStudies: p.caseStudies,
        testimonials: p.testimonials,
        processSteps: p.processSteps,
        faqs: p.faqs,
        stats: p.stats,
        valueProps: p.valueProps,
        availability: p.availability,
        responseTime: p.responseTime,
        socials: p.socials,
        accentColor: p.accentColor,
        theme: p.theme,
        photoUrl: p.photoUrl,
        contactEmail: p.contactEmail,
        technologies: p.technologies,
        published: p.published,
      });
      setP(saved);
      toast.success("Portfolio guardado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error guardando");
    } finally {
      setSaving(false);
    }
  }

  if (!p) {
    return (
      <div className="grid h-64 place-items-center">
        <Spinner size={28} />
      </div>
    );
  }

  const publicUrl = `${window.location.origin}/p/${p.slug}`;

  return (
    <>
      <PageHeader
        title="Portfolio público"
        subtitle="Cada sección suma confianza. Cuanto más rellenes, mejor cierre."
        actions={
          <>
            <a className="btn-secondary" href={publicUrl} target="_blank" rel="noreferrer">
              Ver →
            </a>
            <button
              className="btn-primary"
              onClick={(e) => onSave(e as unknown as FormEvent)}
              disabled={saving}
            >
              {saving ? <Spinner /> : "Guardar"}
            </button>
          </>
        }
      />

      <form onSubmit={onSave} className="space-y-6">
        {/* Publish + URL */}
        <section className="card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={p.published}
                onChange={(e) => update("published", e.target.checked)}
                className="h-4 w-4"
              />
              <span className="font-medium">
                Portfolio publicado
                <span className="ml-2 text-xs text-slate-500">
                  (visible para cualquiera con tu URL)
                </span>
              </span>
            </label>
            <div className="flex min-w-[200px] flex-1 items-center gap-2">
              <span className="text-xs text-slate-500">URL pública:</span>
              <code className="rounded bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">
                {publicUrl}
              </code>
              <button
                type="button"
                className="btn-ghost text-xs"
                onClick={() => {
                  navigator.clipboard.writeText(publicUrl);
                  toast.success("URL copiada");
                }}
              >
                Copiar
              </button>
            </div>
          </div>
        </section>

        {/* Identidad */}
        <section className="card space-y-4">
          <h3 className="text-base font-semibold">Identidad</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Slug (URL)">
              <input
                className="input font-mono"
                value={p.slug}
                onChange={(e) =>
                  update(
                    "slug",
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]/g, "-")
                      .replace(/-+/g, "-")
                  )
                }
              />
            </Field>
            <Field label="Nombre a mostrar">
              <input
                className="input"
                value={p.displayName || ""}
                onChange={(e) => update("displayName", e.target.value)}
              />
            </Field>
            <Field label="Headline corto">
              <input
                className="input"
                value={p.headline || ""}
                onChange={(e) => update("headline", e.target.value)}
                placeholder="Desarrolladora freelance · Córdoba"
              />
            </Field>
            <Field label="Email de contacto">
              <input
                type="email"
                className="input"
                value={p.contactEmail || ""}
                onChange={(e) => update("contactEmail", e.target.value)}
              />
            </Field>
            <Field label="URL de tu foto (opcional)">
              <input
                className="input"
                value={p.photoUrl || ""}
                onChange={(e) => update("photoUrl", e.target.value || null)}
                placeholder="https://..."
              />
            </Field>
            <Field label="Tema visual del portfolio">
              <select
                className="input"
                value={p.theme}
                onChange={(e) => update("theme", e.target.value as "light" | "dark")}
              >
                <option value="light">Claro (recomendado)</option>
                <option value="dark">Oscuro</option>
              </select>
            </Field>
            <Field label="Color de acento" className="md:col-span-2">
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  className="h-10 w-16 cursor-pointer rounded border border-slate-200 dark:border-slate-700"
                  value={p.accentColor}
                  onChange={(e) => update("accentColor", e.target.value)}
                />
                <input
                  className="input font-mono"
                  value={p.accentColor}
                  onChange={(e) => update("accentColor", e.target.value)}
                />
                <div className="flex gap-1">
                  {["#7c3aed", "#0891b2", "#059669", "#dc2626", "#ea580c", "#0f172a", "#db2777", "#facc15"].map(
                    (c) => (
                      <button
                        type="button"
                        key={c}
                        onClick={() => update("accentColor", c)}
                        className="h-8 w-8 rounded border border-slate-300 dark:border-slate-600"
                        style={{ backgroundColor: c }}
                      />
                    )
                  )}
                </div>
              </div>
            </Field>
          </div>
        </section>

        {/* Pitch */}
        <section className="card space-y-4">
          <h3 className="text-base font-semibold">Pitch principal</h3>
          <Field label="Tagline (la frase grande del hero — máx 200 chars)">
            <textarea
              className="input min-h-[80px]"
              value={p.tagline}
              onChange={(e) => update("tagline", e.target.value)}
              maxLength={200}
              placeholder="Monto sistemas a medida para pequeños negocios. Reservas, portales de cliente, automatizaciones."
            />
            <div className="mt-1 text-right text-xs text-slate-500">
              {p.tagline.length}/200
            </div>
          </Field>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Disponibilidad (pill animada del hero)">
              <input
                className="input"
                value={p.availability || ""}
                onChange={(e) => update("availability", e.target.value)}
                placeholder="Disponible para 1 proyecto en junio 2026"
              />
            </Field>
            <Field label="Tiempo de respuesta">
              <input
                className="input"
                value={p.responseTime || ""}
                onChange={(e) => update("responseTime", e.target.value)}
                placeholder="Respondo en menos de 48h"
              />
            </Field>
          </div>
          <Field label="Bio (sección 'Sobre mí')">
            <textarea
              className="input min-h-[160px]"
              value={p.bio || ""}
              onChange={(e) => update("bio", e.target.value)}
              placeholder="Soy desarrolladora freelance enfocada en producto digital..."
            />
          </Field>
        </section>

        {/* Stats */}
        <ListSection
          title="Métricas (barra de números bajo el hero)"
          hint="Números fríos suben mucho la confianza. Ej: '12+' proyectos · '5.0★' valoración · '48h' respuesta. Recomendado: 3-4."
          items={p.stats}
          onChange={(v) => update("stats", v)}
          create={emptyStat}
          renderRow={(item, onUpdate, onRemove) => (
            <div className="grid grid-cols-12 gap-2">
              <input
                className="input col-span-4"
                placeholder="Valor (12+, 100%, 5.0...)"
                value={item.value}
                onChange={(e) => onUpdate({ ...item, value: e.target.value })}
              />
              <input
                className="input col-span-7"
                placeholder="Etiqueta (proyectos entregados)"
                value={item.label}
                onChange={(e) => onUpdate({ ...item, label: e.target.value })}
              />
              <button
                type="button"
                className="btn-ghost col-span-1 text-rose-600"
                onClick={onRemove}
              >
                ✕
              </button>
            </div>
          )}
        />

        {/* Value props */}
        <ListSection
          title="Pilares de confianza (3 cajas bajo el hero)"
          hint="Lo que te diferencia. Si no sabes qué poner, usa las sugerencias →"
          items={p.valueProps}
          onChange={(v) => update("valueProps", v)}
          create={emptyValueProp}
          extraButton={
            p.valueProps.length === 0
              ? {
                  label: "Usar sugerencias",
                  action: () => update("valueProps", SUGGESTED_VALUE_PROPS.map((v) => ({ ...v, id: rid() }))),
                }
              : null
          }
          renderRow={(item, onUpdate, onRemove) => (
            <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <div className="grid grid-cols-12 gap-2">
                <input
                  className="input col-span-2"
                  placeholder="Icono (emoji)"
                  value={item.icon}
                  onChange={(e) => onUpdate({ ...item, icon: e.target.value })}
                />
                <input
                  className="input col-span-9"
                  placeholder="Título (Entrega en plazo o no cobro)"
                  value={item.title}
                  onChange={(e) => onUpdate({ ...item, title: e.target.value })}
                />
                <button
                  type="button"
                  className="btn-ghost col-span-1 text-rose-600"
                  onClick={onRemove}
                >
                  ✕
                </button>
              </div>
              <textarea
                className="input mt-2 min-h-[60px]"
                placeholder="Descripción (Si me retraso..."
                value={item.description}
                onChange={(e) =>
                  onUpdate({ ...item, description: e.target.value })
                }
              />
            </div>
          )}
        />

        {/* Tecnologías */}
        <section className="card space-y-3">
          <h3 className="text-base font-semibold">Tecnologías</h3>
          <TagInput
            value={p.technologies}
            onChange={(v) => update("technologies", v)}
            placeholder="Añadir y Enter (React, Node.js, PostgreSQL...)"
          />
        </section>

        {/* Servicios */}
        <section className="card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Servicios</h3>
            <button
              type="button"
              className="btn-ghost text-xs"
              onClick={() => update("services", [...p.services, emptyService()])}
            >
              + Añadir servicio
            </button>
          </div>
          {p.services.length === 0 && (
            <p className="text-sm text-slate-500">
              Añade al menos un servicio con precio y plazo claros. Marca uno como
              "Más popular" para destacarlo.
            </p>
          )}
          {p.services.map((s, idx) => (
            <ServiceEditor
              key={s.id}
              service={s}
              onChange={(next) =>
                update("services", p.services.map((x, i) => (i === idx ? next : x)))
              }
              onRemove={() =>
                update("services", p.services.filter((_, i) => i !== idx))
              }
            />
          ))}
        </section>

        {/* Casos */}
        <section className="card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Casos / demos</h3>
            <button
              type="button"
              className="btn-ghost text-xs"
              onClick={() => update("caseStudies", [...p.caseStudies, emptyCase()])}
            >
              + Añadir caso
            </button>
          </div>
          {p.caseStudies.map((c, idx) => (
            <CaseEditor
              key={c.id}
              study={c}
              onChange={(next) =>
                update("caseStudies", p.caseStudies.map((x, i) => (i === idx ? next : x)))
              }
              onRemove={() =>
                update("caseStudies", p.caseStudies.filter((_, i) => i !== idx))
              }
            />
          ))}
        </section>

        {/* Testimonios */}
        <section className="card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Testimonios</h3>
            <button
              type="button"
              className="btn-ghost text-xs"
              onClick={() =>
                update("testimonials", [...p.testimonials, emptyTestimonial()])
              }
            >
              + Añadir testimonio
            </button>
          </div>
          <p className="text-sm text-slate-500">
            Aunque sea uno solo. Un testimonio real multiplica la confianza por 3.
            Pide a tu primer cliente que te escriba 2-3 líneas en cuanto entregues.
          </p>
          {p.testimonials.map((t, idx) => (
            <TestimonialEditor
              key={t.id}
              t={t}
              onChange={(next) =>
                update("testimonials", p.testimonials.map((x, i) => (i === idx ? next : x)))
              }
              onRemove={() =>
                update("testimonials", p.testimonials.filter((_, i) => i !== idx))
              }
            />
          ))}
        </section>

        {/* Proceso */}
        <section className="card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Proceso (cómo trabajas)</h3>
            <div className="flex gap-2">
              {p.processSteps.length === 0 && (
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  onClick={() => update("processSteps", SUGGESTED_STEPS.map((s) => ({ ...s, id: rid() })))}
                >
                  Usar sugerencias
                </button>
              )}
              <button
                type="button"
                className="btn-ghost text-xs"
                onClick={() =>
                  update("processSteps", [...p.processSteps, emptyStep()])
                }
              >
                + Añadir paso
              </button>
            </div>
          </div>
          {p.processSteps.map((s, idx) => (
            <div
              key={s.id}
              className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"
            >
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  placeholder={`Paso ${idx + 1}: título`}
                  value={s.title}
                  onChange={(e) =>
                    update(
                      "processSteps",
                      p.processSteps.map((x, i) =>
                        i === idx ? { ...x, title: e.target.value } : x
                      )
                    )
                  }
                />
                <button
                  type="button"
                  className="btn-ghost text-rose-600"
                  onClick={() =>
                    update(
                      "processSteps",
                      p.processSteps.filter((_, i) => i !== idx)
                    )
                  }
                >
                  ✕
                </button>
              </div>
              <textarea
                className="input mt-2 min-h-[60px]"
                placeholder="Descripción del paso..."
                value={s.description}
                onChange={(e) =>
                  update(
                    "processSteps",
                    p.processSteps.map((x, i) =>
                      i === idx ? { ...x, description: e.target.value } : x
                    )
                  )
                }
              />
            </div>
          ))}
        </section>

        {/* FAQ */}
        <section className="card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Preguntas frecuentes</h3>
            <div className="flex gap-2">
              {p.faqs.length === 0 && (
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  onClick={() => update("faqs", SUGGESTED_FAQS.map((f) => ({ ...f, id: rid() })))}
                >
                  Usar sugerencias
                </button>
              )}
              <button
                type="button"
                className="btn-ghost text-xs"
                onClick={() => update("faqs", [...p.faqs, emptyFaq()])}
              >
                + Añadir FAQ
              </button>
            </div>
          </div>
          {p.faqs.map((f, idx) => (
            <div
              key={f.id}
              className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"
            >
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  placeholder="Pregunta"
                  value={f.question}
                  onChange={(e) =>
                    update(
                      "faqs",
                      p.faqs.map((x, i) =>
                        i === idx ? { ...x, question: e.target.value } : x
                      )
                    )
                  }
                />
                <button
                  type="button"
                  className="btn-ghost text-rose-600"
                  onClick={() =>
                    update("faqs", p.faqs.filter((_, i) => i !== idx))
                  }
                >
                  ✕
                </button>
              </div>
              <textarea
                className="input mt-2 min-h-[80px]"
                placeholder="Respuesta..."
                value={f.answer}
                onChange={(e) =>
                  update(
                    "faqs",
                    p.faqs.map((x, i) =>
                      i === idx ? { ...x, answer: e.target.value } : x
                    )
                  )
                }
              />
            </div>
          ))}
        </section>

        {/* Redes */}
        <section className="card space-y-4">
          <h3 className="text-base font-semibold">Redes y enlaces</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {(
              [
                ["github", "GitHub"],
                ["linkedin", "LinkedIn"],
                ["twitter", "X / Twitter"],
                ["malt", "Malt"],
                ["upwork", "Upwork"],
                ["website", "Web personal"],
              ] as const
            ).map(([key, label]) => (
              <Field key={key} label={label}>
                <input
                  className="input"
                  value={(p.socials as Record<string, string | undefined>)[key] || ""}
                  onChange={(e) =>
                    update("socials", { ...p.socials, [key]: e.target.value })
                  }
                  placeholder="https://"
                />
              </Field>
            ))}
          </div>
        </section>

        <div className="sticky bottom-4 z-10 flex justify-end">
          <button
            className="btn-primary shadow-lg"
            disabled={saving}
            onClick={(e) => onSave(e as unknown as FormEvent)}
          >
            {saving ? <Spinner /> : "Guardar portfolio"}
          </button>
        </div>
      </form>
    </>
  );
}

function ListSection<T extends { id: string }>({
  title,
  hint,
  items,
  onChange,
  create,
  renderRow,
  extraButton,
}: {
  title: string;
  hint?: string;
  items: T[];
  onChange: (v: T[]) => void;
  create: () => T;
  renderRow: (item: T, onUpdate: (next: T) => void, onRemove: () => void) => React.ReactNode;
  extraButton?: { label: string; action: () => void } | null;
}) {
  return (
    <section className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">{title}</h3>
        <div className="flex gap-2">
          {extraButton && (
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={extraButton.action}
            >
              {extraButton.label}
            </button>
          )}
          <button
            type="button"
            className="btn-ghost text-xs"
            onClick={() => onChange([...items, create()])}
          >
            + Añadir
          </button>
        </div>
      </div>
      {hint && <p className="text-sm text-slate-500">{hint}</p>}
      <div className="space-y-2">
        {items.map((item, idx) =>
          renderRow(
            item,
            (next) => onChange(items.map((x, i) => (i === idx ? next : x))),
            () => onChange(items.filter((_, i) => i !== idx))
          )
        )}
      </div>
    </section>
  );
}

function ServiceEditor({
  service,
  onChange,
  onRemove,
}: {
  service: PortfolioService;
  onChange: (s: PortfolioService) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field label="Título">
          <input
            className="input"
            value={service.title}
            onChange={(e) => onChange({ ...service, title: e.target.value })}
          />
        </Field>
        <Field label="Precio (con moneda)">
          <input
            className="input"
            value={service.price}
            onChange={(e) => onChange({ ...service, price: e.target.value })}
            placeholder="desde 1.800€"
          />
        </Field>
        <Field label="Duración">
          <input
            className="input"
            value={service.duration}
            onChange={(e) => onChange({ ...service, duration: e.target.value })}
            placeholder="2 semanas"
          />
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Descripción corta">
          <textarea
            className="input min-h-[60px]"
            value={service.description}
            onChange={(e) => onChange({ ...service, description: e.target.value })}
          />
        </Field>
      </div>
      <div className="mt-3">
        <label className="label">Qué incluye (bullets)</label>
        <TagInput
          value={service.bullets}
          onChange={(v) => onChange({ ...service, bullets: v })}
          placeholder="Añadir bullet y Enter"
        />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!service.featured}
            onChange={(e) => onChange({ ...service, featured: e.target.checked })}
          />
          Marcar como "más popular" (sale destacado)
        </label>
        <button type="button" className="btn-ghost text-xs text-rose-600" onClick={onRemove}>
          Quitar
        </button>
      </div>
    </div>
  );
}

function CaseEditor({
  study,
  onChange,
  onRemove,
}: {
  study: PortfolioCaseStudy;
  onChange: (c: PortfolioCaseStudy) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Título">
          <input
            className="input"
            value={study.title}
            onChange={(e) => onChange({ ...study, title: e.target.value })}
          />
        </Field>
        <Field label="URL del demo">
          <input
            className="input"
            value={study.url}
            onChange={(e) => onChange({ ...study, url: e.target.value })}
            placeholder="https://demo.vercel.app"
          />
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Descripción">
          <textarea
            className="input min-h-[60px]"
            value={study.description}
            onChange={(e) => onChange({ ...study, description: e.target.value })}
          />
        </Field>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field label="Imagen (URL opcional)">
          <input
            className="input"
            value={study.imageUrl || ""}
            onChange={(e) => onChange({ ...study, imageUrl: e.target.value || null })}
            placeholder="https://... (o vacío para gradiente)"
          />
        </Field>
        <Field label="Métrica destacada">
          <input
            className="input"
            value={study.metric || ""}
            onChange={(e) => onChange({ ...study, metric: e.target.value || null })}
            placeholder="-40% no-shows"
          />
        </Field>
        <Field label="Etiqueta de métrica">
          <input
            className="input"
            value={study.metricLabel || ""}
            onChange={(e) => onChange({ ...study, metricLabel: e.target.value || null })}
            placeholder="primer mes"
          />
        </Field>
      </div>
      <div className="mt-3">
        <label className="label">Tags</label>
        <TagInput
          value={study.tags}
          onChange={(v) => onChange({ ...study, tags: v })}
          placeholder="React, Node, Stripe..."
        />
      </div>
      <div className="mt-3 text-right">
        <button type="button" className="btn-ghost text-xs text-rose-600" onClick={onRemove}>
          Quitar caso
        </button>
      </div>
    </div>
  );
}

function TestimonialEditor({
  t,
  onChange,
  onRemove,
}: {
  t: PortfolioTestimonial;
  onChange: (t: PortfolioTestimonial) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <Field label="Cita (lo que dice el cliente)">
        <textarea
          className="input min-h-[80px]"
          value={t.quote}
          onChange={(e) => onChange({ ...t, quote: e.target.value })}
          placeholder="En 3 semanas teníamos en producción algo que llevábamos meses postponiendo..."
        />
      </Field>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field label="Nombre">
          <input
            className="input"
            value={t.name}
            onChange={(e) => onChange({ ...t, name: e.target.value })}
          />
        </Field>
        <Field label="Cargo">
          <input
            className="input"
            value={t.role}
            onChange={(e) => onChange({ ...t, role: e.target.value })}
            placeholder="CEO"
          />
        </Field>
        <Field label="Empresa">
          <input
            className="input"
            value={t.company}
            onChange={(e) => onChange({ ...t, company: e.target.value })}
            placeholder="Clínica Dental Mezquita"
          />
        </Field>
      </div>
      <div className="mt-3">
        <Field label="URL del avatar (opcional)">
          <input
            className="input"
            value={t.avatarUrl || ""}
            onChange={(e) => onChange({ ...t, avatarUrl: e.target.value || null })}
            placeholder="https://..."
          />
        </Field>
      </div>
      <div className="mt-3 text-right">
        <button type="button" className="btn-ghost text-xs text-rose-600" onClick={onRemove}>
          Quitar
        </button>
      </div>
    </div>
  );
}

function TagInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");
  function add(s: string) {
    const v = s.trim();
    if (!v) return;
    if (!value.includes(v)) onChange([...value, v]);
    setInput("");
  }
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1">
        {value.map((tag) => (
          <button
            type="button"
            key={tag}
            onClick={() => onChange(value.filter((x) => x !== tag))}
            className="badge-purple"
          >
            {tag} ×
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(input);
            }
          }}
          placeholder={placeholder}
        />
        <button type="button" className="btn-secondary" onClick={() => add(input)}>
          +
        </button>
      </div>
    </div>
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
