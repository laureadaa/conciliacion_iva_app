import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import type {
  Portfolio,
  PortfolioCaseStudy,
  PortfolioService,
} from "@pitchfork/shared";
import { api } from "../lib/api";
import PageHeader from "../components/PageHeader";
import Spinner from "../components/Spinner";

function rid(): string {
  return Math.random().toString(36).slice(2, 10);
}

const emptyService: PortfolioService = {
  id: "",
  title: "",
  description: "",
  price: "",
  duration: "",
  bullets: [],
};

const emptyCase: PortfolioCaseStudy = {
  id: "",
  title: "",
  description: "",
  url: "",
  tags: [],
  imageUrl: null,
};

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
        availability: p.availability,
        socials: p.socials,
        accentColor: p.accentColor,
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
        subtitle="Tu landing pública. Va a ser el enlace que pegas en cada email."
        actions={
          <>
            <a
              className="btn-secondary"
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
            >
              Ver →
            </a>
            <button className="btn-primary" onClick={(e) => onSave(e as unknown as FormEvent)} disabled={saving}>
              {saving ? <Spinner /> : "Guardar"}
            </button>
          </>
        }
      />

      <form onSubmit={onSave} className="space-y-6">
        {/* Publish toggle + URL */}
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
            <div className="flex flex-1 min-w-[200px] items-center gap-2">
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
            <Field label="Headline corto (sobre tu nombre)">
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
                  {["#7c3aed", "#0891b2", "#059669", "#dc2626", "#ea580c", "#0f172a"].map(
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

        {/* Tagline + bio */}
        <section className="card space-y-4">
          <h3 className="text-base font-semibold">Tu pitch</h3>
          <Field label="Tagline (frase grande del hero)">
            <textarea
              className="input min-h-[80px]"
              value={p.tagline}
              onChange={(e) => update("tagline", e.target.value)}
              placeholder="Monto sistemas de reservas online para clínicas pequeñas. Calendario por profesional, recordatorios automáticos y panel de recepción. En 2 semanas."
              maxLength={300}
            />
          </Field>
          <Field label="Sobre mí (bio)">
            <textarea
              className="input min-h-[140px]"
              value={p.bio || ""}
              onChange={(e) => update("bio", e.target.value)}
              placeholder="Soy desarrolladora freelance enfocada en producto digital para pequeños negocios..."
            />
          </Field>
          <Field label="Disponibilidad (pill que sale en el hero)">
            <input
              className="input"
              value={p.availability || ""}
              onChange={(e) => update("availability", e.target.value)}
              placeholder="Disponible para nuevos proyectos en junio 2026"
            />
          </Field>
        </section>

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
              onClick={() =>
                update("services", [
                  ...p.services,
                  { ...emptyService, id: rid() },
                ])
              }
            >
              + Añadir servicio
            </button>
          </div>
          {p.services.length === 0 && (
            <p className="text-sm text-slate-500">
              Añade al menos un servicio con precio y plazo claros. Es lo más
              importante del portfolio.
            </p>
          )}
          {p.services.map((s, idx) => (
            <ServiceEditor
              key={s.id}
              service={s}
              onChange={(next) =>
                update(
                  "services",
                  p.services.map((x, i) => (i === idx ? next : x))
                )
              }
              onRemove={() =>
                update(
                  "services",
                  p.services.filter((_, i) => i !== idx)
                )
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
              onClick={() =>
                update("caseStudies", [
                  ...p.caseStudies,
                  { ...emptyCase, id: rid() },
                ])
              }
            >
              + Añadir caso
            </button>
          </div>
          {p.caseStudies.length === 0 && (
            <p className="text-sm text-slate-500">
              Pon aquí tus demos publicados (Vercel, Netlify, GitHub Pages...).
              Sin ellos, el portfolio queda flojo.
            </p>
          )}
          {p.caseStudies.map((c, idx) => (
            <CaseEditor
              key={c.id}
              study={c}
              onChange={(next) =>
                update(
                  "caseStudies",
                  p.caseStudies.map((x, i) => (i === idx ? next : x))
                )
              }
              onRemove={() =>
                update(
                  "caseStudies",
                  p.caseStudies.filter((_, i) => i !== idx)
                )
              }
            />
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

        <div className="flex justify-end">
          <button className="btn-primary" disabled={saving}>
            {saving ? <Spinner /> : "Guardar portfolio"}
          </button>
        </div>
      </form>
    </>
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
            onChange={(e) =>
              onChange({ ...service, description: e.target.value })
            }
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
      <div className="mt-3 text-right">
        <button
          type="button"
          className="btn-ghost text-xs text-rose-600"
          onClick={onRemove}
        >
          Quitar servicio
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
      <div className="mt-3">
        <Field label="Imagen (URL opcional)">
          <input
            className="input"
            value={study.imageUrl || ""}
            onChange={(e) =>
              onChange({ ...study, imageUrl: e.target.value || null })
            }
            placeholder="https://... (si no, se usa un gradiente)"
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
        <button
          type="button"
          className="btn-ghost text-xs text-rose-600"
          onClick={onRemove}
        >
          Quitar caso
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
        {value.map((t) => (
          <button
            type="button"
            key={t}
            onClick={() => onChange(value.filter((x) => x !== t))}
            className="badge-purple"
          >
            {t} ×
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
