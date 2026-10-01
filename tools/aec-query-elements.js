import { z } from "zod";
import { defineTool, resolveProject, cap, MAX_ROWS } from "../guardrails.js";
import { aecQuery } from "../aps.js";

export const aecQueryElementsTool = defineTool({
    name: "aec_query_elements",
    title: "AEC Data Model: Query Elements",
    description: `
        Returns elements of one category (e.g. Walls, Doors, Rooms) from a published model, with chosen properties.
        Get elementGroupId from aec_list_element_groups. Fixed query template; free-form GraphQL is not allowed.
        Returns at most one page; if "truncated" is true, say the count is partial and suggest narrowing by category.
    `,
    inputSchema: {
        project: z.string().describe("Project name or number"),
        elementGroupId: z.string().describe("Model ID from aec_list_element_groups"),
        category: z.string().regex(/^[A-Za-z0-9 _-]{1,60}$/).describe("Revit category, e.g. Walls"),
        propertyNames: z.array(z.string().regex(/^[A-Za-z0-9 _.-]{1,60}$/)).max(10).optional()
    },
    handler: async ({ project, elementGroupId, category, propertyNames = [] }) => {
        const p = resolveProject(project); // enforces the project is approved (audit trail)
        const filter = `'property.name.category'==${category}`;
        const names = propertyNames.length ? `(filter: { names: ${JSON.stringify(propertyNames)} })` : "";
        const data = await aecQuery(
            `query ($id: ID!, $filter: String!) { elementsByElementGroup(elementGroupId: $id, filter: { query: $filter }, pagination: { limit: ${MAX_ROWS} }) {
               pagination { cursor } results { id name properties${names} { results { name value } } } } }`,
            { id: elementGroupId, filter });
        const r = data.elementsByElementGroup || {};
        const c = cap(r.results || []);
        return { project: p.name, category, elements: c.items, returned: c.items.length, truncated: c.truncated || Boolean(r.pagination?.cursor),
                 note: "Reflects the last published model version." };
    }
});
