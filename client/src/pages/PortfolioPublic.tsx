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
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    api
      .get<PublicPortfolio>(`/portfolio/public/${slug}`)
      .then((data) => {
        setP(data);
        document.title = `${data.displayName} — ${data.headline || "Freelance"}`;
      })
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

  const isDark = p.theme === "dark";
  const style: React.CSSProperties = {
    ["--accent" as string]: p.accentColor,
    ["--accent-soft" as string]: `color-mix(in srgb, ${p.accentColor} 12%, transparent)`,
  };

  return (
    <div
      className={`min-h-screen antialiased ${
        isDark ? "bg-zinc-950 text-zinc-100" : "bg-white text-zinc-900"
      }`}
      style={style}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap');
        .display { font-family: 'Instrument Serif', Georgia, serif; letter-spacing: -0.02em; line-height: 1; }
        .acc { color: var(--accent); }
        .acc-bg { background-color: var(--accent); }
        .acc-border { border-color: var(--accent); }
        .acc-bg-soft { background-color: var(--accent-soft); }
        .acc-grad {
          background-image:
            radial-gradient(70% 50% at 50% 0%, color-mix(in srgb, var(--accent) 22%, transparent) 0%, transparent 60%),
            radial-gradient(40% 30% at 80% 10%, color-mix(in srgb, var(--accent) 12%, transparent) 0%, transparent 70%);
        }
        .case-grad {
          background-image: linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 40%, #000) 100%);
        }
        .grid-bg {
          background-image:
            linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px);
          background-size: 32px 32px;
          mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, black 30%, transparent 80%);
        }
        .grid-bg-dark {
          background-image:
            linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px);
          background-size: 32px 32px;
          mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, black 30%, transparent 80%);
        }
        .ring-accent { box-shadow: 0 0 0 1px var(--accent); }
        .fade-in { animation: fadeIn .6s ease-out both; }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        a, button { transition: all .2s ease; }
      `}</style>

      {/* Sticky minimal nav */}
      <header
        className={`sticky top-0 z-40 backdrop-blur-md ${
          isDark ? "bg-zinc-950/70" : "bg-white/70"
        } border-b ${isDark ? "border-zinc-800" : "border-zinc-100"}`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            {p.photoUrl ? (
              <img
                src={p.photoUrl}
                alt={p.displayName}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <div className="acc-bg grid h-8 w-8 place-items-center rounded-full text-xs font-bold text-white">
                {p.displayName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <span className="text-sm font-semibold">{p.displayName}</span>
          </div>
          <nav className="hidden gap-7 text-sm md:flex">
            {p.services.length > 0 && (
              <a href="#servicios" className="opacity-70 hover:opacity-100">
                Servicios
              </a>
            )}
            {p.caseStudies.length > 0 && (
              <a href="#casos" className="opacity-70 hover:opacity-100">
                Casos
              </a>
            )}
            {p.processSteps.length > 0 && (
              <a href="#proceso" className="opacity-70 hover:opacity-100">
                Proceso
              </a>
            )}
            {p.faqs.length > 0 && (
              <a href="#faq" className="opacity-70 hover:opacity-100">
                FAQ
              </a>
            )}
          </nav>
          <a
            href="#contacto"
            className="acc-bg rounded-full px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
          >
            Hablamos →
          </a>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="acc-grad pointer-events-none absolute inset-0 -z-10" />
        <div
          className={`pointer-events-none absolute inset-0 -z-10 ${
            isDark ? "grid-bg-dark" : "grid-bg"
          }`}
        />
        <div className="mx-auto max-w-6xl px-6 pt-20 pb-12 md:pt-28 md:pb-20">
          <div className="fade-in mx-auto max-w-4xl text-center">
            {p.availability && (
              <div className="acc-bg-soft inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium acc">
                <span className="relative flex h-2 w-2">
                  <span className="acc-bg absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
                  <span className="acc-bg relative inline-flex h-2 w-2 rounded-full" />
                </span>
                {p.availability}
              </div>
            )}

            <h1 className="display mt-6 text-5xl font-normal md:text-7xl lg:text-[88px]">
              {p.tagline || `Hola, soy ${p.displayName}.`}
            </h1>

            {p.headline && (
              <p
                className={`mt-6 text-lg ${
                  isDark ? "text-zinc-400" : "text-zinc-500"
                } md:text-xl`}
              >
                {p.headline}
              </p>
            )}

            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <a
                href="#contacto"
                className="acc-bg rounded-full px-6 py-3 text-sm font-semibold text-white shadow-lg hover:opacity-90"
              >
                Cuéntame tu proyecto →
              </a>
              {p.caseStudies.length > 0 && (
                <a
                  href="#casos"
                  className={`rounded-full border px-6 py-3 text-sm font-semibold ${
                    isDark
                      ? "border-zinc-700 hover:bg-zinc-900"
                      : "border-zinc-200 hover:bg-zinc-50"
                  }`}
                >
                  Ver casos
                </a>
              )}
            </div>

            {p.responseTime && (
              <p
                className={`mt-6 text-xs ${
                  isDark ? "text-zinc-500" : "text-zinc-400"
                }`}
              >
                {p.responseTime} · Sin compromiso
              </p>
            )}
          </div>

          {/* Stats bar */}
          {p.stats.length > 0 && (
            <div
              className={`mt-16 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border md:grid-cols-${Math.min(
                p.stats.length,
                4
              )} ${
                isDark
                  ? "border-zinc-800 bg-zinc-800"
                  : "border-zinc-200 bg-zinc-200"
              }`}
            >
              {p.stats.map((s) => (
                <div
                  key={s.id}
                  className={`px-6 py-6 text-center ${
                    isDark ? "bg-zinc-950" : "bg-white"
                  }`}
                >
                  <div className="display text-3xl md:text-4xl">{s.value}</div>
                  <div
                    className={`mt-1 text-xs uppercase tracking-wider ${
                      isDark ? "text-zinc-500" : "text-zinc-500"
                    }`}
                  >
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tech pills */}
          {p.technologies.length > 0 && (
            <div className="mt-10 flex flex-wrap justify-center gap-2">
              {p.technologies.map((t) => (
                <span
                  key={t}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    isDark
                      ? "border-zinc-800 bg-zinc-900/50 text-zinc-300"
                      : "border-zinc-200 bg-white/50 text-zinc-700"
                  }`}
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* VALUE PROPS */}
      {p.valueProps.length > 0 && (
        <section
          className={`py-16 ${isDark ? "bg-zinc-900/50" : "bg-zinc-50"}`}
        >
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {p.valueProps.map((v) => (
                <div
                  key={v.id}
                  className={`rounded-2xl border p-6 ${
                    isDark
                      ? "border-zinc-800 bg-zinc-950"
                      : "border-zinc-200 bg-white"
                  }`}
                >
                  <div className="acc-bg-soft acc inline-flex h-12 w-12 items-center justify-center rounded-xl text-2xl">
                    {v.icon || "✓"}
                  </div>
                  <h3 className="mt-4 text-lg font-bold">{v.title}</h3>
                  <p
                    className={`mt-1 text-sm ${
                      isDark ? "text-zinc-400" : "text-zinc-600"
                    }`}
                  >
                    {v.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* SERVICES */}
      {p.services.length > 0 && (
        <section id="servicios" className="py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mb-14 max-w-2xl">
              <div className="acc text-xs font-bold uppercase tracking-[0.2em]">
                Servicios
              </div>
              <h2 className="display mt-3 text-4xl md:text-5xl">
                Lo que monto para ti
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {p.services.map((s) => {
                const featured = !!s.featured;
                return (
                  <div
                    key={s.id}
                    className={`relative flex flex-col rounded-2xl border p-7 transition hover:-translate-y-0.5 ${
                      featured
                        ? `ring-accent ${
                            isDark
                              ? "border-transparent bg-zinc-900"
                              : "border-transparent bg-white"
                          }`
                        : isDark
                          ? "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
                          : "border-zinc-200 bg-white hover:border-zinc-300"
                    }`}
                  >
                    {featured && (
                      <div className="acc-bg absolute -top-3 right-6 rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                        Más popular
                      </div>
                    )}
                    <h3 className="text-xl font-bold">{s.title}</h3>
                    {s.description && (
                      <p
                        className={`mt-2 text-sm ${
                          isDark ? "text-zinc-400" : "text-zinc-600"
                        }`}
                      >
                        {s.description}
                      </p>
                    )}
                    {s.bullets.length > 0 && (
                      <ul className="mt-5 space-y-2 text-sm">
                        {s.bullets.map((b, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="acc mt-0.5 flex-shrink-0">✓</span>
                            <span
                              className={
                                isDark ? "text-zinc-300" : "text-zinc-700"
                              }
                            >
                              {b}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div
                      className={`mt-7 flex items-end justify-between border-t pt-5 ${
                        isDark ? "border-zinc-800" : "border-zinc-100"
                      }`}
                    >
                      <div>
                        <div className="display text-2xl">{s.price}</div>
                        {s.duration && (
                          <div
                            className={`mt-0.5 text-xs ${
                              isDark ? "text-zinc-500" : "text-zinc-500"
                            }`}
                          >
                            {s.duration}
                          </div>
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
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* CASES */}
      {p.caseStudies.length > 0 && (
        <section
          id="casos"
          className={`py-24 ${isDark ? "bg-zinc-900/50" : "bg-zinc-50"}`}
        >
          <div className="mx-auto max-w-6xl px-6">
            <div className="mb-14 max-w-2xl">
              <div className="acc text-xs font-bold uppercase tracking-[0.2em]">
                Trabajo
              </div>
              <h2 className="display mt-3 text-4xl md:text-5xl">
                Casos recientes
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {p.caseStudies.map((c) => (
                <a
                  key={c.id}
                  href={c.url || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className={`group block overflow-hidden rounded-2xl border transition hover:-translate-y-1 hover:shadow-xl ${
                    isDark
                      ? "border-zinc-800 bg-zinc-950"
                      : "border-zinc-200 bg-white"
                  }`}
                >
                  <div
                    className="case-grad relative aspect-[16/9] w-full overflow-hidden"
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
                        <span className="display text-7xl opacity-30">
                          {c.title.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                    )}
                    {c.metric && (
                      <div className="absolute bottom-4 left-4 rounded-xl bg-white/95 px-4 py-2 backdrop-blur">
                        <div className="display text-xl text-zinc-900">
                          {c.metric}
                        </div>
                        {c.metricLabel && (
                          <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                            {c.metricLabel}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-bold">{c.title}</h3>
                    {c.description && (
                      <p
                        className={`mt-2 text-sm ${
                          isDark ? "text-zinc-400" : "text-zinc-600"
                        }`}
                      >
                        {c.description}
                      </p>
                    )}
                    {c.tags.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {c.tags.map((t) => (
                          <span
                            key={t}
                            className={`rounded-md px-2 py-0.5 text-xs ${
                              isDark
                                ? "bg-zinc-900 text-zinc-400"
                                : "bg-zinc-100 text-zinc-600"
                            }`}
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

      {/* TESTIMONIALS */}
      {p.testimonials.length > 0 && (
        <section className="py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mb-14 max-w-2xl">
              <div className="acc text-xs font-bold uppercase tracking-[0.2em]">
                Lo que dicen
              </div>
              <h2 className="display mt-3 text-4xl md:text-5xl">
                Clientes que ya confían en mí
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {p.testimonials.map((t) => (
                <figure
                  key={t.id}
                  className={`flex flex-col rounded-2xl border p-7 ${
                    isDark
                      ? "border-zinc-800 bg-zinc-950"
                      : "border-zinc-200 bg-white"
                  }`}
                >
                  <div className="acc display text-5xl leading-none">"</div>
                  <blockquote
                    className={`mt-2 flex-1 text-base leading-relaxed ${
                      isDark ? "text-zinc-300" : "text-zinc-700"
                    }`}
                  >
                    {t.quote}
                  </blockquote>
                  <figcaption className="mt-6 flex items-center gap-3">
                    {t.avatarUrl ? (
                      <img
                        src={t.avatarUrl}
                        alt={t.name}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div
                        className={`grid h-10 w-10 place-items-center rounded-full text-sm font-semibold ${
                          isDark
                            ? "bg-zinc-800 text-zinc-300"
                            : "bg-zinc-100 text-zinc-700"
                        }`}
                      >
                        {t.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="text-sm font-semibold">{t.name}</div>
                      <div
                        className={`text-xs ${
                          isDark ? "text-zinc-500" : "text-zinc-500"
                        }`}
                      >
                        {t.role}
                        {t.role && t.company && " · "}
                        {t.company}
                      </div>
                    </div>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* PROCESS */}
      {p.processSteps.length > 0 && (
        <section
          id="proceso"
          className={`py-24 ${isDark ? "bg-zinc-900/50" : "bg-zinc-50"}`}
        >
          <div className="mx-auto max-w-6xl px-6">
            <div className="mb-14 max-w-2xl">
              <div className="acc text-xs font-bold uppercase tracking-[0.2em]">
                Proceso
              </div>
              <h2 className="display mt-3 text-4xl md:text-5xl">
                Cómo trabajamos juntos
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              {p.processSteps.map((s, idx) => (
                <div key={s.id} className="relative">
                  <div className="display acc text-6xl opacity-30">
                    {String(idx + 1).padStart(2, "0")}
                  </div>
                  <h3 className="mt-2 text-lg font-bold">{s.title}</h3>
                  <p
                    className={`mt-2 text-sm leading-relaxed ${
                      isDark ? "text-zinc-400" : "text-zinc-600"
                    }`}
                  >
                    {s.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ABOUT */}
      {p.bio && (
        <section id="sobre-mi" className="py-24">
          <div className="mx-auto grid max-w-5xl gap-12 px-6 md:grid-cols-5">
            <div className="md:col-span-2">
              {p.photoUrl ? (
                <img
                  src={p.photoUrl}
                  alt={p.displayName}
                  className="aspect-square w-full rounded-2xl object-cover"
                />
              ) : (
                <div className="case-grad aspect-square w-full rounded-2xl" />
              )}
            </div>
            <div className="md:col-span-3">
              <div className="acc text-xs font-bold uppercase tracking-[0.2em]">
                Sobre mí
              </div>
              <h2 className="display mt-3 text-4xl md:text-5xl">
                {p.displayName}
              </h2>
              {p.headline && (
                <p
                  className={`mt-2 text-base ${
                    isDark ? "text-zinc-400" : "text-zinc-500"
                  }`}
                >
                  {p.headline}
                </p>
              )}
              <div
                className={`mt-6 whitespace-pre-wrap text-base leading-relaxed ${
                  isDark ? "text-zinc-300" : "text-zinc-700"
                }`}
              >
                {p.bio}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      {p.faqs.length > 0 && (
        <section
          id="faq"
          className={`py-24 ${isDark ? "bg-zinc-900/50" : "bg-zinc-50"}`}
        >
          <div className="mx-auto max-w-3xl px-6">
            <div className="mb-12">
              <div className="acc text-xs font-bold uppercase tracking-[0.2em]">
                Preguntas frecuentes
              </div>
              <h2 className="display mt-3 text-4xl md:text-5xl">
                Lo que sueles preguntar
              </h2>
            </div>
            <div
              className={`divide-y rounded-2xl border ${
                isDark
                  ? "divide-zinc-800 border-zinc-800 bg-zinc-950"
                  : "divide-zinc-200 border-zinc-200 bg-white"
              }`}
            >
              {p.faqs.map((f) => {
                const isOpen = openFaq === f.id;
                return (
                  <div key={f.id} className="px-6 py-5">
                    <button
                      className="flex w-full items-center justify-between text-left"
                      onClick={() => setOpenFaq(isOpen ? null : f.id)}
                    >
                      <span className="text-base font-semibold">
                        {f.question}
                      </span>
                      <span
                        className={`acc text-2xl font-thin transition-transform ${
                          isOpen ? "rotate-45" : ""
                        }`}
                      >
                        +
                      </span>
                    </button>
                    {isOpen && (
                      <div
                        className={`mt-3 whitespace-pre-wrap text-sm leading-relaxed ${
                          isDark ? "text-zinc-400" : "text-zinc-600"
                        }`}
                      >
                        {f.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* CONTACT */}
      <section id="contacto" className="py-24">
        <div className="mx-auto max-w-3xl px-6">
          <div className="text-center">
            <div className="acc text-xs font-bold uppercase tracking-[0.2em]">
              Hablamos
            </div>
            <h2 className="display mt-3 text-4xl md:text-6xl">
              ¿Tu proyecto es el siguiente?
            </h2>
            <p
              className={`mt-4 text-base ${
                isDark ? "text-zinc-400" : "text-zinc-600"
              }`}
            >
              {p.responseTime || "Te respondo en menos de 48 h"} · Sin
              compromiso · La primera llamada es gratis.
            </p>
          </div>
          <ContactForm slug={p.slug} accent={p.accentColor} isDark={isDark} />
        </div>
      </section>

      {/* FOOTER */}
      <footer
        className={`border-t py-10 ${
          isDark
            ? "border-zinc-800 bg-zinc-950"
            : "border-zinc-100 bg-white"
        }`}
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 text-sm">
          <div className={isDark ? "text-zinc-500" : "text-zinc-500"}>
            © {new Date().getFullYear()} {p.displayName}
          </div>
          <div className="flex flex-wrap gap-5">
            {Object.entries(p.socials).map(([k, v]) =>
              v ? (
                <a
                  key={k}
                  href={v}
                  target="_blank"
                  rel="noreferrer"
                  className={`hover:underline ${
                    isDark ? "text-zinc-400" : "text-zinc-600"
                  }`}
                >
                  {k}
                </a>
              ) : null
            )}
            {p.contactEmail && (
              <a
                href={`mailto:${p.contactEmail}`}
                className={`hover:underline ${
                  isDark ? "text-zinc-400" : "text-zinc-600"
                }`}
              >
                {p.contactEmail}
              </a>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}

function ContactForm({
  slug,
  accent,
  isDark,
}: {
  slug: string;
  accent: string;
  isDark: boolean;
}) {
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
      <div
        className={`mt-10 rounded-2xl border p-10 text-center ${
          isDark
            ? "border-zinc-800 bg-zinc-950"
            : "border-zinc-200 bg-white"
        }`}
      >
        <div className="text-5xl">✉️</div>
        <h3 className="display mt-4 text-3xl">Mensaje recibido</h3>
        <p className={`mt-2 text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
          Te respondo en menos de 48 h.
        </p>
      </div>
    );
  }

  const inputClass = `w-full rounded-lg border bg-transparent px-4 py-3 text-sm focus:outline-none focus:ring-2 ${
    isDark
      ? "border-zinc-800 placeholder-zinc-500"
      : "border-zinc-200 placeholder-zinc-400"
  }`;

  return (
    <form onSubmit={onSubmit} className="mt-10 space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <input
          className={inputClass}
          style={{ ["--tw-ring-color" as string]: accent }}
          placeholder="Tu nombre"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="email"
          className={inputClass}
          style={{ ["--tw-ring-color" as string]: accent }}
          placeholder="tu@email.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <input
        className={inputClass}
        style={{ ["--tw-ring-color" as string]: accent }}
        placeholder="Empresa / negocio (opcional)"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
      />
      <textarea
        className={inputClass}
        style={{ ["--tw-ring-color" as string]: accent }}
        rows={6}
        placeholder="Cuéntame qué necesitas. Cuanto más concreto, mejor."
        required
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <button
        type="submit"
        disabled={sending}
        className="inline-flex w-full items-center justify-center rounded-lg px-6 py-4 text-base font-semibold text-white shadow-lg transition hover:opacity-90 disabled:opacity-60"
        style={{ backgroundColor: accent }}
      >
        {sending ? <Spinner /> : "Enviar mensaje →"}
      </button>
    </form>
  );
}
