import { contractsService } from "@/lib/services/contractsService";
import { estimatesService } from "@/lib/services/estimatesService";

export interface ContractContext {
  agreement?: Awaited<ReturnType<typeof contractsService.getAgreement>>;
  policies: Awaited<ReturnType<typeof contractsService.listPolicies>>;
  examples: Awaited<ReturnType<typeof contractsService.listExampleAgreements>>;
  projectEstimate?: {
    wbsItems: Awaited<ReturnType<typeof estimatesService.getWbsItems>>;
    quote: Awaited<ReturnType<typeof estimatesService.getQuote>>;
    project: Awaited<ReturnType<typeof estimatesService.getProjectMetadata>>;
  };
  digestText: string;
}

export async function buildContractContext(
  agreementId?: string, 
  type?: string,
  excludedPolicyIds?: string[]
): Promise<ContractContext> {
  let policies = await contractsService.listPolicies();
  
  if (excludedPolicyIds && excludedPolicyIds.length > 0) {
    policies = policies.filter(p => !excludedPolicyIds.includes(p.id));
  }

  const examples = await contractsService.listExampleAgreements();
  
  let agreement;
  let projectEstimate;
  let targetType = type;

  if (agreementId) {
    agreement = await contractsService.getAgreement(agreementId);
    if (!agreement) {
      throw new Error(`Agreement not found: ${agreementId}`);
    }
    targetType = agreement.type;

    if (agreement.projectId) {
      const [wbsItems, quote, project] = await Promise.all([
        estimatesService.getWbsItems(agreement.projectId),
        estimatesService.getQuote(agreement.projectId),
        estimatesService.getProjectMetadata(agreement.projectId),
      ]);
      projectEstimate = { wbsItems, quote, project };
    }
  }

  // Build a digest text for the LLM
  const policyText = policies
    .map((p) => `- ${p.description}`)
    .join("\n");

  const exampleText = examples
    .filter((e) => !targetType || e.type === targetType)
    .map((e) => `--- EXAMPLE ${e.name} ---\n${e.content}\n--- END EXAMPLE ---`)
    .join("\n\n");

  let estimateText = "";
  if (projectEstimate) {
    const totalHours = projectEstimate.wbsItems.reduce((sum, item) => sum + item.hours, 0);
    const totalCost = projectEstimate.quote?.total ?? 0;
    
    estimateText = `
LINKED ESTIMATE DATA:
Project: ${projectEstimate.project.name}
Total Hours: ${totalHours}
Total Cost: $${totalCost.toLocaleString()}
Payment Terms: ${projectEstimate.quote?.paymentTerms ?? "N/A"}
Timeline: ${projectEstimate.quote?.timeline ?? "N/A"}

WBS ITEMS:
${projectEstimate.wbsItems.map((item) => `- ${item.task} (${item.roleName}: ${item.hours}h)`).join("\n")}
    `.trim();
  }

  const digestText = `
${agreement ? `AGREEMENT CONTEXT:
Type: ${agreement.type}
Counterparty: ${agreement.counterparty}
Current Status: ${agreement.status}` : `CONTEXT:
Reviewing generic agreement${targetType ? ` of type ${targetType}` : ""}.`}

GOVERNANCE POLICIES:
${policyText}

${estimateText}

RELEVANT EXAMPLES:
${exampleText}
  `.trim();

  return {
    agreement,
    policies,
    examples,
    projectEstimate,
    digestText,
  };
}
