import Link from "next/link";
import { ArrowLeft, FileText, Plus, Search, Scale, Calculator } from "lucide-react";
import { contractsService } from "@/lib/services/contractsService";
import { ContractGenerationProvider } from "./contract-generation-context";

export default async function ContractsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const agreements = await contractsService.listAgreements();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[260px] flex-shrink-0 bg-sidebar text-sidebar-foreground flex flex-col border-r border-white/10">
        <div className="p-3 space-y-2">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <Link
            href="/estimates"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground"
          >
            <Calculator className="h-4 w-4" />
            Estimates
          </Link>

          <div className="h-px bg-white/10 my-2" />

          <Link
            href="/contracts/new"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-4 w-4" />
            Create agreement
          </Link>
          <Link
            href="/contracts/review"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground"
          >
             <Search className="h-4 w-4" />
            Review agreement
          </Link>
           <Link
            href="/contracts/policies"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground"
          >
             <Scale className="h-4 w-4" />
            Manage policies
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2">
            <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground px-2 py-2">Contracts</div>
                {agreements.map((agreement) => (
                    <Link
                        key={agreement.id}
                        href={`/contracts/${agreement.id}`}
                        className="flex items-center gap-3 rounded-md px-3 py-3 text-sm hover:bg-white/10 transition-colors group"
                    >
                        <FileText className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                        <span className="truncate">
                          <span className="font-medium text-muted-foreground">{agreement.type}</span>
                          <span className="mx-1 text-muted-foreground">·</span>
                          {agreement.counterparty}
                        </span>
                    </Link>
                ))}
                {agreements.length === 0 && (
                    <p className="px-2 text-sm text-muted-foreground">No contracts yet.</p>
                )}
            </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex min-h-0 flex-col h-full overflow-hidden bg-background relative">
        <ContractGenerationProvider>
          {children}
        </ContractGenerationProvider>
      </main>
    </div>
  );
}
