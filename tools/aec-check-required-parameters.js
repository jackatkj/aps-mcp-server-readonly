import { z } from "zod";
import { defineTool, resolveProject, cap, MAX_ROWS, ToolError } from "../guardrails.js";
import { aecQuery } from "../aps.js";
import { loadRequiredParams } from "../standards.js";

// UNTESTED against live data: verify filter and property names in the AEC GraphiQL explorer.
export const aecCheckRequiredParametersTool = defineTool({
    name: "aec_check_required_parameters",
    title: "AEC Data Model: Check Required Parameters",
    description: `
        For one Revit category in a published model, reports elements missing values for the parameters KJ requires
        (see get_standards). Checks at most one page of elements; says so if partial. Read-only.
    `,
    inputSchema: { project: z.string(), elementGroupId: z.string(), category: z.string().regex(/^[A-Za-z0-9 _-]{1,60}$/) },
    handler: async ({ project, elementGroupId, category }) => {
        const p = resolveProject(project);
        const required = loadRequiredParams()[category];
        if (!required) throw new ToolError(`No required parameters are defined for "${category}".`,
            `Tell the user. Categories with rules: ${Object.keys(loadRequiredParams()).join(", ")}.`);
        const data = await aecQuery(
            `query ($id: ID!, $filter: String!) { elementsByElementGroup(elementGroupId: $id, filter: { query: $filter }, pagination: { limit: ${MAX_ROWS} }) {
               pagination { cursor } results { id name properties(filter: { names: ${JSON.stringify(required)} }) { results { name value } } } } }`,
            { id: elementGroupId, filter: `'property.name.category'==${category}` });
        const r = data.elementsByElementGroup || {};
        const elements = r.results || [];
        const missing = elements.map(e => {
            const have = new Map((e.properties?.results || []).map(x => [x.name, x.value]));
            const lacking = required.filter(n => have.get(n) === undefined || have.get(n) === null || String(have.get(n)).trim() === "");
            return lacking.length ? { id: e.id, name: e.name, missing: lacking } : null;
        }).filter(Boolean);
        const c = cap(missing);
        return { project: p.name, category, required, elementsChecked: elements.length, partial: Boolean(r.pagination?.cursor),
                 elementsWithMissing: c.total, examples: c.items, note: "Reflects the last published model version." };
    }
});
