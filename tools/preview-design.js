import { z } from "zod";

import { resolveProject, audit, ToolError } from "../guardrails.js";

import {
    getItemTip,
    serviceAccountAuthenticationProvider
} from "../utils.js";

const VIEWER_RESOURCE_URI =
    "ui://aps-mcp/viewer.html";

const previewDesignTool = {

    name:
        "preview_design",

    title:
        "Preview design",

    description:
        "Displays an interactive 3D preview of a design in APS Viewer. Use this when the user wants to visualize, inspect, or explore a design file.",

    inputSchema: {

        projectId:
            z.string().describe(
                "Project name or number (must be an approved project)."
            ),

        designId:
            z.string().describe(
                "Item ID of the design to preview."
            ),

        region:
            z.string().optional().describe(
                'Hub region, for example "US" or "EMEA". Defaults to "US".'
            )

    },

    _meta: {

        ui: {
            resourceUri:
                VIEWER_RESOURCE_URI
        }

    },

    annotations: {

        readOnlyHint:
            true

    },

    callback: async (args) => {
        try {
            return await previewDesign(args);
        } catch (err) {
            audit({ tool: "preview_design", args, ok: false, error: String(err.message).slice(0, 300) });
            const hint = err instanceof ToolError ? err.hint : "Report this to the user plainly. Do not retry in a loop.";
            return { isError: true, content: [{ type: "text", text: JSON.stringify({ error: err instanceof ToolError ? err.message : "The Autodesk request failed.", nextStep: hint }) }] };
        }
    }

};

async function previewDesign({ projectId: projectQuery, designId, region = "US" }) {
        const project = resolveProject(projectQuery);
        const projectId = project.projectId;
        audit({ tool: "preview_design", args: { project: project.name, designId, region }, ok: true });

        // ---------------------------------------------------------------------
        // Get the current APS access token using the existing SSA provider.
        // ---------------------------------------------------------------------

        const accessToken =
            await serviceAccountAuthenticationProvider
                .getAccessToken();

        // ---------------------------------------------------------------------
        // Get the current version of the ACC design.
        // ---------------------------------------------------------------------

        const tip =
            await getItemTip(
                serviceAccountAuthenticationProvider,
                projectId,
                designId
            );

        // ---------------------------------------------------------------------
        // Build Autodesk Viewer configuration.
        // ---------------------------------------------------------------------

        const config = {

            accessToken,

            env:
                "AutodeskProduction2",

            api:
                region === "US"
                    ? "streamingV2"
                    : `streamingV2_${region}`

        };

        // ---------------------------------------------------------------------
        // Return MCP App structured content.
        // ---------------------------------------------------------------------

        return {

            structuredContent: {

                name:
                    tip.name,

                urn:
                    tip.derivativeUrn,

                config

            },

            content: [

                {

                    type:
                        "text",

                    text:
                        `Here is the preview of ${tip.name}.`

                }

            ]

        };

}

export default previewDesignTool;