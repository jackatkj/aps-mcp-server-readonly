// Read-only Azure SQL MCP server (STDIO). Run: node sql/server.js
import url from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as tools from "./tools.js";

export function buildSqlServer() {
    const server = new McpServer({ name: "kj-sql-readonly", version: "0.1.0" }, {
        instructions: "READ-ONLY project data from approved SQL views. Call sql_list_views first to see what exists. Always scope to one project; if the user did not name one, ask. State facts only from tool results and report truncation. Never attempt writes or custom SQL."
    });
    for (const t of Object.values(tools)) {
        server.registerTool(t.name, { title: t.title, description: t.description, inputSchema: t.inputSchema, annotations: { readOnlyHint: true } }, t.callback);
    }
    return server;
}

if (process.argv[1] && url.pathToFileURL(process.argv[1]).href === import.meta.url) {
    try { await buildSqlServer().connect(new StdioServerTransport()); }
    catch (err) { console.error("Server error:", err); process.exit(1); }
}
