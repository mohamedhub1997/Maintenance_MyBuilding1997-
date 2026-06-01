import React from "react";
import RoleLayout from "../../components/RoleLayout";
import { Wrench } from "lucide-react";

const items = [
  { to: "/maintenance", end: true, labelKey: "nav.myAssignments", icon: Wrench, testid: "my-assignments" },
];

export default function MaintenanceLayout() {
  return <RoleLayout navItems={items} titleKey="common.maintenance" roleLabelKey="common.technician" />;
}
