import { z } from "zod";

import {
    getItemTip,
    serviceAccountAuthenticationProvider
} from "../utils.js";

const VIEWER_RESOURCE_URI =
    "ui://aps-mcp/viewer.html";

const previewDesignTool = {

    title:
        "Preview design",

    description:
        "Displays an interactive 3D preview of a design in APS Viewer. Use this when the user wants to visualize, inspect, or explore a design file.",

    inputSchema: {

        projectId:
            z.string().describe(
                "Project ID the design belongs to."
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

    callback: async ({
        projectId,
        designId,
        region = "US"
    }) => {

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

};

export default previewDesignTool;