import fs from "node:fs";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import * as tools from "./tools/index.js";

const server = new McpServer({
    name: "aps-mcp-server-nodejs",
    version: "0.0.1"
});

// -----------------------------------------------------------------------------
// Register MCP tools
// -----------------------------------------------------------------------------

for (const [
    name,
    {
        title,
        description,
        inputSchema,
        annotations,
        _meta,
        callback
    }
] of Object.entries(tools)) {

    server.registerTool(
        name,
        {
            title,
            description,
            inputSchema,
            annotations,
            _meta
        },
        callback
    );

}

// -----------------------------------------------------------------------------
// Autodesk Viewer MCP App resource
// -----------------------------------------------------------------------------

const VIEWER_HTML = fs.readFileSync(
    new URL("./viewer.html", import.meta.url),
    "utf-8"
);

const VIEWER_RESOURCE_URI =
    "ui://aps-mcp/viewer.html";

const VIEWER_RESOURCE_MIME_TYPE =
    "text/html;profile=mcp-app";

const VIEWER_DOMAINS = [
    "https://developer.api.autodesk.com",
    "https://cdn.derivative.autodesk.com",
    "https://fonts.autodesk.com"
];

const VIEWER_SCRIPT_DOMAINS = [
    "https://cdn.jsdelivr.net"
];

server.registerResource(
    "viewer",
    VIEWER_RESOURCE_URI,
    {
        mimeType: VIEWER_RESOURCE_MIME_TYPE
    },
    async (uri) => ({
        contents: [
            {
                uri: uri.toString(),
                mimeType: VIEWER_RESOURCE_MIME_TYPE,
                text: VIEWER_HTML,

                _meta: {
                    ui: {
                        csp: {
                            resourceDomains: [
                                ...VIEWER_DOMAINS,
                                ...VIEWER_SCRIPT_DOMAINS,
                                "blob:",
                                "data:"
                            ],

                            connectDomains: [
                                ...VIEWER_DOMAINS,
                                "wss://cdn.derivative.autodesk.com"
                            ]
                        }
                    }
                }
            }
        ]
    })
);

// -----------------------------------------------------------------------------
// Start MCP server
// -----------------------------------------------------------------------------

try {

    await server.connect(
        new StdioServerTransport()
    );

} catch (err) {

    console.error(
        "Server error:",
        err
    );

}