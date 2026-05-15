import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Lead, LeadStatus, Language } from "@freelance/shared";
import { api } from "../lib/api";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import Spinner from "../components/Spinner";
import EmptyState from "../components/EmptyState";

const STATUSES: { value: LeadStatus; label: string; cls: string }[] = [
  { value: "new", label: "Nuevo", cls: "badge-gray" },
  { value: "audited", label: "Auditado", cls: "badge-blue" },
  { value: "contacted", label: "Contactado", cls: "badge-yellow" },
  { value: "interested", label: "Interesado", cls: "badge-purple" },
  { value: "converted", label: "Convertido", cls: "badge-green" },
  { value: "rejected", label: "Descartado", cls: "badge-rose" },
];

const empty = {
  name: "",
  website: "",
  email: "",
  phone: "",
  city: "",
  niche: "",
  source: "",
  status: "new" as LeadStatus,
  notes: "",
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [auditingId, setAuditingId] = useState<number | null>(null);
  const [auditingAll, setAuditingAll] = useState(false);

  const [viewing, setViewing] = useState<Lead | null>(null);
  const [outreach, setOutreach] = useState<{ subject: string; body: string } | null>(null);
  const [outreachLoading, setOutreachLoading] = useState(false);
  const [outreachLang, setOutreachLang] = useState<Language>("es");

  const [importOpen, setImportOpen] = useState(false);
  const [csv, setCsv] = useState("");
  const [importing, setImporting] = useState(false);

  function load() {
    return api.get<Lead[]>("/leads").then(setLeads);
  }
  useEffect(() => {
    load()
      .catch((e) => toast.error(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoading(false));
  }, []);

  function openNew() {
    setEditing(null);
    setForm(empty);
    setShow(true);
  }
  function openEdit(l: Lead) {
    setEditing(l);
    setForm({
      name: l.name,
      website: l.website || "",
      email: l.email || "",
      phone: l.phone || "",
      city: l.city || "",
      niche: l.niche || "",
      source: l.source || "",
      status: l.status,
      notes: l.notes || "",
    });
    setShow(true);
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        website: form.website || null,
        email: form.email || null,
        phone: form.phone || null,
        city: form.city || null,
        niche: form.niche || null,
        source: form.source || null,
        status: form.status,
        notes: form.notes || null,
      };
      if (editing) {
        const saved = await api.put<Lead>(`/leads/${editing.id}`, payload);
        setLeads((arr) => arr.map((x) => (x.id === saved.id ? saved : x)));
      } else {
        const saved = await api.post<Lead>("/leads", payload);
        setLeads((arr) => [saved, ...arr]);
      }
      setShow(false);
      toast.success("Lead guardado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function del(id: number) {
    if (!confirm("¿Eliminar lead?")) return;
    try {
      await api.del(`/leads/${id}`);
      setLeads((arr) => arr.filter((l) => l.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  }

  async function audit(id: number) {
    setAuditingId(id);
    try {
      const saved = await api.post<Lead>(`/leads/${id}/audit`, {});
      setLeads((arr) => arr.map((x) => (x.id === saved.id ? saved : x)));
      toast.success("Auditoría completada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setAuditingId(null);
    }
  }

  async function auditAll() {
    setAuditingAll(true);
    try {
      const r = await api.post<{ updated: number }>("/leads/audit-all", {});
      toast.success(`Auditados ${r.updated} leads`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setAuditingAll(false);
    }
  }

  async function generateOutreach(lead: Lead) {
    setOutreach(null);
    setOutreachLoading(true);
    try {
      const r = await api.post<{ subject: string; body: string }>(
        `/leads/${lead.id}/outreach`,
        { language: outreachLang }
      );
      setOutreach(r);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setOutreachLoading(false);
    }
  }

  async function doImport() {
    const rows = parseCsv(csv);
    if (rows.length === 0) {
      toast.error("CSV vacío o mal formado");
      return;
    }
    setImporting(true);
    try {
      const r = await api.post<{ imported: number }>("/leads/import", rows);
      toast.success(`${r.imported} leads importados`);
      setImportOpen(false);
      setCsv("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Leads"
        subtitle="Prospección con auditor de webs y outreach automático"
        actions={
          <>
            <button className="btn-secondary" onClick={() => setImportOpen(true)}>
              Importar CSV
            </button>
            <button className="btn-secondary" onClick={auditAll} disabled={auditingAll}>
              {auditingAll ? <Spinner /> : "Auditar todos"}
            </button>
            <button className="btn-primary" onClick={openNew}>
              + Nuevo lead
            </button>
          </>
        }
      />

      {loading ? (
        <div className="grid h-64 place-items-center">
          <Spinner size={28} />
        </div>
      ) : leads.length === 0 ? (
        <EmptyState
          icon="🎯"
          title="Sin leads aún"
          description="Añade prospectos a mano, audita sus webs y genera un email personalizado para cada uno."
          action={
            <button className="btn-primary" onClick={openNew}>
              Añadir primer lead
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {leads.map((l) => {
            const s = STATUSES.find((x) => x.value === l.status);
            const score = l.audit?.score ?? null;
            return (
              <div key={l.id} className="card flex flex-col">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <h3 className="text-base font-semibold">{l.name}</h3>
                  <span className={s?.cls}>{s?.label}</span>
                </div>
                <div className="mb-2 space-y-0.5 text-xs text-slate-500">
                  {l.website && (
                    <div className="truncate">
                      🌐{" "}
                      <a
                        href={l.website}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-600 hover:underline"
                      >
                        {l.website}
                      </a>
                    </div>
                  )}
                  {l.email && <div>✉️ {l.email}</div>}
                  {l.city && <div>📍 {l.city}</div>}
                  {l.niche && <div>🏷️ {l.niche}</div>}
                </div>

                {score !== null && (
                  <div className="mb-2 rounded-md bg-slate-50 p-2 text-xs dark:bg-slate-800">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="font-medium">
                        Score oportunidad: {score}/100
                      </span>
                      <span
                        className={`h-2 w-16 rounded-full ${
                          score > 50
                            ? "bg-emerald-500"
                            : score > 25
                              ? "bg-amber-500"
                              : "bg-slate-300"
                        }`}
                      />
                    </div>
                    {l.audit?.signals.slice(0, 2).map((s, i) => (
                      <div key={i} className="text-slate-500">
                        {s}
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-auto flex flex-wrap gap-1 pt-2">
                  <button
                    className="btn-ghost text-xs"
                    onClick={() => audit(l.id)}
                    disabled={!l.website || auditingId === l.id}
                  >
                    {auditingId === l.id ? <Spinner /> : "Auditar"}
                  </button>
                  <button className="btn-ghost text-xs" onClick={() => setViewing(l)}>
                    Ver / outreach
                  </button>
                  <button className="btn-ghost text-xs" onClick={() => openEdit(l)}>
                    Editar
                  </button>
                  <button
                    className="btn-ghost text-xs text-rose-600"
                    onClick={() => del(l.id)}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/edit modal */}
      <Modal
        open={show}
        onClose={() => setShow(false)}
        title={editing ? "Editar lead" : "Nuevo lead"}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setShow(false)}>
              Cancelar
            </button>
            <button
              className="btn-primary"
              onClick={(e) => onSave(e as unknown as FormEvent)}
              disabled={saving}
            >
              {saving ? <Spinner /> : "Guardar"}
            </button>
          </>
        }
      >
        <form className="grid grid-cols-1 gap-3 md:grid-cols-2" onSubmit={onSave}>
          <div className="md:col-span-2">
            <label className="label">Nombre del negocio</label>
            <input
              className="input"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <label className="label">Web</label>
            <input
              className="input"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              placeholder="https://"
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Teléfono</label>
            <input
              className="input"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Ciudad</label>
            <input
              className="input"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Nicho / sector</label>
            <input
              className="input"
              value={form.niche}
              onChange={(e) => setForm({ ...form, niche: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Fuente</label>
            <input
              className="input"
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              placeholder="Google Maps, LinkedIn..."
            />
          </div>
          <div>
            <label className="label">Estado</label>
            <select
              className="input"
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as LeadStatus })
              }
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="label">Notas</label>
            <textarea
              className="input min-h-[80px]"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </form>
      </Modal>

      {/* View / outreach */}
      <Modal
        open={!!viewing}
        onClose={() => {
          setViewing(null);
          setOutreach(null);
        }}
        title={viewing?.name || ""}
        maxWidth="max-w-3xl"
      >
        {viewing && (
          <div className="space-y-4">
            {viewing.audit ? (
              <div className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
                <div className="mb-2 flex flex-wrap items-center gap-3">
                  <div>
                    <strong>Score:</strong> {viewing.audit.score}/100
                  </div>
                  <div>
                    <strong>Velocidad:</strong>{" "}
                    {viewing.audit.responseTimeMs
                      ? `${viewing.audit.responseTimeMs} ms`
                      : "—"}
                  </div>
                  <div>
                    <strong>HTTPS:</strong> {viewing.audit.https ? "✅" : "❌"}
                  </div>
                  <div>
                    <strong>Responsive:</strong>{" "}
                    {viewing.audit.responsiveMeta ? "✅" : "❌"}
                  </div>
                  {viewing.audit.generator && (
                    <div>
                      <strong>CMS:</strong> {viewing.audit.generator}
                    </div>
                  )}
                </div>
                <div className="mb-2">
                  <strong>Señales:</strong>
                  <ul className="ml-4 mt-1 list-disc text-slate-600 dark:text-slate-300">
                    {viewing.audit.signals.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
                {viewing.audit.opportunities.length > 0 && (
                  <div>
                    <strong>Oportunidades para vender:</strong>
                    <ul className="ml-4 mt-1 list-disc text-slate-600 dark:text-slate-300">
                      {viewing.audit.opportunities.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500 dark:border-slate-700">
                Aún no auditado.{" "}
                <button
                  className="text-brand-600 hover:underline"
                  onClick={() => audit(viewing.id)}
                >
                  Auditar ahora
                </button>
              </div>
            )}

            <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <div className="mb-2 flex items-center justify-between gap-2">
                <strong className="text-sm">Email de outreach personalizado</strong>
                <div className="flex items-center gap-2">
                  <select
                    className="input max-w-[90px]"
                    value={outreachLang}
                    onChange={(e) => setOutreachLang(e.target.value as Language)}
                  >
                    <option value="es">ES</option>
                    <option value="en">EN</option>
                  </select>
                  <button
                    className="btn-primary text-xs"
                    onClick={() => generateOutreach(viewing)}
                    disabled={outreachLoading}
                  >
                    {outreachLoading ? <Spinner /> : "Generar"}
                  </button>
                </div>
              </div>

              {outreach && (
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-xs uppercase text-slate-500">Asunto:</span>
                    <div className="font-medium">{outreach.subject}</div>
                  </div>
                  <div>
                    <span className="text-xs uppercase text-slate-500">Cuerpo:</span>
                    <div className="whitespace-pre-wrap">{outreach.body}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="btn-ghost text-xs"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `Asunto: ${outreach.subject}\n\n${outreach.body}`
                        );
                        toast.success("Copiado");
                      }}
                    >
                      Copiar
                    </button>
                    {viewing.email && (
                      <a
                        className="btn-ghost text-xs"
                        href={`mailto:${viewing.email}?subject=${encodeURIComponent(outreach.subject)}&body=${encodeURIComponent(outreach.body)}`}
                      >
                        Abrir en mail
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Import CSV */}
      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Importar leads desde CSV"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setImportOpen(false)}>
              Cancelar
            </button>
            <button className="btn-primary" onClick={doImport} disabled={importing}>
              {importing ? <Spinner /> : "Importar"}
            </button>
          </>
        }
      >
        <p className="mb-2 text-sm text-slate-500">
          Pega un CSV con cabecera. Columnas reconocidas:{" "}
          <code>name, website, email, phone, city, niche, source, notes</code>. La única
          obligatoria es <code>name</code>.
        </p>
        <textarea
          className="input min-h-[260px] font-mono text-xs"
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          placeholder={`name,website,email,city,niche\nEstudio Foto Lopez,https://fotolopez.es,info@fotolopez.es,Madrid,fotografia\n...`}
        />
      </Modal>
    </>
  );
}

// ---- CSV parsing (minimal, handles quoted fields & commas) ----
function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (cells[idx] || "").trim();
    });
    if (row.name) rows.push(row);
  }
  return rows;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}
