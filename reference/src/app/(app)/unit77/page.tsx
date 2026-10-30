import type { Metadata } from "next";
import { DomainPage } from "@/components/DomainPage";

export const metadata: Metadata = { title: "Unit 77" };

export default function Unit77Page() {
  return (
    <DomainPage
      domain="unit77"
      emptyMessage="Nothing open at Unit 77. Ship the next automation."
    />
  );
}
