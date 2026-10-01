// The ONLY place that talks to Autodesk over raw HTTP. Read-only by construction.
import { ToolError } from "./guardrails.js";
import { serviceAccountAuthenticationProvider } from "./utils.js";

const BASE = "https://developer.api.autodesk.com";
const ALLOWED_GET_PREFIXES = ["/data/v1/", "/project/v1/", "/construction/issues/v1/", "/modelderivative/v2/designdata/"];

export function assertReadOnlyPath(p) {
    if (!ALLOWED_GET_PREFIXES.some(x => p.startsWith(x)) || p.includes("..")) {
        throw new ToolError("Blocked: endpoint is not on the read-only allowlist.", "Use one of the provided tools.");
    }
}

/** GET only. There is deliberately no post/put/patch/delete helper in this codebase. */
export async function apsGet(p, query = {}) {
    assertReadOnlyPath(p);
    const u = new URL(BASE + p);
    for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
    const token = await serviceAccountAuthenticationProvider.getAccessToken();
    const res = await fetch(u, { method: "GET", headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
    if (!res.ok) throw new Error(`APS GET ${p} -> ${res.status}`);
    return res.json();
}

/** Reject anything that is not a plain read query (mutations, subscriptions). */
export function assertReadOnlyGraphQL(doc) {
    const stripped = String(doc).replace(/"(?:\\.|[^"\\])*"/g, '""').replace(/#.*$/gm, "");
    if (/\b(mutation|subscription)\b/i.test(stripped)) {
        throw new ToolError("Blocked: only GraphQL queries are allowed.", "This server is read-only.");
    }
}

export async function aecQuery(query, variables = {}) {
    assertReadOnlyGraphQL(query);
    const token = await serviceAccountAuthenticationProvider.getAccessToken();
    // GraphQL is POST by protocol; read-only is enforced by the check above.
    const res = await fetch(`${BASE}/aec/graphql`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables })
    });
    if (!res.ok) throw new Error(`AEC GraphQL -> ${res.status}`);
    const json = await res.json();
    if (json.errors?.length) throw new Error(`AEC GraphQL errors: ${JSON.stringify(json.errors).slice(0, 300)}`);
    return json.data; // note: HTTP 200 does not guarantee complete data; callers check shape
}
