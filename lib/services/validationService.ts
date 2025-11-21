import { contractsService } from "@/lib/services/contractsService";
import { estimatesService } from "@/lib/services/estimatesService";

export async function validateAgreementAgainstEstimate(agreementId: string) {
  const agreement = await contractsService.getAgreement(agreementId);
  if (!agreement || !agreement.projectId) {
    return { valid: true, issues: [] };
  }

  const [wbsItems, quote] = await Promise.all([
    estimatesService.getWbsItems(agreement.projectId),
    estimatesService.getQuote(agreement.projectId),
  ]);

  const issues: string[] = [];
  const latestContent = agreement.versions[0]?.content || "";

  // 1. Check Total Cost
  if (quote?.total) {
    const costString = quote.total.toLocaleString();
    if (!latestContent.includes(costString) && !latestContent.includes(quote.total.toString())) {
      issues.push(`Total cost ($${costString}) from estimate not found in agreement.`);
    }
  }

  // 2. Check Payment Terms
  if (quote?.paymentTerms) {
    // Simple keyword check - in production this would be semantic
    const termsKeywords = quote.paymentTerms.split(" ").filter(w => w.length > 4);
    const missingKeywords = termsKeywords.filter(k => !latestContent.toLowerCase().includes(k.toLowerCase()));
    if (missingKeywords.length > termsKeywords.length / 2) {
      issues.push(`Payment terms "${quote.paymentTerms}" may be missing or altered.`);
    }
  }

  // 3. Check Roles
  const uniqueRoles = Array.from(new Set(wbsItems.map(i => i.roleName)));
  for (const role of uniqueRoles) {
    if (!latestContent.toLowerCase().includes(role.toLowerCase())) {
      issues.push(`Role "${role}" from estimate is not mentioned in agreement.`);
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

