import { Container, Heading, Stack, Text } from "@chakra-ui/react";

type AgreementDetailPageProps = {
  params: { agreementId: string };
};

export default function AgreementDetailPage({
  params,
}: AgreementDetailPageProps) {
  return (
    <Container maxW="5xl" py={{ base: 10, md: 16 }}>
      <Stack spacing={4}>
        <Heading size="lg">Agreement #{params.agreementId}</Heading>
        <Text color="gray.600">
          Agreement version selector, policy alignment, and Copilot review UI
          will be scaffolded here.
        </Text>
      </Stack>
    </Container>
  );
}

