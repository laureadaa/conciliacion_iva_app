import { FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import type { PublicPortfolio } from "@pitchfork/shared";
import { api, ApiError } from "../lib/api";
import Spinner from "../components/Spinner";

export default function PortfolioPublic() {
  const { slug } = useParams<{ slug: string }>();
  const [p, setP] = useState<PublicPortfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    api
      .get<PublicPortfolio>(`/portfolio/public/${slug}`)
      .then(setP)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) setNotFound(true);
        else toast.error(e instanceof Error ? e.message : "Error");
      })
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="grid h-screen place-items-center bg-white text-slate-900">
        <Spinner size={32} />
      </div>
    );
  }
  if (notFound || !p) {
    return (
      <div className="grid h-screen place-items-center bg-white px-6 text-center">
        <div>
          <div className="text-6xl">🔍</div>
          <h1 className="mt-3 text-2xl font-bold">Portfolio no encontrado</h1>
          <p className="mt-1 text-sm text-slate-500">
            Puede que aún no esté publicado.
          </p>
        </div>
      </div>
    );
  }

  // Inject CSS variables for accent color
  const style: React.CSSProperties = {
    ["--accent" as string]: p.accentColor,
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased" style={style}>
      {/* Page-specific styles */}
      <style>{`
        .acc { color: var(--accent); }
        .acc-bg { background-color: var(--accent); }
        .acc-bg-soft { background-color: color-mix(in srgb, var(--accent) 10%, transparent); }
        .acc-border { border-color: var(--accent); }
        .acc-grad { background-image: radial-gradient(60% 60% at 50% 0%, color-mix(in srgb, var(--accent) 25%, transparent) 0%, transparent 70%); }
        .case-grad { background-image: linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 40%, #000) 100%); }
        body { background: white; }
      `}</style>

      {/* Nav minimal */}
      <header className="mx-auto max-w-5xl px-6 py-6 flex items-center justify-between">
        <div className="font-mono text-sm">/ {p.displayName.toLowerCase().replace(/\s+/g, "-")}</div>
        <nav className="hidden gap-6 text-sm md:flex">
          {p.services.length > 0 && <a href="#servicios" className="hover:underline">Servicios</a>}
          {p.caseStudies.length > 0 && <a href="#casos" className="hover:underline">Casos</a>}
          {p.bio && <a href="#sobre-mi" className="hover:underline">Sobre mí</a>}
          <a href="#contacto" className="acc">Contacto →</a>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="acc-grad absolute inset-x-0 top-0 h-[600px] -z-10" />
        <div className="mx-auto max-w-5xl px-6 py-16 md:py-24">
          {p.availability && (
            <div className="acc-bg-soft mb-6 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium acc">
              <span className="acc-bg inline-block h-2 w-2 rounded-full animate-pulse" />
              {p.availability}
            </div>
          )}
          <h1 className="text-3xl font-bold leading-[1.05] tracking-tight md:text-5xl lg:text-6xl">
            {p.tagline ||
              `Hola, soy ${p.displayName}. Construyo producto digital para pequeños negocios.`}
          </h1>
          <div className="mt-6 flex flex-wrap items-center gap-4 text-base text-slate-600">
            <div className="flex items-center gap-3">
              {p.photoUrl ? (
                <img
                  src={p.photoUrl}
                  alt={p.displayName}
                  className="h-12 w-12 rounded-full object-cover"
                />
              ) : (
                <div className="acc-bg grid h-12 w-12 place-items-center rounded-full text-lg font-semibold text-white">
                  {p.displayName.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div>
                <div className="font-medium text-slate-900">{p.displayName}</div>
                {p.headline && <div className="text-sm text-slate-500">{p.headline}</div>}
              </div>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#contacto"
              className="acc-bg inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
            >
              Contactar
            </a>
            {p.caseStudies.length > 0 && (
              <a
                href="#casos"
                className="acc acc-border inline-flex items-center justify-center gap-2 rounded-lg border-2 px-5 py-2.5 text-sm font-medium transition hover:bg-slate-50"
              >
                Ver casos →
              </a>
            )}
          </div>

          {p.technologies.length > 0 && (
            <div className="mt-12 flex flex-wrap gap-2">
              {p.technologies.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Services */}
      {p.services.length > 0 && (
        <section id="servicios" className="bg-slate-50 py-20">
          <div className="mx-auto max-w-5xl px-6">
            <div className="mb-10">
              <div className="acc text-sm font-semibold uppercase tracking-wider">
                Servicios
              </div>
              <h2 className="mt-2 text-2xl font-bold md:text-3xl">Lo que hago</h2>
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {p.services.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 transition hover:shadow-md"
                >
                  <h3 className="text-lg font-bold">{s.title}</h3>
                  {s.description && (
                    <p className="mt-2 text-sm text-slate-600">{s.description}</p>
                  )}
                  {s.bullets.length > 0 && (
                    <ul className="mt-4 space-y-1.5 text-sm">
                      {s.bullets.map((b, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="acc mt-0.5">✓</span>
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-6 flex items-end justify-between border-t border-slate-100 pt-4">
                    <div>
                      <div className="acc text-2xl font-bold">{s.price}</div>
                      {s.duration && (
                        <div className="text-xs text-slate-500">{s.duration}</div>
                      )}
                    </div>
                    <a
                      href="#contacto"
                      className="acc text-sm font-semibold hover:underline"
                    >
                      Pedir →
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Cases */}
      {p.caseStudies.length > 0 && (
        <section id="casos" className="bg-white py-20">
          <div className="mx-auto max-w-5xl px-6">
            <div className="mb-10">
              <div className="acc text-sm font-semibold uppercase tracking-wider">
                Casos
              </div>
              <h2 className="mt-2 text-2xl font-bold md:text-3xl">
                Trabajos recientes
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {p.caseStudies.map((c) => (
                <a
                  key={c.id}
                  href={c.url || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="group block overflow-hidden rounded-2xl border border-slate-200 transition hover:shadow-lg"
                >
                  <div
                    className="case-grad relative h-48 w-full overflow-hidden"
                    style={
                      c.imageUrl
                        ? {
                            backgroundImage: `url(${c.imageUrl})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                          }
                        : undefined
                    }
                  >
                    {!c.imageUrl && (
                      <div className="grid h-full place-items-center text-white">
                        <span className="text-4xl font-bold opacity-30">
                          {c.title.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="text-lg font-bold group-hover:underline">
                      {c.title}
                    </h3>
                    {c.description && (
                      <p className="mt-2 text-sm text-slate-600">{c.description}</p>
                    )}
                    {c.tags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {c.tags.map((t) => (
                          <span
                            key={t}
                            className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* About */}
      {p.bio && (
        <section id="sobre-mi" className="bg-slate-50 py-20">
          <div className="mx-auto max-w-3xl px-6">
            <div className="acc text-sm font-semibold uppercase tracking-wider">
              Sobre mí
            </div>
            <h2 className="mt-2 text-2xl font-bold md:text-3xl">
              ¿Quién está detrás?
            </h2>
            <div className="mt-6 whitespace-pre-wrap text-base leading-relaxed text-slate-700">
              {p.bio}
            </div>
          </div>
        </section>
      )}

      {/* Contact */}
      <section id="contacto" className="bg-white py-20">
        <div className="mx-auto max-w-3xl px-6">
          <div className="acc text-sm font-semibold uppercase tracking-wider">
            Contacto
          </div>
          <h2 className="mt-2 text-2xl font-bold md:text-3xl">
            Cuéntame tu proyecto
          </h2>
          <p className="mt-2 text-slate-600">
            Respuesta en menos de 48 h. Sin compromiso.
          </p>
          <ContactForm slug={p.slug} accent={p.accentColor} />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-10">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 text-sm text-slate-500">
          <div>
            © {new Date().getFullYear()} {p.displayName}
          </div>
          <div className="flex flex-wrap gap-4">
            {Object.entries(p.socials).map(([k, v]) =>
              v ? (
                <a
                  key={k}
                  href={v}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline"
                >
                  {k}
                </a>
              ) : null
            )}
            {p.contactEmail && (
              <a href={`mailto:${p.contactEmail}`} className="hover:underline">
                {p.contactEmail}
              </a>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}

function ContactForm({ slug, accent }: { slug: string; accent: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      await api.post(`/portfolio/public/${slug}/contact`, {
        name,
        email,
        company,
        message,
      });
      setDone(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al enviar");
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <div className="text-4xl">✉️</div>
        <h3 className="mt-3 text-lg font-bold">Mensaje enviado</h3>
        <p className="mt-1 text-sm text-slate-600">
          Te respondo en menos de 48 h.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <input
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2"
          style={{ ["--tw-ring-color" as string]: accent }}
          placeholder="Tu nombre"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="email"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2"
          style={{ ["--tw-ring-color" as string]: accent }}
          placeholder="tu@email.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <input
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2"
        style={{ ["--tw-ring-color" as string]: accent }}
        placeholder="Empresa / negocio (opcional)"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
      />
      <textarea
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2"
        style={{ ["--tw-ring-color" as string]: accent }}
        rows={6}
        placeholder="Cuéntame qué necesitas..."
        required
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <button
        type="submit"
        disabled={sending}
        className="inline-flex w-full items-center justify-center rounded-lg px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
        style={{ backgroundColor: accent }}
      >
        {sending ? <Spinner /> : "Enviar mensaje"}
      </button>
    </form>
  );
}
