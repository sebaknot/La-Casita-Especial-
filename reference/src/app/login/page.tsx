import type { Metadata } from "next";
import { LoginForm } from "@/components/LoginForm";

export const metadata: Metadata = { title: "Login" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="stagger-1 mb-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg border border-hairline bg-surface">
            <span className="font-display text-2xl text-brass">S</span>
          </div>
          <h1 className="font-display text-3xl font-semibold">Sovereign</h1>
          <p className="eyebrow mt-2">Command Center</p>
        </div>
        <div className="stagger-2">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
