import { Container, Heading, Stack, Text } from "@chakra-ui/react";
import { estimatesService } from "@/lib/services/estimatesService";
import { ProjectList, type ProjectListProject } from "./project-list";

export default async function EstimatesPage() {
  const projects = await estimatesService.listProjects();

  const serializableProjects: ProjectListProject[] = projects.map((project) => ({
    id: project.id,
    name: project.name,
    clientName: project.clientName ?? null,
    stage: project.stage,
    updatedAt: project.updatedAt.toISOString(),
  }));

  return (
    <Container maxW="6xl" py={{ base: 10, md: 16 }}>
      <Stack spacing={8}>
        <Stack spacing={2}>
          <Heading size="lg">Estimates</Heading>
          <Text color="gray.600">
            Track every project estimate, manage stage progress, and capture new
            work in one place.
          </Text>
        </Stack>
        <ProjectList projects={serializableProjects} />
      </Stack>
    </Container>
  );
}

