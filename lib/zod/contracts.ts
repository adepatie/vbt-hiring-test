import { z } from "zod";

export const agreementStubSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(["MSA", "SOW"]).optional(),
  clientName: z.string().optional(),
});

export type AgreementStub = z.infer<typeof agreementStubSchema>;

