import type { PromptPayload } from "./estimates";
import { ESTIMATES_SYSTEM_PROMPT } from "./estimates";

export interface QuoteTermsPromptInput {
  projectName: string;
  clientName?: string | null;
  subtotal: number;
  overheadFee: number;
  total: number;
  wbsSummary: string;
  instructions?: string | null;
}

export function buildQuoteTermsPrompt(
  input: QuoteTermsPromptInput,
): PromptPayload {
  const userContent = [
    `Project: ${input.projectName}`,
    input.clientName ? `Client: ${input.clientName}` : null,
    `WBS Summary:\n${input.wbsSummary}`,
    `Pricing Breakdown:\n- Subtotal (WBS items): $${input.subtotal.toLocaleString()}\n- Overhead Fee: $${input.overheadFee.toLocaleString()}\n- Total: $${input.total.toLocaleString()}`,
    input.instructions
      ? `Additional instructions: ${input.instructions}`
      : null,
    `Generate professional payment terms and work timeline for this quote. Return a JSON object with:
- paymentTerms: string (milestone-style format, e.g., "40% on signing, 40% on UAT completion, 20% on go-live". Ensure percentages sum to 100% and reference clear project milestones.)
- timeline: string (200-500 words describing project phases, delivery dates, dependencies)`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    systemPrompt: ESTIMATES_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  };
}

export const quotePrompts = {
  buildQuoteTermsPrompt,
};

export default quotePrompts;

