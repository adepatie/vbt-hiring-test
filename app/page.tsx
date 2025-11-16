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

const workflows = [
  {
    title: "Estimates",
    description:
      "Track the six-stage estimate workflow, WBS progress, and approvals.",
    href: "/estimates",
  },
  {
    title: "Contracts",
    description:
      "Manage policy rules, agreement versions, and client review proposals.",
    href: "/contracts",
  },
];

export default function Home() {
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
                <p>Count: --</p>
                <p>Last updated: --</p>
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
