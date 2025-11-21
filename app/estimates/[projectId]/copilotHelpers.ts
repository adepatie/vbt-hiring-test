import type { RoleOption } from "./project-types";
import type { WbsItem } from "@/lib/zod/estimates";

type CopilotAction = 
  | "generateBusinessCaseFromArtifacts"
  | "generateRequirementsFromBusinessCase"
  | "generateSolutionArchitectureFromRequirements"
  | "generateEffortFromSolution"
  | "generateQuoteTerms";

export async function callCopilot<T = any>(
  action: CopilotAction,
  entityId: string,
  payload: Record<string, any>
): Promise<T> {
  const response = await fetch("/api/copilot", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action,
      workflow: "estimates",
      entityId,
      view: "stage",
      payload,
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? "Copilot request failed.");
  }

  return response.json();
}

export function buildWbsSummaryFromRoleOptions(
  items: { task: string; hours: number; roleId: string }[],
  roles: RoleOption[]
): string {
  return items
    .filter((item) => item.task.trim() || item.hours > 0)
    .map((item) => {
      const role = roles.find((r) => r.id === item.roleId);
      const roleName = role?.name ?? "Unknown";
      const roleRate = role?.rate ?? 0;
      const hours = Number(item.hours) || 0;
      const lineTotal = hours * roleRate;
      return `${item.task} (${roleName}: ${hours}h @ $${roleRate}/hr = $${lineTotal.toLocaleString()})`;
    })
    .join("\n");
}

export function buildWbsSummaryFromItems(items: WbsItem[]): string {
  return items
    .map(
      (item) =>
        `${item.task} (${item.roleName}: ${item.hours}h @ $${item.roleRate}/hr = $${(item.hours * item.roleRate).toLocaleString()})`,
    )
    .join("\n");
}

