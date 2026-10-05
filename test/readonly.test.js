import "./setup.js";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { setConfigForTests, resolveProject, cap } from "../guardrails.js";

process.env.APS_CLIENT_ID = process.env.APS_CLIENT_ID || "x";
setConfigForTests({ projectNumberPattern: "\\d{3}\\.\\d{2}", projects: [
    { name: "Alpha Plant", number: "100.01", aliases: ["alpha"], accountId: "b.A", projectId: "b.P1" },
    { name: "Alpha Pipeline", number: "200.02", aliases: [], accountId: "b.A", projectId: "b.P2" }
] });

test("no write calls anywhere in source", () => {
    const files = ["aps.js", "server.js", "utils.js", ...fs.readdirSync("tools").map(f => path.join("tools", f)), ...fs.readdirSync("sql").filter(f => f.endsWith(".js")).map(f => path.join("sql", f))];
    const bad = /\.(put|patch|delete|create\w*|update\w*|post)\(|method:\s*["'](PUT|PATCH|DELETE)["']/;
    for (const f of files) assert.ok(!bad.test(fs.readFileSync(f, "utf-8")), `write-like call in ${f}`);
    // the single allowed POST is the AEC GraphQL read query
    assert.equal((fs.readFileSync("aps.js", "utf-8").match(/method:\s*["']POST["']/g) || []).length, 1);
});

test("graphql mutations are rejected", async () => {
    const { assertReadOnlyGraphQL } = await import("../aps.js");
    assert.throws(() => assertReadOnlyGraphQL("mutation { x }"));
    assert.throws(() => assertReadOnlyGraphQL("  Mutation{x}"));
    assert.doesNotThrow(() => assertReadOnlyGraphQL('query { a(filter:"mutation") { b } }'));
});

test("only allowlisted GET paths", async () => {
    const { assertReadOnlyPath } = await import("../aps.js");
    assert.throws(() => assertReadOnlyPath("/oss/v2/buckets"));
    assert.throws(() => assertReadOnlyPath("/data/v1/../admin"));
    assert.doesNotThrow(() => assertReadOnlyPath("/data/v1/projects/b.1/items/x/versions"));
});

test("project resolution", () => {
    assert.equal(resolveProject("100.01").name, "Alpha Plant");
    assert.equal(resolveProject("alpha plant").name, "Alpha Plant");
    assert.throws(() => resolveProject("alpha p"), /more than one|not an approved/);
    assert.throws(() => resolveProject("secret project"), /not an approved/);
    assert.throws(() => resolveProject(""), /No project/);
});

test("project number extraction from messy text", async () => {
    const { extractProjectNumbers } = await import("../guardrails.js");
    assert.equal(resolveProject("Z_100.01 Alpha folder").name, "Alpha Plant");
    assert.equal(resolveProject("https://x/y/100.01-C-101.dwg").name, "Alpha Plant");
    assert.deepEqual(extractProjectNumbers("see 200.02 and 100.01"), ["200.02", "100.01"]);
});

test("cap flags truncation", () => {
    const c = cap(Array.from({ length: 150 }, (_, i) => i), 100);
    assert.equal(c.items.length, 100); assert.equal(c.truncated, true);
});

test("server registers expected tools, hides issues by default, and returns guidance errors", async () => {
    const { buildServer } = await import("../server.js");
    const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
    const { InMemoryTransport } = await import("@modelcontextprotocol/sdk/inMemory.js");
    const [a, b] = InMemoryTransport.createLinkedPair();
    await buildServer().connect(a);
    const client = new Client({ name: "t", version: "0" });
    await client.connect(b);
    const names = (await client.listTools()).tools.map(t => t.name).sort();
    assert.deepEqual(names, ["aec_check_required_parameters", "aec_get_families", "aec_list_element_groups", "aec_query_elements", "check_file_naming", "get_file_properties", "get_file_versions", "get_folder_contents", "get_project_context", "get_projects", "get_standards", "preview_design", "resolve_project", "search_project_files"]);
    const bad = await client.callTool({ name: "get_folder_contents", arguments: { project: "nope" } });
    assert.equal(bad.isError, true);
    assert.match(bad.content[0].text, /not an approved project/);
    const ctx = await client.callTool({ name: "get_project_context", arguments: {} });
    assert.equal(ctx.structuredContent.readOnly, true);
});

test("naming checker", async () => {
    const { checkName } = await import("../standards.js");
    assert.equal(checkName("1234567.00-C-101_Grading Plan.dwg", "Plans").status, "pass");
    assert.equal(checkName("final_v2 (copy).dwg", "Plans").status, "fail");
    assert.equal(checkName("anything.txt", "Photos").status, "no-rule");
});
