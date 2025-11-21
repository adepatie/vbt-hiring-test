import { CopilotLLMMessage } from "../types";

export function buildContractDraftPrompt(context: {
  agreementType: string;
  counterparty: string;
  digestText: string;
  instructions?: string;
}) {
  const systemPrompt = `
You are an expert legal drafter for a consulting firm.
Your goal is to draft a ${context.agreementType} for ${context.counterparty}.

You must strictly follow the provided GOVERNANCE POLICIES.
You should use the RELEVANT EXAMPLES as a style guide and template structure.

CRITICAL: If LINKED ESTIMATE DATA is provided in the context:
- You MUST incorporate the exact scope items (WBS tasks) into the Scope of Services section.
- You MUST use the exact total cost and payment terms from the estimate.
- You MUST use the exact timeline/schedule from the estimate.
- Do not use placeholders if the data is available in LINKED ESTIMATE DATA.

Output strictly in Markdown format.
Do not wrap the output in markdown code blocks (\`\`\`) or fences.
Use standard Markdown headers (#, ##) for sections.
Output ONLY the full text of the agreement.
Do not include preamble or conversational filler.
If specific details are missing, use standard placeholders (e.g., [Date], [Name]) rather than refusing to generate.
`.trim();

  const userMessage = `
Here is the context for the agreement:

${context.digestText}

${context.instructions ? `ADDITIONAL INSTRUCTIONS:\n${context.instructions}` : ""}

Draft the ${context.agreementType} now.
`.trim();

  return {
    systemPrompt,
    messages: [{ role: "user", content: userMessage }] as CopilotLLMMessage[],
  };
}

export function buildContractReviewPrompt(context: {
  agreementType: string;
  digestText: string;
  incomingDraft: string;
}) {
  const systemPrompt = `
You are a strict legal reviewer.
Your goal is to review an incoming ${context.agreementType} against our GOVERNANCE POLICIES.

Analyze the INCOMING DRAFT.
Identify clauses that violate our policies or are missing required terms.
For each issue, propose a specific text change.

You must output a JSON object with a "proposals" array.
Each proposal must have:
- "originalText": The exact text from the draft that needs changing (or a marker if missing).
- "proposedText": The corrected text.
- "rationale": A concise explanation of why this change is needed based on our policies.
`.trim();

  const userMessage = `
CONTEXT & POLICIES:
${context.digestText}

INCOMING DRAFT TO REVIEW:
${context.incomingDraft}

Generate the review proposals in JSON format.
`.trim();

  return {
    systemPrompt,
    messages: [{ role: "user", content: userMessage }] as CopilotLLMMessage[],
  };
}

export function buildContractValidationPrompt(context: {
  agreementType: string;
  digestText: string;
  currentContent: string;
}) {
  const systemPrompt = `
You are a strict contract auditor.
Your goal is to validate the Current Agreement Text against the LINKED ESTIMATE DATA and GOVERNANCE POLICIES.

You must check for discrepancies between the contract and the estimate:
1. SCOPE MISMATCH: Are all WBS items from the estimate covered in the contract?
2. PRICE MISMATCH: Does the contract total match the estimate total?
3. TERMS MISMATCH: Do payment terms and timeline match?
4. POLICY VIOLATION: Are any governance policies violated?

Output a JSON object with an "issues" array.
Each issue must have:
- "type": "SCOPE" | "PRICE" | "TERMS" | "POLICY"
- "severity": "HIGH" | "MEDIUM" | "LOW"
- "description": A concise description of the discrepancy.
- "recommendation": What should be changed in the contract.

If there are no issues, return an empty "issues" array.
`.trim();

  const userMessage = `
CONTEXT (Estimate & Policies):
${context.digestText}

CURRENT AGREEMENT TEXT:
${context.currentContent}

Perform the validation analysis and return JSON.
`.trim();

  return {
    systemPrompt,
    messages: [{ role: "user", content: userMessage }] as CopilotLLMMessage[],
  };
}
