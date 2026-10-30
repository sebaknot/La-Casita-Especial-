import type { Metadata, Viewport } from "next";
import "./globals.css";
import { I18nProvider } from "@/components/I18nProvider";
import { ToastProvider } from "@/components/Toast";
import { dict } from "@/i18n";
import { getLocale } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = dict(await getLocale());
  return {
    title: { default: t.app.title, template: `%s · ${t.app.title}` },
    description: t.app.tagline,
    applicationName: t.app.title,
    appleWebApp: { capable: true, title: "La Casita", statusBarStyle: "default" },
    icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  };
}

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html lang={locale} className="h-full">
      <body className="min-h-full">
        <I18nProvider locale={locale}>
          <ToastProvider>{children}</ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
