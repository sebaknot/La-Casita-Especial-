import type { Metadata } from "next";
import { getAppSettings } from "@/lib/queries";
import { DomainPage } from "@/components/DomainPage";
import { ScheduleLinkCard } from "@/components/ScheduleLinkCard";

export const metadata: Metadata = { title: "FASTC" };

export default async function FastcPage() {
  const settings = await getAppSettings();

  return (
    <DomainPage domain="fastc" emptyMessage="No FASTC tasks open. Stay sharp.">
      <ScheduleLinkCard settings={settings} />
    </DomainPage>
  );
}
