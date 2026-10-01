import { defineTool } from "../guardrails.js";
import { loadNaming, loadRequiredParams } from "../standards.js";

export const getStandardsTool = defineTool({
    name: "get_standards",
    title: "Get KJ Standards",
    description: `
        Returns KJ's file naming rules, discipline codes and required Revit parameters. Call this when the user asks what a file
        should be called, whether something follows standards, or uses vague terms such as "the structural set".
        Also available as the resource kj://standards.
    `,
    handler: async () => ({ naming: loadNaming(), requiredParameters: loadRequiredParams() })
});
