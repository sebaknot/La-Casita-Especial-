import type { Metadata } from "next";
import { getDomainItems, getLoans } from "@/lib/queries";
import { PipelineBoard } from "@/components/PipelineBoard";
import { QuickAdd } from "@/components/QuickAdd";
import { ItemList } from "@/components/ItemList";

export const metadata: Metadata = { title: "Mortgages" };

export default async function MortgagesPage() {
  const [loans, items] = await Promise.all([
    getLoans(),
    getDomainItems("mortgages"),
  ]);

  const active = loans.filter(
    (loan) => loan.stage !== "closed" && loan.stage !== "dead",
  );
  const parents = items.filter((item) => item.type !== "update");
  const openItems = parents.filter((item) => item.status !== "done");

  const loanLabels: Record<string, string> = {};
  for (const loan of loans) loanLabels[loan.id] = loan.borrower_label;

  const itemCounts: Record<string, number> = {};
  for (const item of openItems) {
    if (!item.loan_id) continue;
    itemCounts[item.loan_id] = (itemCounts[item.loan_id] ?? 0) + 1;
  }

  return (
    <div className="space-y-8">
      <header className="stagger-2">
        <p className="eyebrow">Pipeline · Licensed FL / GA</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="font-display text-3xl font-semibold">Mortgages</h1>
          <p className="mono text-sm text-ink-dim">
            <span className="text-ink">{active.length}</span> in pipeline ·{" "}
            <span className="text-success">
              {loans.filter((loan) => loan.stage === "closed").length}
            </span>{" "}
            closed · <span className="text-ink">{openItems.length}</span> open
            item{openItems.length === 1 ? "" : "s"}
          </p>
        </div>
      </header>

      <section className="stagger-3" aria-label="Loan pipeline">
        {loans.length === 0 && (
          <p className="mb-3 rounded-lg border border-dashed border-hairline px-4 py-10 text-center text-sm text-ink-faint">
            Pipeline is empty. Add the first loan — or tell the command bar:
            “New FL loan for J.M., application stage.”
          </p>
        )}
        <PipelineBoard loans={loans} itemCounts={itemCounts} />
      </section>

      {/* Business work that isn't tied to one file: licensing, CE, marketing. */}
      <section className="stagger-3 space-y-4" aria-label="Mortgage tasks">
        <div className="flex items-baseline justify-between border-t border-hairline pt-6">
          <h2 className="eyebrow">Business Tasks</h2>
          <span className="mono text-[11px] text-ink-faint">
            licensing · CE · lenders · marketing
          </span>
        </div>
        <QuickAdd domain="mortgages" loans={loans} />
        <ItemList
          items={items}
          loanLabels={loanLabels}
          emptyMessage="No mortgage business tasks. Log license renewals, CE credits, or lender onboarding here."
        />
      </section>
    </div>
  );
}
