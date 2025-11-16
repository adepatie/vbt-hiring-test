import { Container, Heading, Stack, Text } from "@chakra-ui/react";

export default function ContractsPage() {
  return (
    <Container maxW="5xl" py={{ base: 10, md: 16 }}>
      <Stack spacing={4}>
        <Heading size="lg">Contracts</Heading>
        <Text color="gray.600">
          Placeholder for agreements list, filters, and linked estimate chips.
        </Text>
      </Stack>
    </Container>
  );
}

