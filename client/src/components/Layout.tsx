import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useState } from "react";

const navItems = [
  { to: "/", label: "Dashboard", icon: "📊" },
  { to: "/proposals", label: "Propuestas", icon: "📝" },
  { to: "/pricing", label: "Calculadora", icon: "💶" },
  { to: "/profiles", label: "Perfiles", icon: "👤" },
  { to: "/emails", label: "Emails", icon: "✉️" },
  { to: "/clients", label: "Clientes", icon: "👥" },
  { to: "/invoices", label: "Facturas", icon: "🧾" },
  { to: "/income", label: "Ingresos", icon: "📈" },
  { to: "/leads", label: "Leads", icon: "🎯" },
  { to: "/outbox", label: "Outbox", icon: "📤" },
  { to: "/settings", label: "Ajustes", icon: "⚙️" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen">
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden dark:border-slate-800 dark:bg-slate-900">
        <span className="text-lg font-semibold">Pitchfork</span>
        <button
          className="btn-ghost"
          onClick={() => setOpen((v) => !v)}
          aria-label="menu"
        >
          ☰
        </button>
      </div>

      <div className="md:flex">
        <aside
          className={`${
            open ? "block" : "hidden"
          } w-full border-b border-slate-200 bg-white p-4 md:block md:h-screen md:w-64 md:border-b-0 md:border-r dark:border-slate-800 dark:bg-slate-900`}
        >
          <div className="mb-6 hidden items-center gap-2 md:flex">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">
              ✦
            </div>
            <span className="text-lg font-semibold">Pitchfork</span>
          </div>

          <nav className="flex flex-col gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`
                }
              >
                <span aria-hidden>{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-800">
            <div className="mb-3 px-2 text-xs text-slate-500">
              <div className="truncate font-medium">{user?.name}</div>
              <div className="truncate">{user?.email}</div>
            </div>
            <div className="flex flex-col gap-2 px-2">
              <button className="btn-secondary justify-start" onClick={toggle}>
                {theme === "dark" ? "🌙 Modo oscuro" : "☀️ Modo claro"}
              </button>
              <button
                className="btn-ghost justify-start"
                onClick={() => {
                  logout();
                  nav("/login");
                }}
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </aside>

        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
