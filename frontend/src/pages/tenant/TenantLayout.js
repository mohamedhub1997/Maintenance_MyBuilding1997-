import React from "react";
import RoleLayout from "../../components/RoleLayout";
import { ClipboardList, PlusCircle } from "lucide-react";

const items = [
  { to: "/tenant", end: true, labelKey: "nav.myTickets", icon: ClipboardList, testid: "my-tickets" },
  { to: "/tenant/new", labelKey: "nav.newTicket", icon: PlusCircle, testid: "new-ticket" },
];

export default function TenantLayout() {
  return <RoleLayout navItems={items} titleKey="common.appName" roleLabelKey="common.tenant" />;
}
