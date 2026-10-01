// Guardrails shared by every tool: project allowlist, read-only enforcement,
// bounded output, audit logging and guidance-bearing errors.
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const CONFIG_PATH = process.env.PROJECTS_CONFIG || path.join(__dirname, "projects.config.json");
const AUDIT_PATH = process.env.AUDIT_LOG || path.join(__dirname, "logs", "audit.log");
export const MAX_ROWS = Number(process.env.MAX_ROWS || 100);

export class ToolError extends Error {
    constructor(message, hint) { super(message); this.hint = hint; }
}

let _config = null;
export function loadConfig(force = false) {
    if (_config && !force) return _config;
    if (!fs.existsSync(CONFIG_PATH)) {
        throw new ToolError(`Project allowlist not found at ${CONFIG_PATH}.`,
            "Copy projects.config.example.json to projects.config.json and list the approved projects.");
    }
    _config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    if (!Array.isArray(_config.projects) || !_config.projects.length) {
        throw new ToolError("projects.config.json contains no projects.", "Add at least one approved project.");
    }
    return _config;
}
export function setConfigForTests(cfg) { _config = cfg; }

const norm = s => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export const stripB = id => String(id).replace(/^b\./, "");

/** Resolve a user-supplied name / number / alias / id to an allowlisted project. */
export function resolveProject(query) {
    const { projects } = loadConfig();
    if (!query || !String(query).trim()) {
        throw new ToolError("No project was specified.",
            "Ask the user which project they mean. Call get_project_context to list the approved projects.");
    }
    const q = norm(query);
    const keys = p => [p.name, p.number, p.projectId, stripB(p.projectId), ...(p.aliases || [])].map(norm).filter(Boolean);
    let hits = projects.filter(p => keys(p).includes(q));
    if (!hits.length) hits = projects.filter(p => keys(p).some(k => k.includes(q) || q.includes(k)));
    if (hits.length === 1) return hits[0];
    const list = (hits.length ? hits : projects).map(p => `${p.name}${p.number ? ` (${p.number})` : ""}`);
    throw new ToolError(
        hits.length ? `"${query}" matches more than one approved project.` : `"${query}" is not an approved project.`,
        `Do not guess. Ask the user to choose from: ${list.join("; ")}.`);
}

/** Cap a list and say so. Silent truncation is how wrong answers happen. */
export function cap(items, max = MAX_ROWS) {
    const total = items.length;
    return { items: items.slice(0, max), total, truncated: total > max };
}

export function audit(entry) {
    try {
        fs.mkdirSync(path.dirname(AUDIT_PATH), { recursive: true });
        fs.appendFileSync(AUDIT_PATH, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n");
    } catch { /* never let logging break a tool call */ }
}

const ok = result => ({ content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result });
const fail = (message, hint) => ({
    isError: true,
    content: [{ type: "text", text: JSON.stringify({ error: message, nextStep: hint }) }]
});

/** Define a tool: validates, audits, and turns errors into guidance for the model. */
export function defineTool({ name, title, description, inputSchema = {}, optional = false, handler }) {
    return {
        name, title, description, inputSchema, optional,
        callback: async args => {
            const started = Date.now();
            try {
                const result = await handler(args || {});
                audit({ tool: name, args, ok: true, ms: Date.now() - started });
                return ok(result);
            } catch (err) {
                audit({ tool: name, args, ok: false, error: String(err.message).slice(0, 300), ms: Date.now() - started });
                if (err instanceof ToolError) return fail(err.message, err.hint);
                return fail("The Autodesk request failed.", "Report this to the user plainly. Do not invent results or retry in a loop.");
            }
        }
    };
}
