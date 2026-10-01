import { z } from "zod";
import { defineTool, resolveProject, cap } from "../guardrails.js";
import { dataManagementClient } from "../utils.js";

export const getFolderContentsTool = defineTool({
    name: "get_folder_contents",
    title: "Get Folder Contents",
    description: `
        Lists folders and files in an approved Forma project. Give the project by name or number.
        Omit folderId to list the top-level folders; pass a folder ID from an earlier result to go deeper.
        Results are capped and flagged if truncated.
    `,
    inputSchema: { project: z.string().describe("Project name or number"), folderId: z.string().optional() },
    handler: async ({ project, folderId }) => {
        const p = resolveProject(project);
        const data = folderId
            ? await dataManagementClient.getFolderContents(p.projectId, folderId).then(r => r.data || [])
            : await dataManagementClient.getProjectTopFolders(p.accountId, p.projectId).then(r => r.data || []);
        const c = cap(data.map(i => ({ id: i.id, type: i.type, name: i.attributes.displayName })));
        return { project: p.name, contents: c.items, total: c.total, truncated: c.truncated };
    }
});
