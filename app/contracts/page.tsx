import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, FileText } from "lucide-react";

export default function ContractsPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <FileText className="h-6 w-6" />
      </div>
      <h2 className="mt-6 text-xl font-semibold">Select a Contract</h2>
      <p className="mt-2 text-center text-sm text-muted-foreground max-w-sm">
        Select an existing contract from the sidebar to view details, or create a new one to get started.
      </p>
      <div className="mt-8">
        <Link href="/contracts/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Agreement
          </Button>
        </Link>
      </div>
    </div>
  );
}
