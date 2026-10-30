import { LoginForm } from "@/components/LoginForm";
import { LangToggle } from "@/components/LangToggle";
import { getT } from "@/lib/session";

export default async function LoginPage() {
  const t = await getT();
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{t.app.title}</h1>
          <p className="mt-1 text-ink-dim">{t.app.tagline}</p>
        </div>
        <LangToggle />
      </div>
      <LoginForm />
    </main>
  );
}
