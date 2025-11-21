"use server";

import { contractsService } from "@/lib/services/contractsService";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createPolicyRuleSchema,
  createExampleAgreementSchema,
} from "@/lib/zod/contracts";

const deletePolicySchema = z.object({
  id: z.string().cuid("Invalid policy id."),
});

const deleteExampleSchema = z.object({
  id: z.string().cuid("Invalid example id."),
});

const parseFormData = <T>(payload: FormData | T): Record<string, unknown> => {
  if (payload instanceof FormData) {
    return Object.fromEntries(payload.entries());
  }
  return payload as Record<string, unknown>;
};

export async function createPolicyAction(input: FormData | { description: string }) {
  const parsed = createPolicyRuleSchema.safeParse(parseFormData(input));

  if (!parsed.success) {
    const { fieldErrors } = parsed.error.flatten();
    return {
      success: false,
      error: "Invalid policy data.",
      fieldErrors,
    };
  }

  try {
    await contractsService.createPolicy(parsed.data);
    revalidatePath("/contracts/policies");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to create policy" };
  }
}

export async function deletePolicyAction(id: string) {
  const parsed = deletePolicySchema.safeParse({ id });
  if (!parsed.success) {
    return { success: false, error: "Invalid policy id." };
  }

  try {
    await contractsService.deletePolicy(parsed.data.id);
    revalidatePath("/contracts/policies");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to delete policy" };
  }
}

export async function createExampleAction(
  input: FormData | { name: string; type: string; content: string },
) {
  const parsed = createExampleAgreementSchema.safeParse(parseFormData(input));

  if (!parsed.success) {
    const { fieldErrors } = parsed.error.flatten();
    return {
      success: false,
      error: "Invalid example agreement.",
      fieldErrors,
    };
  }

  try {
    await contractsService.createExampleAgreement(parsed.data);
    revalidatePath("/contracts/policies");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to create example" };
  }
}

export async function deleteExampleAction(id: string) {
  const parsed = deleteExampleSchema.safeParse({ id });
  if (!parsed.success) {
    return { success: false, error: "Invalid example id." };
  }

  try {
    await contractsService.deleteExampleAgreement(parsed.data.id);
    revalidatePath("/contracts/policies");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to delete example" };
  }
}

