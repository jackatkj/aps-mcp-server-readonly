// Builds parameterized SELECT statements from structured arguments. There is NO raw-SQL path.
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { ToolError } from "../guardrails.js";

const dir = path.dirname(url.fileURLToPath(import.meta.url));
const IDENT = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
export const SQL_MAX_ROWS = Number(process.env.SQL_MAX_ROWS || 100);

let _views = null;
export function loadViews() {
    if (_views) return _views;
    const f = process.env.SQL_VIEWS_CONFIG || path.join(dir, "views.config.json");
    if (!fs.existsSync(f)) throw new ToolError("SQL view allowlist not found.", "Copy sql/views.config.example.json to sql/views.config.json and list the approved views.");
    _views = JSON.parse(fs.readFileSync(f, "utf-8"));
    if (_views.schema !== "mcp") throw new Error("Only the 'mcp' schema is allowed.");
    for (const [v, d] of Object.entries(_views.views)) {
        for (const id of [v, d.projectColumn, ...d.columns, ...(d.filterableColumns || [])]) {
            if (!IDENT.test(id)) throw new Error(`Unsafe identifier in views config: ${id}`);
        }
    }
    return _views;
}
export function setViewsForTests(v) { _views = v; }

const q = id => `[${id}]`; // identifiers are validated against IDENT and the allowlist before this

export function viewDef(name) {
    const { views } = loadViews();
    const def = views[name];
    if (!def) throw new ToolError(`"${name}" is not an approved view.`, `Choose from: ${Object.keys(views).join(", ")}.`);
    return def;
}

/** Returns { sql, params } for one view, one project, optional equality filters. */
export function buildSelect({ view, projectNumber, columns, filters = {}, limit }) {
    const def = viewDef(view);
    const cols = columns?.length ? columns : def.columns;
    for (const c of cols) if (!def.columns.includes(c)) throw new ToolError(`Column "${c}" is not available in ${view}.`, `Allowed: ${def.columns.join(", ")}.`);
    const params = { projectNumber };
    const where = [`${q(def.projectColumn)} = @projectNumber`];
    let i = 0;
    for (const [col, val] of Object.entries(filters)) {
        if (!(def.filterableColumns || []).includes(col)) throw new ToolError(`Cannot filter ${view} by "${col}".`, `Filterable: ${(def.filterableColumns || []).join(", ") || "none"}.`);
        params[`f${i}`] = val;
        where.push(`${q(col)} = @f${i++}`);
    }
    const n = Math.min(Math.max(1, Number(limit) || SQL_MAX_ROWS), SQL_MAX_ROWS);
    const sql = `SELECT TOP (${n + 1}) ${cols.map(q).join(", ")} FROM ${q(loadViews().schema)}.${q(view)} WHERE ${where.join(" AND ")}`;
    return { sql, params, limit: n };
}
