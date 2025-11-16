"use client";

import { ArrowForwardIcon } from "@chakra-ui/icons";
import {
  Button,
  Box,
  Container,
  Heading,
  SimpleGrid,
  Stack,
  Text,
} from "@chakra-ui/react";
import Link from "next/link";

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
    <Container maxW="5xl" py={{ base: 12, md: 20 }}>
      <Stack spacing={10}>
        <Stack spacing={3}>
          <Heading size="lg">Workflow Dashboard</Heading>
          <Text color="gray.600">
            Thin-slice overview of Estimates and Contracts with Copilot entry
            points.
          </Text>
        </Stack>

        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
          {workflows.map((workflow) => (
            <Box
              key={workflow.title}
              borderWidth="1px"
              borderRadius="lg"
              p={6}
              bg="white"
              shadow="sm"
            >
              <Stack spacing={4}>
                <Stack spacing={1}>
                  <Heading size="md">{workflow.title}</Heading>
                  <Text color="gray.600">{workflow.description}</Text>
                </Stack>
                <Stack fontSize="sm" color="gray.500" spacing={1}>
                  <Text>Count: --</Text>
                  <Text>Last updated: --</Text>
                </Stack>
                <Button
                  as={Link}
                  href={workflow.href}
                  rightIcon={<ArrowForwardIcon />}
                  alignSelf="flex-start"
                  variant="solid"
                  colorScheme="purple"
                >
                  View {workflow.title}
                </Button>
              </Stack>
            </Box>
          ))}
        </SimpleGrid>
      </Stack>
    </Container>
  );
}
