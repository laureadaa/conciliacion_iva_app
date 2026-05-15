import { FormEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Client, Proposal, ProposalStatus, Language } from "@freelance/shared";
import { api } from "../lib/api";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import Spinner from "../components/Spinner";
import EmptyState from "../components/EmptyState";

const statusOptions: { value: ProposalStatus; label: string; cls: string }[] = [
  { value: "draft", label: "Borrador", cls: "badge-gray" },
  { value: "sent", label: "Enviada", cls: "badge-blue" },
  { value: "accepted", label: "Aceptada", cls: "badge-green" },
  { value: "rejected", label: "Rechazada", cls: "badge-rose" },
];

export default function Proposals() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ProposalStatus | "all">("all");
  const [generating, setGenerating] = useState(false);
  const [showGen, setShowGen] = useState(false);
  const [viewing, setViewing] = useState<Proposal | null>(null);
  const viewRef = useRef<HTMLDivElement>(null);

  // form
  const [projectType, setProjectType] = useState("");
  const [clientDescription, setClientDescription] = useState("");
  const [budget, setBudget] = useState<string>("");
  const [deadline, setDeadline] = useState("");
  const [language, setLanguage] = useState<Language>("es");
  const [clientId, setClientId] = useState<string>("");
  const [title, setTitle] = useState("");

  function reload() {
    return api.get<Proposal[]>("/proposals").then(setProposals);
  }

  useEffect(() => {
    Promise.all([reload(), api.get<Client[]>("/clients").then(setClients)])
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function onGenerate(e: FormEvent) {
    e.preventDefault();
    setGenerating(true);
    try {
      const created = await api.post<Proposal>("/proposals/generate", {
        projectType,
        clientDescription,
        budget: budget ? Number(budget) : null,
        deadline: deadline || null,
        language,
        clientId: clientId ? Number(clientId) : null,
        title: title || undefined,
      });
      toast.success("Propuesta generada");
      setShowGen(false);
      setProjectType("");
      setClientDescription("");
      setBudget("");
      setDeadline("");
      setTitle("");
      setClientId("");
      await reload();
      setViewing(created);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error generando");
    } finally {
      setGenerating(false);
    }
  }

  async function setStatus(p: Proposal, status: ProposalStatus) {
    try {
      const updated = await api.put<Proposal>(`/proposals/${p.id}`, {
        title: p.title,
        content: p.content,
        status,
        clientId: p.clientId,
      });
      setProposals((arr) => arr.map((x) => (x.id === p.id ? updated : x)));
      if (viewing?.id === p.id) setViewing(updated);
      toast.success("Estado actualizado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  }

  async function del(id: number) {
    if (!confirm("¿Eliminar propuesta?")) return;
    try {
      await api.del(`/proposals/${id}`);
      setProposals((arr) => arr.filter((p) => p.id !== id));
      toast.success("Eliminada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  }

  async function copy(content: string) {
    await navigator.clipboard.writeText(content);
    toast.success("Copiado al portapapeles");
  }

  async function exportPdf() {
    if (!viewRef.current || !viewing) return;
    const mod = await import("html2pdf.js");
    const html2pdf = (mod as unknown as { default: (typeof mod)["default"] }).default;
    await html2pdf()
      .set({
        margin: 12,
        filename: `${viewing.title.replace(/\s+/g, "_")}.pdf`,
        html2canvas: { scale: 2 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(viewRef.current)
      .save();
  }

  const filtered = filter === "all" ? proposals : proposals.filter((p) => p.status === filter);

  return (
    <>
      <PageHeader
        title="Propuestas"
        subtitle="Genera propuestas profesionales con IA"
        actions={
          <button className="btn-primary" onClick={() => setShowGen(true)}>
            + Nueva propuesta
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <FilterButton current={filter} value="all" onClick={setFilter} label="Todas" />
        {statusOptions.map((s) => (
          <FilterButton
            key={s.value}
            current={filter}
            value={s.value}
            onClick={setFilter}
            label={s.label}
          />
        ))}
      </div>

      {loading ? (
        <div className="grid h-64 place-items-center">
          <Spinner size={28} />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="📝"
          title="Sin propuestas todavía"
          description="Genera tu primera propuesta con IA en segundos."
          action={
            <button className="btn-primary" onClick={() => setShowGen(true)}>
              Generar propuesta
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <div key={p.id} className="card flex flex-col">
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="line-clamp-2 text-base font-semibold">{p.title}</h3>
                {statusBadge(p.status)}
              </div>
              <p className="line-clamp-3 flex-1 text-sm text-slate-500">{p.content}</p>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <span>{p.projectType}</span>
                <span>{new Date(p.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="btn-secondary text-xs" onClick={() => setViewing(p)}>
                  Ver
                </button>
                <button className="btn-ghost text-xs" onClick={() => copy(p.content)}>
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
          ))}
        </div>
      )}

      {/* Generate modal */}
      <Modal
        open={showGen}
        onClose={() => setShowGen(false)}
        title="Generar propuesta con IA"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setShowGen(false)}>
              Cancelar
            </button>
            <button
              className="btn-primary"
              onClick={(e) => onGenerate(e as unknown as FormEvent)}
              disabled={generating}
            >
              {generating ? <Spinner /> : "Generar"}
            </button>
          </>
        }
      >
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={onGenerate}>
          <div className="md:col-span-2">
            <label className="label">Título (opcional)</label>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="App de gestión interna"
            />
          </div>
          <div>
            <label className="label">Tipo de proyecto</label>
            <input
              className="input"
              required
              value={projectType}
              onChange={(e) => setProjectType(e.target.value)}
              placeholder="Landing, e-commerce, app web..."
            />
          </div>
          <div>
            <label className="label">Cliente asociado</label>
            <select
              className="input"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">— Ninguno —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="label">Descripción del cliente / brief</label>
            <textarea
              className="input min-h-[100px]"
              required
              value={clientDescription}
              onChange={(e) => setClientDescription(e.target.value)}
              placeholder="Qué necesita, contexto, objetivos..."
            />
          </div>
          <div>
            <label className="label">Presupuesto (€)</label>
            <input
              type="number"
              className="input"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Plazo</label>
            <input
              className="input"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              placeholder="2 semanas, antes del 15/06..."
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
        </form>
      </Modal>

      {/* View modal */}
      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing?.title || "Propuesta"}
        maxWidth="max-w-3xl"
        footer={
          viewing && (
            <>
              <select
                className="input max-w-[180px]"
                value={viewing.status}
                onChange={(e) => setStatus(viewing, e.target.value as ProposalStatus)}
              >
                {statusOptions.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <button className="btn-secondary" onClick={() => copy(viewing.content)}>
                Copiar
              </button>
              <button className="btn-secondary" onClick={exportPdf}>
                Exportar PDF
              </button>
              <button className="btn-ghost" onClick={() => setViewing(null)}>
                Cerrar
              </button>
            </>
          )
        }
      >
        {viewing && (
          <div ref={viewRef} className="space-y-4">
            <div className="text-xs text-slate-500">
              {viewing.projectType} ·{" "}
              {new Date(viewing.createdAt).toLocaleDateString()}
            </div>
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {viewing.content}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

function FilterButton({
  current,
  value,
  onClick,
  label,
}: {
  current: string;
  value: ProposalStatus | "all";
  onClick: (v: ProposalStatus | "all") => void;
  label: string;
}) {
  const active = current === value;
  return (
    <button
      onClick={() => onClick(value)}
      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
        active
          ? "bg-brand-600 text-white"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
      }`}
    >
      {label}
    </button>
  );
}

function statusBadge(status: string) {
  const opt = statusOptions.find((s) => s.value === status);
  return <span className={opt?.cls || "badge-gray"}>{opt?.label || status}</span>;
}
