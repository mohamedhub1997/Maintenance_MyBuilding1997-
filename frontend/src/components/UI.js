import React from "react";
import { useT } from "../i18n";

export function StatusBadge({ status }) {
  const t = useT();
  const map = {
    open: "badge-open",
    in_progress: "badge-progress",
    resolved: "badge-resolved",
  };
  const cls = map[status] || map.open;
  return (
    <span className={`badge ${cls}`} data-testid={`status-${status}`}>
      {t(`status.${status}`)}
    </span>
  );
}

const PRIORITY_COLORS = {
  high: "#ef4444",
  low: "#94a3b8",
  medium: "#f59e0b",
};

export function PriorityDot({ priority }) {
  const color = PRIORITY_COLORS[priority] || PRIORITY_COLORS.medium;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      {priority}
    </span>
  );
}

export function EmptyState({ title, subtitle, icon: Icon, action }) {
  return (
    <div className="card p-10 text-center">
      {Icon && <Icon className="w-10 h-10 text-slate-500 mx-auto mb-4" strokeWidth={1.5} />}
      <h3 className="text-lg font-semibold">{title}</h3>
      {subtitle && <p className="text-slate-400 text-sm mt-1">{subtitle}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, size = "md" }) {
  if (!open) return null;
  const widths = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm fade-in"
      onClick={onClose}
    >
      <div
        className={`card w-full ${widths[size]} max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button
            onClick={onClose}
            data-testid="modal-close-button"
            className="text-slate-400 hover:text-white text-xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

/**
 * Renders one of three states (loading, empty, content) without nested ternaries.
 * Pass `loading`, `isEmpty`, and the corresponding render slots.
 */
export function AsyncList({ loading, isEmpty, loadingNode, emptyNode, children }) {
  if (loading) return loadingNode ?? <div className="text-slate-400 text-sm">Loading…</div>;
  if (isEmpty) return emptyNode;
  return children;
}
