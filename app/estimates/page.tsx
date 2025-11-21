import { MessageSquare } from "lucide-react";
import { CreateProjectButton } from "./create-project-button";

export default function EstimatesPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <div className="rounded-full bg-muted p-4">
        <MessageSquare className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Select a project</h1>
        <p className="text-muted-foreground">
          Choose a project from the sidebar or create a new one to get started.
        </p>
      </div>
      <CreateProjectButton />
    </div>
  );
}
