import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/OnboardingForm";
import { LangToggle } from "@/components/LangToggle";
import { acceptInvite } from "@/lib/actions";
import { getSession, getT } from "@/lib/session";

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  if (session.household) redirect("/");
  // Invited partners skip setup and land in the shared household.
  if (await acceptInvite()) redirect("/");

  const t = await getT();
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{t.onboarding.title}</h1>
          <p className="mt-1 text-ink-dim">{t.onboarding.intro}</p>
        </div>
        <LangToggle />
      </div>
      <OnboardingForm />
    </main>
  );
}
