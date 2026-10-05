import { z } from "zod";
import { defineTool, resolveProject, cap } from "../guardrails.js";
import { loadViews, viewDef, buildSelect } from "./query.js";
import { runSelect } from "./db.js";

export const sqlListViewsTool = defineTool({
    name: "sql_list_views",
    title: "SQL: List Approved Views",
    description: `Lists the approved read-only SQL views (schema mcp) with descriptions and columns. Call this to learn what project data exists before querying.`,
    handler: async () => ({ views: Object.entries(loadViews().views).map(([name, d]) => ({ name, description: d.description, columns: d.columns, filterableColumns: d.filterableColumns || [] })) })
});

export const sqlQueryProjectViewTool = defineTool({
    name: "sql_query_project_view",
    title: "SQL: Query Project View",
    description: `
        Reads rows for ONE approved project from one approved view. The project is resolved from a name, number or text containing a number,
        and the query is always restricted to that project. Optional equality filters on filterable columns. Results are capped; check "truncated".
        Read-only: there is no way to run custom SQL.
    `,
    inputSchema: {
        project: z.string().describe("Project name, number, or text containing the number"),
        view: z.string(),
        columns: z.array(z.string()).max(30).optional(),
        filters: z.record(z.union([z.string().max(200), z.number(), z.boolean()])).optional(),
        limit: z.number().int().min(1).max(500).optional()
    },
    handler: async ({ project, view, columns, filters, limit }) => {
        const p = resolveProject(project);
        viewDef(view);
        const { sql, params, limit: n } = buildSelect({ view, projectNumber: p.number, columns, filters, limit });
        const rows = await runSelect(sql, params);
        const c = cap(rows, n);
        return { project: p.name, view, rows: c.items, returned: c.items.length, truncated: c.truncated };
    }
});
