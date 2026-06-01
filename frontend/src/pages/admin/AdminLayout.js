import React from "react";
import RoleLayout from "../../components/RoleLayout";
import { LayoutDashboard, Users, Wrench, Building2, ClipboardList, PlusCircle } from "lucide-react";

const items = [
  { to: "/admin", end: true, labelKey: "nav.dashboard", icon: LayoutDashboard, testid: "dashboard" },
  { to: "/admin/tickets", labelKey: "nav.tickets", icon: ClipboardList, testid: "tickets" },
  { to: "/admin/tickets/new", labelKey: "nav.newTicket", icon: PlusCircle, testid: "new-ticket" },
  { to: "/admin/tenants", labelKey: "nav.tenants", icon: Users, testid: "tenants" },
  { to: "/admin/maintenance", labelKey: "nav.maintenanceStaff", icon: Wrench, testid: "maintenance" },
  { to: "/admin/units", labelKey: "nav.units", icon: Building2, testid: "units" },
];

export default function AdminLayout() {
  return <RoleLayout navItems={items} titleKey="common.adminConsole" roleLabelKey="common.administrator" />;
}
