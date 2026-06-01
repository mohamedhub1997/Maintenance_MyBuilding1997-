import React, { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useT } from "../i18n";
import LanguageToggle from "./LanguageToggle";
import NotificationToggle from "./NotificationToggle";
import { Home, LogOut, Menu, X } from "lucide-react";

export default function RoleLayout({ navItems, titleKey, roleLabelKey }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const t = useT();

  const doLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const title = t(titleKey);
  const roleLabel = t(roleLabelKey);

  return (
    <div className="min-h-screen flex bg-bg text-slate-100">
      {/* Sidebar - desktop */}
      <aside className="hidden md:flex md:w-64 lg:w-72 flex-col border-r border-slate-800 bg-bg sticky top-0 h-screen">
        <SidebarContent
          navItems={navItems}
          title={title}
          roleLabel={roleLabel}
          user={user}
          doLogout={doLogout}
          t={t}
        />
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 bg-bg border-b border-slate-800 flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-accent flex items-center justify-center">
            <Home className="w-4 h-4 text-bg" strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-[10px] uppercase text-slate-400 tracking-wider">{roleLabel}</div>
            <div className="text-sm font-bold">{title}</div>
          </div>
        </div>
        <button
          data-testid="mobile-menu-toggle"
          onClick={() => setOpen(true)}
          className="p-2 text-slate-300"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile sidebar drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="relative w-72 bg-bg border-r border-slate-800 flex flex-col">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 text-slate-300 p-1"
              data-testid="mobile-menu-close"
            >
              <X className="w-5 h-5" />
            </button>
            <SidebarContent
              navItems={navItems}
              title={title}
              roleLabel={roleLabel}
              user={user}
              doLogout={doLogout}
              t={t}
              onNav={() => setOpen(false)}
            />
          </aside>
        </div>
      )}

      <main className="flex-1 min-w-0 pt-16 md:pt-0">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function SidebarContent({ navItems, title, roleLabel, user, doLogout, t, onNav }) {
  return (
    <>
      <div className="px-6 py-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
            <Home className="w-5 h-5 text-bg" strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-[10px] uppercase text-slate-400 tracking-widest">{roleLabel}</div>
            <div className="font-bold text-lg leading-tight">{title}</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNav}
            data-testid={`nav-${item.testid}`}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition ${
                isActive
                  ? "bg-accent/15 text-accent"
                  : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
              }`
            }
          >
            <item.icon className="w-4 h-4" />
            {t(item.labelKey)}
          </NavLink>
        ))}
      </nav>
      <LanguageToggle />
      <NotificationToggle />
      <div className="px-3 py-3 border-t border-slate-800">
        <div className="px-3 py-2 mb-1">
          <div className="text-xs text-slate-400">{t("common.signedInAs")}</div>
          <div className="text-sm font-medium truncate">{user?.full_name || user?.username}</div>
        </div>
        <button
          data-testid="logout-button"
          onClick={doLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-slate-300 hover:text-red-400 hover:bg-red-500/5 transition"
        >
          <LogOut className="w-4 h-4" />
          {t("common.signOut")}
        </button>
      </div>
    </>
  );
}
