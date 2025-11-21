export interface RolePromptDescriptor {
  id: string;
  name: string;
  rate: number;
}

export function formatRoleCatalogForPrompt(
  roles: RolePromptDescriptor[],
): string {
  if (!roles.length) {
    return "No delivery roles are currently configured. Ask an administrator to add roles before proceeding.";
  }

  const lines = roles.map((role, index) => {
    const formattedRate = role.rate.toFixed(2);
    return `${index + 1}. ${role.name} — $${formattedRate}/hour — id: ${
      role.id
    }`;
  });

  return [
    "Use only the delivery roles listed below. Reference each role by its id when generating WBS items or adjusting staffing plans.",
    lines.join("\n"),
  ].join("\n");
}

export const rolePrompts = {
  formatRoleCatalogForPrompt,
};

export default rolePrompts;

