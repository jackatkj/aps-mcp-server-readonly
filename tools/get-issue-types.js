import { defineTool, resolveProject, stripB } from "../guardrails.js";
import { issuesClient } from "../utils.js";
import { z } from "zod";

export const getIssueTypesTool = defineTool({
    name: "get_issue_types",
    title: "Get Issue Types",
    optional: true,
    description: `Lists configured issue types and subtypes for an approved Forma project. Read-only.`,
    inputSchema: { project: z.string().describe("Project name or number") },
    handler: async ({ project }) => {
        const p = resolveProject(project);
        const types = await issuesClient.getIssuesTypes(stripB(p.projectId), { include: "subtypes" }).then(r => r.results || []);
        return { project: p.name, issueTypes: types.map(t => ({ id: t.id, title: t.title, subtypes: (t.subtypes || []).map(s => ({ id: s.id, title: s.title })) })) };
    }
});
