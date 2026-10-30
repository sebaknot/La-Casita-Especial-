"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { Icon, type IconName } from "@/components/icons";

const LINKS: { href: string; icon: IconName; key: "home" | "pillars" | "add" | "countdowns" | "settings" }[] = [
  { href: "/", icon: "home", key: "home" },
  { href: "/pillars", icon: "grid", key: "pillars" },
  { href: "/add", icon: "plus", key: "add" },
  { href: "/countdowns", icon: "hourglass", key: "countdowns" },
  { href: "/settings", icon: "settings", key: "settings" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/pillars") return pathname.startsWith("/pillars") || pathname.startsWith("/p/");
  return pathname.startsWith(href);
}

/** Bottom tab bar on phones, a slim rail on wider screens. */
export function AppNav({ variant }: { variant: "bottom" | "side" }) {
  const pathname = usePathname();
  const { t } = useI18n();

  if (variant === "bottom")
    return (
      <nav
        aria-label={t.app.title}
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur md:hidden"
      >
        <ul className="mx-auto flex max-w-lg items-stretch justify-around">
          {LINKS.map((link) => {
            const active = isActive(pathname, link.href);
            const isAdd = link.key === "add";
            return (
              <li key={link.href} className="flex-1">
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-16 flex-col items-center justify-center gap-0.5 text-[0.72rem] font-medium ${
                    active ? "text-primary-strong" : "text-ink-faint"
                  }`}
                >
                  <span
                    className={`flex items-center justify-center rounded-full ${
                      isAdd ? "h-10 w-10 bg-primary text-white shadow-sm" : active ? "h-8 w-12 bg-primary-soft" : "h-8 w-12"
                    }`}
                  >
                    <Icon name={link.icon} className={isAdd ? "h-6 w-6" : "h-5 w-5"} />
                  </span>
                  <span className={isAdd ? "sr-only" : undefined}>{t.nav[link.key]}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );

  return (
      <nav aria-label={t.app.title}>
        <ul className="sticky top-4 flex flex-col gap-1">
          {LINKS.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-lg px-3 font-medium ${
                    active ? "bg-primary-soft text-primary-strong" : "text-ink-dim hover:bg-sunk hover:text-ink"
                  }`}
                >
                  <Icon name={link.icon} />
                  {t.nav[link.key]}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
  );
}
