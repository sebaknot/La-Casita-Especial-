import type { Metadata } from "next";
import { DomainPage } from "@/components/DomainPage";

export const metadata: Metadata = { title: "Porter" };

export default function PorterPage() {
  return (
    <DomainPage
      domain="porter"
      emptyMessage="Nothing open in Porter. Log the first update."
    />
  );
}
