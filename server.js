import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as tools from "./tools/index.js";
import { loadNaming, loadRequiredParams } from "./standards.js";

const dir = path.dirname(url.fileURLToPath(import.meta.url));
const guidelines = fs.readFileSync(path.join(dir, "guidelines.md"), "utf-8");
const enableIssues = process.env.ENABLE_ISSUES === "true";

export function buildServer() {
    const server = new McpServer(
        { name: "kj-aps-readonly", version: "0.1.0" },
        { instructions: "READ-ONLY Autodesk Forma assistant for approved projects. Call get_project_context first. If the user has not named a project, ask. Never state project facts without a tool result; report truncation; never attempt writes.\n\n" + guidelines }
    );
    for (const t of Object.values(tools)) {
        if (t.optional && !enableIssues) continue;
        server.registerTool(t.name, { title: t.title, description: t.description, inputSchema: t.inputSchema, annotations: t.annotations ?? { readOnlyHint: true }, _meta: t._meta }, t.callback);
    }
    server.registerResource("guidelines", "kj://guidelines", { title: "KJ working rules", mimeType: "text/markdown" },
        async uri => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: guidelines }] }));
    server.registerResource("standards", "kj://standards", { title: "KJ naming and parameter standards", mimeType: "application/json" },
        async uri => ({ contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify({ naming: loadNaming(), requiredParameters: loadRequiredParams() }, null, 2) }] }));
    server.registerPrompt("project_status", {
        title: "Project status summary",
        description: "Summarize what is in a project and what changed recently.",
        argsSchema: { project: z.string().optional() }
    }, ({ project }) => ({ messages: [{ role: "user", content: { type: "text", text:
        `Give a short status summary of ${project || "my project (ask me which one if unclear)"}. Call get_project_context first, list the top-level folders, then search for recently modified key files. State assumptions and any truncation.` } }] }));
    server.registerPrompt("find_files", {
        title: "Find files",
        description: "Locate files from a vague description.",
        argsSchema: { project: z.string().optional(), description: z.string() }
    }, ({ project, description }) => ({ messages: [{ role: "user", content: { type: "text", text:
        `Find files matching: "${description}" in ${project || "the project (ask me which one if unclear)"}. Try sensible keywords, say which you used, and show the latest version info.` } }] }));

    // Autodesk Viewer MCP App resource (from preview_design)
    const VIEWER_HTML = fs.readFileSync(new URL("./viewer.html", import.meta.url), "utf-8");
    const V = ["https://developer.api.autodesk.com", "https://cdn.derivative.autodesk.com", "https://fonts.autodesk.com"];
    server.registerResource("viewer", "ui://aps-mcp/viewer.html", { mimeType: "text/html;profile=mcp-app" },
        async uri => ({ contents: [{ uri: uri.toString(), mimeType: "text/html;profile=mcp-app", text: VIEWER_HTML,
            _meta: { ui: { csp: { resourceDomains: [...V, "https://cdn.jsdelivr.net", "blob:", "data:"], connectDomains: [...V, "wss://cdn.derivative.autodesk.com"] } } } }] }));
    return server;
}

if (process.argv[1] && url.pathToFileURL(process.argv[1]).href === import.meta.url) {
    try { await buildServer().connect(new StdioServerTransport()); }
    catch (err) { console.error("Server error:", err); process.exit(1); }
}
