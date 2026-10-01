import { z } from "zod";
import { defineTool, resolveProject, cap } from "../guardrails.js";
import { apsGet } from "../aps.js";

export const getFileVersionsTool = defineTool({
    name: "get_file_versions",
    title: "Get File Versions",
    description: `
        Lists the version history of one file (item ID from get_folder_contents or search_project_files):
        version number, name, size, who modified it and when. Use to answer "what is the latest version" or "who changed this".
    `,
    inputSchema: { project: z.string().describe("Project name or number"), itemId: z.string().describe("Item ID (urn:adsk.wipprod:dm.lineage:...)") },
    handler: async ({ project, itemId }) => {
        const p = resolveProject(project);
        const r = await apsGet(`/data/v1/projects/${encodeURIComponent(p.projectId)}/items/${encodeURIComponent(itemId)}/versions`);
        const c = cap((r.data || []).map(v => ({
            versionNumber: v.attributes?.versionNumber, name: v.attributes?.displayName,
            modifiedBy: v.attributes?.lastModifiedUserName, modified: v.attributes?.lastModifiedTime, sizeBytes: v.attributes?.storageSize
        })));
        return { project: p.name, versions: c.items, total: c.total, truncated: c.truncated };
    }
});
