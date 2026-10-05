import "./setup.js";
import test from "node:test";
import assert from "node:assert/strict";
import { setConfigForTests } from "../guardrails.js";
import { setViewsForTests, buildSelect } from "../sql/query.js";
import { setRunnerForTests, runSelect } from "../sql/db.js";

setConfigForTests({ projectNumberPattern: "\\d{3}\\.\\d{2}", projects: [{ name: "Alpha Plant", number: "100.01", accountId: "b.A", projectId: "b.P1" }] });
setViewsForTests({ schema: "mcp", views: { ProjectSummary: { projectColumn: "ProjectNumber", columns: ["ProjectNumber", "Status"], filterableColumns: ["Status"] } } });

test("buildSelect is parameterized and scoped to the project", () => {
    const { sql, params } = buildSelect({ view: "ProjectSummary", projectNumber: "100.01", filters: { Status: "x'; DROP TABLE y;--" } });
    assert.match(sql, /^SELECT TOP \(101\) \[ProjectNumber\], \[Status\] FROM \[mcp\]\.\[ProjectSummary\] WHERE \[ProjectNumber\] = @projectNumber AND \[Status\] = @f0$/);
    assert.ok(!sql.includes("DROP"));
    assert.equal(params.f0, "x'; DROP TABLE y;--");
});

test("unknown views, columns and filters are refused", () => {
    assert.throws(() => buildSelect({ view: "dbo.Users", projectNumber: "1" }), /not an approved view/);
    assert.throws(() => buildSelect({ view: "ProjectSummary", projectNumber: "1", columns: ["Salary"] }), /not available/);
    assert.throws(() => buildSelect({ view: "ProjectSummary", projectNumber: "1", filters: { ProjectNumber: "2" } }), /Cannot filter/);
});

test("limit is capped", () => {
    assert.match(buildSelect({ view: "ProjectSummary", projectNumber: "1", limit: 99999 }).sql, /TOP \(101\)/);
});

test("runSelect refuses anything but a single SELECT", async () => {
    await assert.rejects(runSelect("DELETE FROM x"), /only single SELECT/);
    await assert.rejects(runSelect("SELECT 1; DROP TABLE x"), /only single SELECT/);
});

test("server end to end with a fake database", async () => {
    const { buildSqlServer } = await import("../sql/server.js");
    const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
    const { InMemoryTransport } = await import("@modelcontextprotocol/sdk/inMemory.js");
    let seen;
    setRunnerForTests(async (s, p) => { seen = { s, p }; return [{ ProjectNumber: "100.01", Status: "Active" }]; });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await buildSqlServer().connect(a);
    const client = new Client({ name: "t", version: "0" });
    await client.connect(b);
    assert.deepEqual((await client.listTools()).tools.map(t => t.name).sort(), ["sql_list_views", "sql_query_project_view"]);
    const r = await client.callTool({ name: "sql_query_project_view", arguments: { project: "folder 100.01 stuff", view: "ProjectSummary" } });
    assert.equal(r.structuredContent.rows[0].Status, "Active");
    assert.equal(seen.p.projectNumber, "100.01");
    const bad = await client.callTool({ name: "sql_query_project_view", arguments: { project: "999.99", view: "ProjectSummary" } });
    assert.equal(bad.isError, true);
    setRunnerForTests(null);
});
