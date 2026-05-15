import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardMetrics } from "@freelance/shared";
import { api } from "../lib/api";
import PageHeader from "../components/PageHeader";
import Spinner from "../components/Spinner";

const tools = [
  {
    to: "/proposals",
    label: "Nueva propuesta",
    icon: "📝",
    color: "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300",
  },
  {
    to: "/pricing",
    label: "Calcular precio",
    icon: "💶",
    color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  {
    to: "/profiles",
    label: "Generar perfil",
    icon: "👤",
    color: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  },
  {
    to: "/emails",
    label: "Redactar email",
    icon: "✉️",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
];

function statusBadge(status: string) {
  switch (status) {
    case "active":
      return <span className="badge-green">Activo</span>;
    case "recurring":
      return <span className="badge-purple">Recurrente</span>;
    case "potential":
      return <span className="badge-yellow">Potencial</span>;
    default:
      return <span className="badge-gray">Inactivo</span>;
  }
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<DashboardMetrics>("/dashboard/metrics")
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid h-64 place-items-center">
        <Spinner size={28} />
      </div>
    );
  }
  if (!data) return null;

  const chartData = data.monthlyIncomeSeries.map((p) => ({
    month: p.month.slice(5),
    total: p.total,
  }));

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Resumen de tu actividad freelance" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Ingresos del mes"
          value={`${data.monthlyIncome.toLocaleString()} €`}
          hint={`Proyección: ${data.projectedMonthly.toLocaleString()} €`}
          icon="💰"
        />
        <MetricCard
          label="Proyectos activos"
          value={String(data.activeProjects)}
          hint="Clientes en curso"
          icon="🚀"
        />
        <MetricCard
          label="Propuestas enviadas"
          value={String(data.proposalsSent)}
          hint="Histórico total"
          icon="📨"
        />
        <MetricCard
          label="Tasa de conversión"
          value={`${data.conversionRate}%`}
          hint="Aceptadas / enviadas"
          icon="🎯"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Ingresos por mes</h2>
            <span className="text-xs text-slate-500">Últimos 12 meses</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#8b5cf6"
                  fill="url(#g1)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h2 className="mb-3 text-lg font-semibold">Accesos rápidos</h2>
          <div className="grid grid-cols-2 gap-3">
            {tools.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 p-4 text-center transition hover:shadow-sm dark:border-slate-800"
              >
                <span
                  className={`grid h-10 w-10 place-items-center rounded-lg text-lg ${t.color}`}
                >
                  {t.icon}
                </span>
                <span className="text-xs font-medium">{t.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Clientes recientes</h2>
          <Link to="/clients" className="text-sm text-brand-600 hover:underline">
            Ver todos →
          </Link>
        </div>
        {data.recentClients.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            Aún no has añadido clientes.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-500">
                  <th className="py-2 pr-4">Nombre</th>
                  <th className="py-2 pr-4">Empresa</th>
                  <th className="py-2 pr-4">Estado</th>
                  <th className="py-2 pr-4">Email</th>
                </tr>
              </thead>
              <tbody>
                {data.recentClients.map((c) => (
                  <tr
                    key={c.id}
                    className="border-t border-slate-100 dark:border-slate-800"
                  >
                    <td className="py-2 pr-4 font-medium">{c.name}</td>
                    <td className="py-2 pr-4 text-slate-500">{c.company || "—"}</td>
                    <td className="py-2 pr-4">{statusBadge(c.status)}</td>
                    <td className="py-2 pr-4 text-slate-500">{c.email || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function MetricCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: string;
}) {
  return (
    <div className="card">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm text-slate-500">{label}</span>
        <span className="text-xl">{icon}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {hint && (
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</div>
      )}
    </div>
  );
}
