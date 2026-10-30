import type { Metadata } from "next";
import { DomainPage } from "@/components/DomainPage";

export const metadata: Metadata = { title: "Taxonomy" };

export default function TaxonomyPage() {
  return (
    <DomainPage
      domain="taxonomy"
      emptyMessage="Nothing open at Taxonomy. Log the next client move."
    />
  );
}
