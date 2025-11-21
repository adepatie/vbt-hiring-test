"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createProjectAction } from "./actions";
import { appToaster } from "@/lib/ui/toaster";
import { ProjectMetadataDialog } from "./project-metadata-dialog";

export function CreateProjectButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handleCreate = async (values: { name: string; clientName?: string }) => {
    try {
      const project = await createProjectAction({
        name: values.name,
        clientName: values.clientName || "New Client", // Fallback if optional not provided, though schema allows optional
      });
      router.push(`/estimates/${project.id}/flow`);
    } catch (error) {
      appToaster.error({
        title: "Failed to create project",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} className="gap-2">
        <Plus className="h-4 w-4" />
        Create New Project
      </Button>
      <ProjectMetadataDialog
        open={open}
        onOpenChange={setOpen}
        mode="create"
        onSubmit={handleCreate}
      />
    </>
  );
}
