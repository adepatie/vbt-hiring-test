import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { buttonVariants } from "@/lib/ui/button-variants";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { estimatesService } from "@/lib/services/estimatesService";
import { contractsService } from "@/lib/services/contractsService";

const countFormatter = new Intl.NumberFormat("en-US");
const timestampFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});

const formatCount = (value: number) => countFormatter.format(value);
const formatLastUpdated = (value: Date | null) =>
  value ? timestampFormatter.format(value) : "--";

export default async function Home() {
  const [estimateStats, contractStats] = await Promise.all([
    estimatesService.getDashboardStats(),
    contractsService.getDashboardStats(),
  ]);

  const workflows = [
    {
      title: "Estimates",
      description:
        "Track the six-stage estimate workflow, WBS progress, and approvals.",
      href: "/estimates",
      count: estimateStats.count,
      lastUpdated: estimateStats.lastUpdated,
    },
    {
      title: "Contracts",
      description:
        "Manage policy rules, agreement versions, and client review proposals.",
      href: "/contracts",
      count: contractStats.count,
      lastUpdated: contractStats.lastUpdated,
    },
  ];

  return (
    <main className="container max-w-5xl py-12 md:py-20 space-y-10">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Workflow Dashboard</h1>
        <p className="text-muted-foreground">
          Thin-slice overview of Estimates and Contracts with Copilot entry points.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {workflows.map((workflow) => (
          <Card key={workflow.title} className="shadow-sm">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl">{workflow.title}</CardTitle>
              <CardDescription>{workflow.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Count: {formatCount(workflow.count)}</p>
                <p>Last updated: {formatLastUpdated(workflow.lastUpdated)}</p>
              </div>
              <Link
                href={workflow.href}
                className={cn(
                  buttonVariants({ variant: "default" }),
                  "inline-flex items-center gap-2",
                )}
              >
                View {workflow.title}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
