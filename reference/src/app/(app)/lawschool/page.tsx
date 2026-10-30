import type { Metadata } from "next";
import { getLawSchoolPrep } from "@/lib/queries";
import { DomainPage } from "@/components/DomainPage";
import { LawSchoolTracker } from "@/components/LawSchoolTracker";

export const metadata: Metadata = { title: "Law School Prep" };

export default async function LawSchoolPage() {
  const prep = await getLawSchoolPrep();

  return (
    <DomainPage
      domain="lawschool"
      emptyMessage="No prep work logged. Add the next step toward the application."
    >
      {prep ? (
        <LawSchoolTracker prep={prep} />
      ) : (
        <p className="rounded-lg border border-dashed border-hairline px-4 py-6 text-center text-sm text-ink-faint">
          Run migration 0003 to enable the Law School Prep tracker.
        </p>
      )}
    </DomainPage>
  );
}
