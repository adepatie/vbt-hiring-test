import { Container, Skeleton, Stack } from "@chakra-ui/react";

export default function EstimatesLoading() {
  return (
    <Container maxW="6xl" py={{ base: 10, md: 16 }}>
      <Stack spacing={8}>
        <Skeleton height="40px" width="260px" borderRadius="md" />
        <Skeleton height="220px" borderRadius="lg" />
        <Skeleton height="360px" borderRadius="lg" />
      </Stack>
    </Container>
  );
}


