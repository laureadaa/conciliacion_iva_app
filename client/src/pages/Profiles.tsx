import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Language, Platform, Profile } from "@pitchfork/shared";
import { api } from "../lib/api";
import PageHeader from "../components/PageHeader";
import Spinner from "../components/Spinner";
import EmptyState from "../components/EmptyState";

const TECH_SUGGESTIONS = [
  "React",
  "Next.js",
  "TypeScript",
  "Node.js",
  "Python",
  "Django",
  "Vue",
  "Svelte",
  "Tailwind",
  "PostgreSQL",
  "MongoDB",
  "AWS",
  "GCP",
  "Docker",
  "Kubernetes",
  "GraphQL",
  "Figma",
  "Stripe",
  "Supabase",
  "Firebase",
  "Anthropic API",
  "OpenAI",
];

export default function Profiles() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const [name, setName] = useState("");
  const [years, setYears] = useState("3");
  const [niche, setNiche] = useState("");
  const [techs, setTechs] = useState<string[]>([]);
  const [techInput, setTechInput] = useState("");
  const [platform, setPlatform] = useState<Platform>("malt");
  const [language, setLanguage] = useState<Language>("es");

  function load() {
    return api.get<Profile[]>("/profiles").then(setProfiles);
  }
  useEffect(() => {
    load()
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  function addTech(t: string) {
    const v = t.trim();
    if (!v) return;
    if (!techs.includes(v)) setTechs([...techs, v]);
    setTechInput("");
  }
  function removeTech(t: string) {
    setTechs(techs.filter((x) => x !== t));
  }

  async function onGen(e: FormEvent) {
    e.preventDefault();
    if (techs.length === 0) {
      toast.error("Añade al menos una tecnología");
      return;
    }
    setGenerating(true);
    try {
      await api.post<Profile>("/profiles/generate", {
        name,
        yearsExperience: Number(years),
        technologies: techs,
        platform,
        niche,
        language,
      });
      toast.success("Bio generada");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setGenerating(false);
    }
  }

  async function del(id: number) {
    if (!confirm("¿Eliminar bio?")) return;
    try {
      await api.del(`/profiles/${id}`);
      setProfiles((arr) => arr.filter((p) => p.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  }

  return (
    <>
      <PageHeader
        title="Generador de perfil profesional"
        subtitle="Bio optimizada para Malt, Upwork o LinkedIn"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <form onSubmit={onGen} className="card lg:col-span-1 space-y-4">
          <div>
            <label className="label">Nombre</label>
            <input
              className="input"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Años de experiencia</label>
              <input
                type="number"
                min={0}
                className="input"
                value={years}
                onChange={(e) => setYears(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Idioma</label>
              <select
                className="input"
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
              >
                <option value="es">ES</option>
                <option value="en">EN</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Nicho</label>
            <input
              className="input"
              required
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="SaaS B2B, e-commerce, fintech..."
            />
          </div>
          <div>
            <label className="label">Plataforma</label>
            <select
              className="input"
              value={platform}
              onChange={(e) => setPlatform(e.target.value as Platform)}
            >
              <option value="malt">Malt</option>
              <option value="upwork">Upwork</option>
              <option value="linkedin">LinkedIn</option>
              <option value="other">Otro</option>
            </select>
          </div>
          <div>
            <label className="label">Tecnologías</label>
            <div className="mb-2 flex flex-wrap gap-1">
              {techs.map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => removeTech(t)}
                  className="badge-purple"
                >
                  {t} ×
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="input"
                value={techInput}
                onChange={(e) => setTechInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTech(techInput);
                  }
                }}
                placeholder="Añadir y Enter"
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={() => addTech(techInput)}
              >
                +
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {TECH_SUGGESTIONS.filter((s) => !techs.includes(s))
                .slice(0, 12)
                .map((t) => (
                  <button
                    type="button"
                    key={t}
                    onClick={() => addTech(t)}
                    className="rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    + {t}
                  </button>
                ))}
            </div>
          </div>
          <button className="btn-primary w-full" disabled={generating}>
            {generating ? <Spinner /> : "Generar bio con IA"}
          </button>
        </form>

        <div className="lg:col-span-2 space-y-3">
          {loading ? (
            <div className="grid h-64 place-items-center">
              <Spinner size={28} />
            </div>
          ) : profiles.length === 0 ? (
            <EmptyState
              icon="👤"
              title="Sin bios generadas"
              description="Rellena el formulario y deja que Claude redacte tu perfil."
            />
          ) : (
            profiles.map((p) => (
              <div key={p.id} className="card">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">
                      {p.name}{" "}
                      <span className="ml-2 text-xs text-slate-500">
                        {p.platform.toUpperCase()} · {p.language.toUpperCase()}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      {p.niche} · {p.yearsExperience} años
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="btn-ghost text-xs"
                      onClick={() => {
                        navigator.clipboard.writeText(p.content);
                        toast.success("Copiado");
                      }}
                    >
                      Copiar
                    </button>
                    <button
                      className="btn-ghost text-xs text-rose-600"
                      onClick={() => del(p.id)}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {p.content}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
