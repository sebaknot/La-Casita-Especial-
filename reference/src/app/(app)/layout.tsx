import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { resolveRole } from "@/lib/auth/roles";
import { Sidebar } from "@/components/Sidebar";
import { CommandBar } from "@/components/CommandBar";
import { ToastProvider } from "@/components/Toast";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Defense in depth — the proxy already guards, but layouts shouldn't trust it.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!resolveRole(user?.email)) redirect("/login");

  const cookieStore = await cookies();
  const sidebarCollapsed =
    cookieStore.get("sovereign_sidebar")?.value === "collapsed";

  return (
    <ToastProvider>
      <div className="flex min-h-screen">
        <Sidebar initialCollapsed={sidebarCollapsed} />
        <div className="flex min-w-0 flex-1 flex-col">
          <CommandBar />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-6">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
