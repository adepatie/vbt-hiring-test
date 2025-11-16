import { Container, Heading, Stack, Text } from "@chakra-ui/react";

export default function PoliciesPage() {
  return (
    <Container maxW="5xl" py={{ base: 10, md: 16 }}>
      <Stack spacing={4}>
        <Heading size="lg">Policy Rules</Heading>
        <Text color="gray.600">
          Placeholder for managing policy rules and example violations that
          drive contract reviews.
        </Text>
      </Stack>
    </Container>
  );
}

