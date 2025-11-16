import { Container, Skeleton, Stack } from "@chakra-ui/react";

export default function EstimateDetailLoading() {
  return (
    <Container maxW="6xl" py={{ base: 10, md: 16 }}>
      <Stack spacing={6}>
        <Skeleton height="120px" borderRadius="lg" />
        <Skeleton height="72px" borderRadius="lg" />
        <Skeleton height="420px" borderRadius="lg" />
        <Skeleton height="280px" borderRadius="lg" />
      </Stack>
    </Container>
  );
}


