"use client";

import { useMemo, useState, useTransition } from "react";
import NextLink from "next/link";
import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  Flex,
  Heading,
  HStack,
  Input,
  Link as ChakraLink,
  Select,
  Stack,
  Table,
  Text,
} from "@chakra-ui/react";
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

const stageBadgeColor: Record<EstimateStage, string> = {
  ARTIFACTS: "gray",
  BUSINESS_CASE: "purple",
  REQUIREMENTS: "blue",
  SOLUTION: "teal",
  EFFORT: "yellow",
  QUOTE: "orange",
  DELIVERED: "green",
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
    <Stack spacing={10}>
      <Card>
        <CardHeader>
          <Heading size="md">Create a project</Heading>
          <Text color="gray.600" mt={2}>
            Capture the basic metadata so you can start progressing through the
            six estimate stages.
          </Text>
        </CardHeader>
        <CardBody>
          <Stack
            as="form"
            spacing={4}
            onSubmit={handleSubmit(onSubmit)}
            noValidate
          >
            <Field.Root invalid={Boolean(errors.name)}>
              <Field.Label>Project name</Field.Label>
              <Input placeholder="e.g. ACME Mobile App" {...register("name")} />
              <Field.ErrorText>{errors.name?.message}</Field.ErrorText>
            </Field.Root>
            <Field.Root invalid={Boolean(errors.clientName)}>
              <Field.Label>Client name (optional)</Field.Label>
              <Input placeholder="Client" {...register("clientName")} />
              <Field.ErrorText>{errors.clientName?.message}</Field.ErrorText>
            </Field.Root>
            <Button
              type="submit"
              colorScheme="blue"
              alignSelf="flex-start"
              isLoading={isPending}
            >
              Create project
            </Button>
          </Stack>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <Stack spacing={4}>
            <Flex
              direction={{ base: "column", md: "row" }}
              justify="space-between"
              gap={4}
            >
              <Heading size="md">Projects</Heading>
              <HStack spacing={3}>
                <Input
                  placeholder="Search by name or client"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  maxW={{ base: "100%", md: "260px" }}
                />
                <Select
                  value={stageFilter}
                  onChange={(event) =>
                    setStageFilter(event.target.value as "ALL" | EstimateStage)
                  }
                  maxW={{ base: "100%", md: "220px" }}
                >
                  {stageOptions.map((option) => (
                    <option key={option} value={option}>
                      {option === "ALL"
                        ? "All stages"
                        : formatEstimateStageLabel(option)}
                    </option>
                  ))}
                </Select>
              </HStack>
            </Flex>
            <Text color="gray.600">
              {filteredProjects.length} project
              {filteredProjects.length === 1 ? "" : "s"} shown
            </Text>
          </Stack>
        </CardHeader>
        <CardBody>
          <Box overflowX="auto">
            <Table.Root variant="simple">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>Name</Table.ColumnHeader>
                  <Table.ColumnHeader>Client</Table.ColumnHeader>
                  <Table.ColumnHeader>Stage</Table.ColumnHeader>
                  <Table.ColumnHeader>Last updated</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {filteredProjects.length === 0 ? (
                  <Table.Row>
                    <Table.Cell colSpan={4}>
                      <Text color="gray.500" textAlign="center">
                        No projects match the current filters. Try clearing the
                        search or select a different stage.
                      </Text>
                    </Table.Cell>
                  </Table.Row>
                ) : (
                  filteredProjects.map((project) => (
                    <Table.Row key={project.id}>
                      <Table.Cell>
                        <ChakraLink
                          as={NextLink}
                          href={`/estimates/${project.id}`}
                          fontWeight="semibold"
                          color="blue.500"
                        >
                          {project.name}
                        </ChakraLink>
                      </Table.Cell>
                      <Table.Cell>{project.clientName ?? "—"}</Table.Cell>
                      <Table.Cell>
                        <Badge colorScheme={stageBadgeColor[project.stage]}>
                          {formatEstimateStageLabel(project.stage)}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell>{formatUpdatedAt(project.updatedAt)}</Table.Cell>
                    </Table.Row>
                  ))
                )}
              </Table.Body>
            </Table.Root>
          </Box>
        </CardBody>
      </Card>
    </Stack>
  );
}


