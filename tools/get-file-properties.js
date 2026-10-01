import { z } from "zod";
import { defineTool, resolveProject, cap, ToolError } from "../guardrails.js";
import { apsGet } from "../aps.js";

// Model Derivative (read-only GETs). Works for Revit, DWG and Civil 3D files already translated in Forma.
export const getFilePropertiesTool = defineTool({
    name: "get_file_properties",
    title: "Get File Properties",
    description: `
        Reads metadata from a design file (Revit, DWG, Civil 3D). Step 1: call with itemId only to list the file's views (viewGuid values).
        Step 2: call again with a viewGuid to read object properties, optionally filtered by objectName text. Output is capped.
        If the file has not been processed yet, say so; do not retry in a loop.
    `,
    inputSchema: { project: z.string(), itemId: z.string(), viewGuid: z.string().optional(), objectName: z.string().max(60).optional() },
    handler: async ({ project, itemId, viewGuid, objectName }) => {
        const p = resolveProject(project);
        const tip = await apsGet(`/data/v1/projects/${encodeURIComponent(p.projectId)}/items/${encodeURIComponent(itemId)}/tip`);
        const urn = tip.data?.relationships?.derivatives?.data?.id;
        if (!urn) throw new ToolError("This file has no viewable data.", "Tell the user it may not be translated yet or is not a design file.");
        const base = `/modelderivative/v2/designdata/${encodeURIComponent(urn)}/metadata`;
        const file = tip.data?.attributes?.displayName;
        if (!viewGuid) {
            const m = await apsGet(base);
            return { project: p.name, file, views: (m.data?.metadata || []).map(v => ({ name: v.name, role: v.role, viewGuid: v.guid })) };
        }
        const props = await apsGet(`${base}/${encodeURIComponent(viewGuid)}/properties`);
        if (props.result === "success" || props.data?.collection) {
            const needle = objectName?.toLowerCase();
            const objs = (props.data?.collection || []).filter(o => !needle || String(o.name).toLowerCase().includes(needle));
            const c = cap(objs.map(o => ({ objectId: o.objectid, name: o.name, properties: o.properties })), 50);
            return { project: p.name, file, objects: c.items, total: c.total, truncated: c.truncated };
        }
        throw new ToolError("Properties are still being prepared by Autodesk.", "Tell the user to try again in a few minutes.");
    }
});
