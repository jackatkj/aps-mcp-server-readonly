import { defineTool, resolveProject, cap, stripB } from "../guardrails.js";
import { issuesClient } from "../utils.js";
import { z } from "zod";

// Optional: KJ does not use Issues yet. Enable with ENABLE_ISSUES=true.
export const getIssuesTool = defineTool({
    name: "get_issues",
    title: "Get Issues",
    optional: true,
    description: `Lists issues (id, title, status) in an approved Forma project. Read-only. Capped and flagged if truncated.`,
    inputSchema: { project: z.string().describe("Project name or number") },
    handler: async ({ project }) => {
        const p = resolveProject(project);
        const issues = await issuesClient.getIssues(stripB(p.projectId)).then(r => r.results || []);
        const c = cap(issues.map(i => ({ id: i.id, title: i.title, status: i.status })));
        return { project: p.name, issues: c.items, total: c.total, truncated: c.truncated };
    }
});
