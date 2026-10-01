import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { defineTool, loadConfig } from "../guardrails.js";

const dir = path.dirname(url.fileURLToPath(import.meta.url));

export const getProjectContextTool = defineTool({
    name: "get_project_context",
    title: "Get Project Context",
    description: `
        START HERE. Returns the approved projects (name, number, aliases, description) and the working rules for this server.
        Call it before any other tool, and whenever the user's project is unclear. Other tools accept a project name or number from this list;
        never ask the user for IDs. This server is read-only and can only see the projects listed here.
    `,
    handler: async () => ({
        projects: loadConfig().projects.map(({ name, number, aliases, description }) => ({ name, number, aliases, description })),
        readOnly: true,
        rules: fs.readFileSync(path.join(dir, "..", "guidelines.md"), "utf-8")
    })
});
