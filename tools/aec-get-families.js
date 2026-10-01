import { z } from "zod";
import { defineTool, resolveProject, cap, MAX_ROWS } from "../guardrails.js";
import { aecQuery } from "../aps.js";

// UNTESTED: filter syntax and property names must be verified in the AEC GraphiQL explorer.
export const aecGetFamiliesTool = defineTool({
    name: "aec_get_families",
    title: "AEC Data Model: Families and Types",
    description: `
        Lists the family types in a published Revit model with all their properties (family name, type name, category, parameters).
        Optionally narrow by category (e.g. Doors). Pages through large models with "cursor": if "nextCursor" is returned,
        tell the user the list is partial and offer to continue. Data reflects the last published model version.
    `,
    inputSchema: {
        project: z.string().describe("Project name or number"),
        elementGroupId: z.string().describe("Model ID from aec_list_element_groups"),
        category: z.string().regex(/^[A-Za-z0-9 _-]{1,60}$/).optional(),
        cursor: z.string().max(500).optional()
    },
    handler: async ({ project, elementGroupId, category, cursor }) => {
        const p = resolveProject(project);
        const filter = `'property.name.Element Context'==Type` + (category ? ` and 'property.name.category'==${category}` : "");
        const page = cursor ? `{ limit: ${MAX_ROWS}, cursor: ${JSON.stringify(cursor)} }` : `{ limit: ${MAX_ROWS} }`;
        const data = await aecQuery(
            `query ($id: ID!, $filter: String!) { elementsByElementGroup(elementGroupId: $id, filter: { query: $filter }, pagination: ${page}) {
               pagination { cursor } results { id name properties { results { name value } } } } }`,
            { id: elementGroupId, filter });
        const r = data.elementsByElementGroup || {};
        const c = cap(r.results || []);
        return { project: p.name, category: category || "all", types: c.items, nextCursor: r.pagination?.cursor || null,
                 note: "Reflects the last published model version." };
    }
});
