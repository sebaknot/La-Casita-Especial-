import type { Metadata } from "next";
import { getCpaSections } from "@/lib/queries";
import { DomainPage } from "@/components/DomainPage";
import { CpaTracker } from "@/components/CpaTracker";

export const metadata: Metadata = { title: "CPA Exam Prep" };

export default async function CpaPage() {
  const sections = await getCpaSections();

  return (
    <DomainPage
      domain="cpa"
      emptyMessage="No CPA study tasks yet. Add the next block of review."
    >
      {sections.length > 0 ? (
        <CpaTracker sections={sections} />
      ) : (
        <p className="rounded-lg border border-dashed border-hairline px-4 py-6 text-center text-sm text-ink-faint">
          Run migration 0003 to enable the CPA Exam Prep tracker.
        </p>
      )}
    </DomainPage>
  );
}
