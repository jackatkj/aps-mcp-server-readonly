import { z } from "zod";
import { defineTool, resolveProject, extractProjectNumbers, loadConfig } from "../guardrails.js";

export const resolveProjectTool = defineTool({
    name: "resolve_project",
    title: "Resolve Project",
    description: `
        Finds the approved project for any text the user gives: a project number, a project name, a Forma folder name, a URL, or a
        sentence containing a project number. Returns the project's name and number. Use it when the user's reference is messy.
        If it fails, ask the user which project they mean.
    `,
    inputSchema: { text: z.string().min(1).max(500) },
    handler: async ({ text }) => {
        const p = resolveProject(text);
        return { name: p.name, number: p.number, numbersFoundInText: extractProjectNumbers(text, loadConfig()) };
    }
});
