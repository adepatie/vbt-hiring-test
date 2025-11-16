"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  estimateStageEnum,
  projectSchema,
  type EstimateStage,
} from "@/lib/zod/estimates";
import { formatEstimateStageLabel } from "@/lib/utils/estimates";
import { appToaster } from "@/lib/ui/toaster";
import { createProjectAction } from "./actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const createProjectFormSchema = z.object({
  name: projectSchema.shape.name,
  clientName: z
    .string()
    .optional()
    .transform((value) => value?.trim() ?? "")
    .refine((value) => value.length <= 160, "Client name is too long."),
});

type CreateProjectFormValues = z.infer<typeof createProjectFormSchema>;

export type ProjectListProject = {
  id: string;
  name: string;
  clientName?: string | null;
  stage: EstimateStage;
  updatedAt: string;
};

type ProjectListProps = {
  projects: ProjectListProject[];
};

const stageBadgeClass: Record<EstimateStage, string> = {
  ARTIFACTS: "bg-slate-100 text-slate-700",
  BUSINESS_CASE: "bg-purple-100 text-purple-700",
  REQUIREMENTS: "bg-blue-100 text-blue-700",
  SOLUTION: "bg-teal-100 text-teal-700",
  EFFORT: "bg-amber-100 text-amber-800",
  QUOTE: "bg-orange-100 text-orange-800",
  DELIVERED: "bg-emerald-100 text-emerald-800",
};

const dateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});

const formatUpdatedAt = (value: string) => dateFormatter.format(new Date(value));

const stageOptions: Array<"ALL" | EstimateStage> = [
  "ALL",
  ...estimateStageEnum.options,
];

export function ProjectList({ projects }: ProjectListProps) {
  const [stageFilter, setStageFilter] = useState<"ALL" | EstimateStage>("ALL");
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const toast = appToaster;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateProjectFormValues>({
    resolver: zodResolver(createProjectFormSchema),
    defaultValues: {
      name: "",
      clientName: "",
    },
  });

  const filteredProjects = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return projects.filter((project) => {
      const matchesStage =
        stageFilter === "ALL" || project.stage === stageFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        project.name.toLowerCase().includes(normalizedSearch) ||
        (project.clientName ?? "")
          .toLowerCase()
          .includes(normalizedSearch);
      return matchesStage && matchesSearch;
    });
  }, [projects, search, stageFilter]);

  const onSubmit = (values: CreateProjectFormValues) => {
    startTransition(async () => {
      try {
        const payload = {
          name: values.name,
          clientName: values.clientName.length ? values.clientName : undefined,
        };
        const project = await createProjectAction(payload);
        toast.success({
          title: "Project created",
          description: `Redirecting to ${project.name}...`,
        });
        reset();
        router.push(`/estimates/${project.id}`);
      } catch (error) {
        console.error(error);
        toast.error({
          title: "Unable to create project",
          description:
            error instanceof Error ? error.message : "Unexpected error.",
        });
      }
    });
  };

  return (
    <div className="flex flex-col gap-10">
      <Card className="shadow-sm">
        <CardHeader className="space-y-2">
          <CardTitle>Create a project</CardTitle>
          <CardDescription>
            Capture the basic metadata so you can start progressing through the six estimate stages.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="space-y-1">
              <label className="text-sm font-medium">Project name</label>
              <Input placeholder="e.g. ACME Mobile App" {...register("name")} disabled={isPending} />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Client name (optional)</label>
              <Input placeholder="Client" {...register("clientName")} disabled={isPending} />
              {errors.clientName && (
                <p className="text-sm text-destructive">{errors.clientName.message}</p>
              )}
            </div>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating..." : "Create project"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <CardTitle>Projects</CardTitle>
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <Input
                placeholder="Search by name or client"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="md:w-64"
              />
              <Select
                value={stageFilter}
                onValueChange={(value) =>
                  setStageFilter(value as "ALL" | EstimateStage)
                }
              >
                <SelectTrigger className="md:w-56">
                  <SelectValue placeholder="All stages" />
                </SelectTrigger>
                <SelectContent>
                  {stageOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option === "ALL"
                        ? "All stages"
                        : formatEstimateStageLabel(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {filteredProjects.length} project
            {filteredProjects.length === 1 ? "" : "s"} shown
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Last updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProjects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No projects match the current filters. Try clearing the search or select a different
                      stage.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProjects.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell>
                        <Link
                          href={`/estimates/${project.id}`}
                          className="font-semibold text-primary hover:underline"
                        >
                          {project.name}
                        </Link>
                      </TableCell>
                      <TableCell>{project.clientName ?? "—"}</TableCell>
                      <TableCell>
                        <Badge className={cn("px-2.5 py-0.5", stageBadgeClass[project.stage])}>
                          {formatEstimateStageLabel(project.stage)}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatUpdatedAt(project.updatedAt)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
