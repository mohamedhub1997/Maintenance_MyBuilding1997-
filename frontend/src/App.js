import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminTenants from "./pages/admin/AdminTenants";
import AdminMaintenance from "./pages/admin/AdminMaintenance";
import AdminUnits from "./pages/admin/AdminUnits";
import AdminTickets from "./pages/admin/AdminTickets";
import AdminNewTicket from "./pages/admin/AdminNewTicket";
import TicketDetail from "./pages/TicketDetail";
import TenantLayout from "./pages/tenant/TenantLayout";
import TenantHome from "./pages/tenant/TenantHome";
import TenantNewTicket from "./pages/tenant/TenantNewTicket";
import MaintenanceLayout from "./pages/maintenance/MaintenanceLayout";
import MaintenanceHome from "./pages/maintenance/MaintenanceHome";

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "admin") return <Navigate to="/admin" replace />;
  if (user.role === "tenant") return <Navigate to="/tenant" replace />;
  return <Navigate to="/maintenance" replace />;
}

function Protected({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function Loader() {
  return (
    <div className="flex items-center justify-center h-screen bg-bg">
      <div className="text-slate-400 text-sm">Loading…</div>
    </div>
  );
}

// Stable role-array references for <Protected roles={...}>
const ADMIN_ROLES = ["admin"];
const TENANT_ROLES = ["tenant"];
const MAINTENANCE_ROLES = ["maintenance"];

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/admin"
        element={
          <Protected roles={ADMIN_ROLES}>
            <AdminLayout />
          </Protected>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="tickets" element={<AdminTickets />} />
        <Route path="tickets/new" element={<AdminNewTicket />} />
        <Route path="tickets/:id" element={<TicketDetail />} />
        <Route path="tenants" element={<AdminTenants />} />
        <Route path="maintenance" element={<AdminMaintenance />} />
        <Route path="units" element={<AdminUnits />} />
      </Route>

      <Route
        path="/tenant"
        element={
          <Protected roles={TENANT_ROLES}>
            <TenantLayout />
          </Protected>
        }
      >
        <Route index element={<TenantHome />} />
        <Route path="new" element={<TenantNewTicket />} />
        <Route path="tickets/:id" element={<TicketDetail />} />
      </Route>

      <Route
        path="/maintenance"
        element={
          <Protected roles={MAINTENANCE_ROLES}>
            <MaintenanceLayout />
          </Protected>
        }
      >
        <Route index element={<MaintenanceHome />} />
        <Route path="tickets/:id" element={<TicketDetail />} />
      </Route>

      <Route path="/" element={<HomeRedirect />} />
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}
