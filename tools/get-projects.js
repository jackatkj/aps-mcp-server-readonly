import { defineTool, loadConfig } from "../guardrails.js";
import { dataManagementClient } from "../utils.js";

export const getProjectsTool = defineTool({
    name: "get_projects",
    title: "Get Accounts & Projects",
    description: `
        Lists the approved Forma projects with their Autodesk IDs. Only allowlisted projects are returned,
        even if the service account can technically see more. Prefer get_project_context unless IDs are needed.
    `,
    handler: async () => {
        const { projects } = loadConfig();
        const hubs = await dataManagementClient.getHubs().then(r => r.data || []);
        const approvedIds = new Set(projects.map(p => p.projectId));
        const out = [];
        for (const hub of hubs) {
            const all = await dataManagementClient.getHubProjects(hub.id).then(r => r.data || []);
            const mine = all.filter(p => approvedIds.has(p.id));
            if (mine.length) out.push({ id: hub.id, name: hub.attributes.name, projects: mine.map(p => ({ id: p.id, name: p.attributes.name })) });
        }
        return { accounts: out };
    }
});
