import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Spinner from "./components/Spinner";
import { useAuth } from "./contexts/AuthContext";
import Clients from "./pages/Clients";
import Dashboard from "./pages/Dashboard";
import Emails from "./pages/Emails";
import Income from "./pages/Income";
import Invoices from "./pages/Invoices";
import Leads from "./pages/Leads";
import Login from "./pages/Login";
import Outbox from "./pages/Outbox";
import PortfolioEditor from "./pages/PortfolioEditor";
import PortfolioPublic from "./pages/PortfolioPublic";
import Pricing from "./pages/Pricing";
import Profiles from "./pages/Profiles";
import Proposals from "./pages/Proposals";
import Register from "./pages/Register";
import Settings from "./pages/Settings";

function Protected({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="grid h-screen place-items-center">
        <Spinner size={32} />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function Public({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      {/* Fully public portfolio — no auth, no layout */}
      <Route path="/p/:slug" element={<PortfolioPublic />} />

      <Route
        path="/login"
        element={
          <Public>
            <Login />
          </Public>
        }
      />
      <Route
        path="/register"
        element={
          <Public>
            <Register />
          </Public>
        }
      />
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="proposals" element={<Proposals />} />
        <Route path="pricing" element={<Pricing />} />
        <Route path="profiles" element={<Profiles />} />
        <Route path="emails" element={<Emails />} />
        <Route path="clients" element={<Clients />} />
        <Route path="income" element={<Income />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="leads" element={<Leads />} />
        <Route path="outbox" element={<Outbox />} />
        <Route path="portfolio" element={<PortfolioEditor />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
