import Link from "next/link";
import { Plus, LayoutDashboard, FileText, CircuitBoard, ArrowLeft } from "lucide-react";

import { estimatesService } from "@/lib/services/estimatesService";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function EstimatesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const projects = await estimatesService.listProjects();

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
            href="/contracts"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground"
          >
            <FileText className="h-4 w-4" />
            Contracts
          </Link>
          
          <div className="pt-2">
            <Link href="/estimates">
                <Button variant="outline" className="w-full justify-start gap-2 bg-transparent border-white/20 hover:bg-white/10 text-white">
                    <Plus className="h-4 w-4" />
                    New Project
                </Button>
            </Link>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2">
            <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground px-2 py-2">Projects</div>
                {projects.map((project) => (
                    <Link
                        key={project.id}
                        href={`/estimates/${project.id}/flow`}
                        className="flex items-center gap-3 rounded-md px-3 py-3 text-sm hover:bg-white/10 transition-colors group"
                    >
                        <CircuitBoard className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                        <span className="truncate">{project.name}</span>
                    </Link>
                ))}
                {projects.length === 0 && (
                    <p className="px-2 text-sm text-muted-foreground">No projects yet.</p>
                )}
            </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex min-h-0 flex-col overflow-hidden bg-background relative">
        {children}
      </main>
    </div>
  );
}

