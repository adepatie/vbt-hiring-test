/**
 * Placeholder registry for Copilot actions.
 * Each action will eventually be wired to server actions + services.
 */
export const copilotActions = {
  async ping() {
    return { message: "Copilot actions will be registered here." };
  },
};

export type CopilotActionKey = keyof typeof copilotActions;

