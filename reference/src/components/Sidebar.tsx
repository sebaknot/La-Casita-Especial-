"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/lib/actions";
import {
  IconChevron,
  IconCircuit,
  IconCommand,
  IconExit,
  IconGrid,
  IconKeystone,
  IconLedger,
  IconMenu,
  IconRoute,
  IconScales,
  IconSeal,
  IconShield,
} from "@/components/icons";

const NAV = [
  { href: "/", label: "Command", Icon: IconCommand },
  { href: "/taxonomy", label: "Taxonomy", Icon: IconLedger },
  { href: "/unit77", label: "Unit 77", Icon: IconCircuit },
  { href: "/porter", label: "Porter", Icon: IconRoute },
  { href: "/mortgages", label: "Mortgages", Icon: IconKeystone },
  { href: "/lawschool", label: "Law School", Icon: IconScales },
  { href: "/cpa", label: "CPA Exam", Icon: IconSeal },
  { href: "/fastc", label: "FASTC", Icon: IconShield },
  { href: "/personal", label: "Personal", Icon: IconGrid },
];

export function Sidebar({ initialCollapsed }: { initialCollapsed: boolean }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  function toggle() {
    setCollapsed((current) => {
      document.cookie = `sovereign_sidebar=${
        current ? "expanded" : "collapsed"
      }; path=/; max-age=31536000; samesite=lax`;
      return !current;
    });
  }

  function renderNav(isCollapsed: boolean) {
    return (
      <nav className="flex flex-1 flex-col gap-1 px-2">
        {NAV.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              title={isCollapsed ? label : undefined}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 rounded-md border px-2.5 py-2 text-sm transition-colors ${
                active
                  ? "border-brass-soft/60 bg-brass/10 text-brass"
                  : "border-transparent text-ink-dim hover:bg-raised hover:text-ink"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!isCollapsed && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <>
      {/* Mobile top bar trigger */}
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
        className="fixed left-3 top-3 z-40 rounded-md border border-hairline bg-surface p-2 text-ink-dim md:hidden"
      >
        <IconMenu className="h-5 w-5" />
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-hairline bg-surface py-4">
            <SidebarHeader collapsed={false} />
            {renderNav(false)}
            <SidebarFooter collapsed={false} />
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside
        className={`stagger-1 sticky top-0 hidden h-screen shrink-0 flex-col border-r border-hairline bg-surface py-4 md:flex ${
          collapsed ? "w-16" : "w-56"
        } transition-[width] duration-150`}
      >
        <SidebarHeader collapsed={collapsed} />
        {renderNav(collapsed)}
        <button
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="mx-2 mb-1 flex items-center justify-center rounded-md border border-transparent py-1.5 text-ink-faint hover:bg-raised hover:text-ink"
        >
          <IconChevron
            className={`h-4 w-4 transition-transform ${collapsed ? "" : "rotate-180"}`}
          />
        </button>
        <SidebarFooter collapsed={collapsed} />
      </aside>
    </>
  );
}

function SidebarHeader({ collapsed }: { collapsed: boolean }) {
  return (
    <div
      className={`mb-6 flex items-center gap-3 px-4 ${collapsed ? "justify-center px-0" : ""}`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-hairline bg-obsidian font-display text-lg text-brass">
        S
      </span>
      {!collapsed && (
        <div className="min-w-0">
          <p className="font-display text-base font-semibold leading-tight">
            Sovereign
          </p>
          <p className="eyebrow">Command</p>
        </div>
      )}
    </div>
  );
}

function SidebarFooter({ collapsed }: { collapsed: boolean }) {
  return (
    <form action={signOut} className="px-2">
      <button
        type="submit"
        title="Sign out"
        className={`flex w-full items-center gap-3 rounded-md border border-transparent px-2.5 py-2 text-sm text-ink-faint hover:bg-raised hover:text-ink ${
          collapsed ? "justify-center" : ""
        }`}
      >
        <IconExit className="h-5 w-5 shrink-0" />
        {!collapsed && <span>Sign out</span>}
      </button>
    </form>
  );
}
