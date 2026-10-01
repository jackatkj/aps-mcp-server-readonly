import { z } from "zod";
import { defineTool, resolveProject, cap, ToolError } from "../guardrails.js";
import { apsGet } from "../aps.js";

export const searchProjectFilesTool = defineTool({
    name: "search_project_files",
    title: "Search Project Files",
    description: `
        Finds files and folders by name text within an approved Forma project (searches all top-level folders).
        Use for vague requests like "the structural drawings" by searching a keyword, then tell the user which keyword you used.
        Returns name, item ID, type and last-modified. Capped; check "truncated".
    `,
    inputSchema: { project: z.string().describe("Project name or number"), text: z.string().min(2).describe("Text contained in the file name") },
    handler: async ({ project, text }) => {
        const p = resolveProject(project);
        const tops = await apsGet(`/project/v1/hubs/${encodeURIComponent(p.accountId)}/projects/${encodeURIComponent(p.projectId)}/topFolders`);
        const rows = [];
        for (const f of (tops.data || []).slice(0, 10)) {
            const r = await apsGet(`/data/v1/projects/${encodeURIComponent(p.projectId)}/folders/${encodeURIComponent(f.id)}/search`,
                { "filter[attributes.displayName-contains]": text, "page[limit]": 50 });
            for (const i of r.data || []) {
                rows.push({ id: i.id, type: i.type, name: i.attributes?.displayName, lastModified: i.attributes?.lastModifiedTime, topFolder: f.attributes?.displayName });
            }
        }
        if (!rows.length) throw new ToolError(`No files matching "${text}" in ${p.name}.`, "Tell the user nothing matched; offer a different keyword. Do not guess file names.");
        const c = cap(rows);
        return { project: p.name, query: text, results: c.items, total: c.total, truncated: c.truncated };
    }
});
