import { z } from "zod";
import { defineTool, resolveProject, cap } from "../guardrails.js";
import { apsGet } from "../aps.js";
import { checkName } from "../standards.js";

export const checkFileNamingTool = defineTool({
    name: "check_file_naming",
    title: "Check File Naming",
    description: `
        Checks the file names in one folder (not subfolders) against KJ naming standards and reports violations with the expected pattern.
        Pass a folderId from get_folder_contents. Read-only: it reports problems, it never renames anything.
    `,
    inputSchema: { project: z.string().describe("Project name or number"), folderId: z.string() },
    handler: async ({ project, folderId }) => {
        const p = resolveProject(project);
        const pid = encodeURIComponent(p.projectId), fid = encodeURIComponent(folderId);
        const [folder, contents] = await Promise.all([
            apsGet(`/data/v1/projects/${pid}/folders/${fid}`),
            apsGet(`/data/v1/projects/${pid}/folders/${fid}/contents`, { "filter[type]": "items", "page[limit]": 200 })
        ]);
        const folderName = folder.data?.attributes?.displayName || "";
        const files = (contents.data || []).map(i => i.attributes?.displayName).filter(Boolean);
        const results = files.map(name => ({ name, ...checkName(name, folderName) }));
        const fails = cap(results.filter(r => r.status === "fail"));
        return {
            project: p.name, folder: folderName, checked: files.length,
            passed: results.filter(r => r.status === "pass").length,
            noApplicableRule: results.filter(r => r.status === "no-rule").length,
            violations: fails.items, totalViolations: fails.total, truncated: fails.truncated,
            partial: Boolean(contents.links?.next)
        };
    }
});
