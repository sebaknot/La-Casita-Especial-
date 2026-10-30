import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { CommandBarProvider } from "@/components/CommandBar";
import { HouseholdProvider } from "@/components/HouseholdProvider";
import { LangToggle } from "@/components/LangToggle";
import { getPeople } from "@/lib/queries";
import { getT, householdTZ, requireHousehold, syncPillars } from "@/lib/session";
import { todayISO } from "@/lib/dates";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireHousehold();
  const t = await getT();
  await syncPillars(session.supabase, session.household.id);
  const people = await getPeople(session.supabase, session.household.id);
  const timezone = householdTZ(session.household);

  return (
    <HouseholdProvider people={people} today={todayISO(timezone)} timezone={timezone}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2"
      >
        {t.nav.skipToContent}
      </a>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
          <Link href="/" className="flex min-h-11 items-center gap-2 font-semibold tracking-tight text-ink">
            <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round">
                <path d="M4 11 12 4l8 7v9H4z" />
                <path d="M10 20v-5h4v5" />
              </svg>
            </span>
            <span>{t.app.title}</span>
          </Link>
          <LangToggle />
        </div>
      </header>
      <CommandBarProvider>
        <div className="mx-auto flex max-w-6xl gap-6 px-4 pt-4 pb-28 md:pb-10">
          <aside className="hidden w-48 shrink-0 md:block">
            <AppNav variant="side" />
          </aside>
          <main id="main" className="min-w-0 flex-1">
            {children}
          </main>
        </div>
        <AppNav variant="bottom" />
      </CommandBarProvider>
    </HouseholdProvider>
  );
}
