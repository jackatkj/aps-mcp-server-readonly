import { z } from "zod";
import { defineTool, resolveProject, cap, ToolError, stripB } from "../guardrails.js";
import { aecQuery } from "../aps.js";

// NOTE: AEC Data Model queries are metered. Single page, capped. Verify field names in the AEC GraphiQL explorer.
export const aecListElementGroupsTool = defineTool({
    name: "aec_list_element_groups",
    title: "AEC Data Model: List Models",
    description: `
        Lists the models (element groups, e.g. published Revit models) available in the AEC Data Model for an approved project.
        Call this before aec_query_elements to get a model ID. Data reflects the LAST PUBLISHED version of each model, not live Revit.
    `,
    inputSchema: { project: z.string().describe("Project name or number") },
    handler: async ({ project }) => {
        const p = resolveProject(project);
        const hubs = await aecQuery(`query { hubs { results { id name alternativeIdentifiers { dataManagementAPIHubId } } } }`);
        const hub = (hubs.hubs?.results || []).find(h => h.alternativeIdentifiers?.dataManagementAPIHubId === p.accountId);
        if (!hub) throw new ToolError("Hub not found in AEC Data Model.", "Tell the user the AEC Data Model is not available for this account.");
        const projs = await aecQuery(
            `query ($hubId: ID!) { projects(hubId: $hubId) { results { id name alternativeIdentifiers { dataManagementAPIProjectId } } } }`, { hubId: hub.id });
        const proj = (projs.projects?.results || []).find(x => x.alternativeIdentifiers?.dataManagementAPIProjectId === p.projectId
            || stripB(x.alternativeIdentifiers?.dataManagementAPIProjectId || "") === stripB(p.projectId));
        if (!proj) throw new ToolError("Project not found in AEC Data Model.", "Tell the user no published models were found.");
        const g = await aecQuery(
            `query ($projectId: ID!) { elementGroupsByProject(projectId: $projectId, pagination: {limit: 50}) { results { id name } } }`, { projectId: proj.id });
        const c = cap(g.elementGroupsByProject?.results || []);
        return { project: p.name, models: c.items, total: c.total, truncated: c.truncated };
    }
});
